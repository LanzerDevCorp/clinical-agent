import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { createPostgresAdmission, hashAdmissionSubject, type AdmissionPool } from '@/lib/clinical-agent/agent/admission'
import * as admissionMigration from '@/migrations/20260807_140000_clinical_agent_admission'
import { migrations } from '@/migrations'
import config from '@/payload.config'

const SECRET = 'test-admission-secret'
const HOUR = 60 * 60 * 1000
const LEASE = 180 * 1000
const NOW = new Date('2026-08-07T14:00:00.000Z')

let payload: Payload
let pool: AdmissionPool & { query<Row>(query: string, values?: unknown[]): Promise<{ rows: Row[] }> }

function admission(subjectId: string, now = NOW) {
  return createPostgresAdmission({
    pool,
    secret: SECRET,
    now: () => now,
    createLeaseId: () => crypto.randomUUID(),
  }).acquire(subjectId)
}

function databasePool(): AdmissionPool & { query<Row>(query: string, values?: unknown[]): Promise<{ rows: Row[] }> } {
  const db = payload.db as typeof payload.db & { pool?: AdmissionPool & { query<Row>(query: string, values?: unknown[]): Promise<{ rows: Row[] }> } }
  if (!db.pool) throw new Error('Postgres integration requires the Payload Postgres pool')
  return db.pool
}

function migrationArgs() {
  return { db: payload.db.drizzle } as never
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  pool = databasePool()
  await admissionMigration.down(migrationArgs())
  await admissionMigration.up(migrationArgs())
}, 30_000)

afterAll(async () => {
  await admissionMigration.down(migrationArgs())
}, 30_000)

describe('clinical agent Postgres admission', () => {
  it('registers a reversible private admission migration', async () => {
    expect(migrations.some((migration) => migration.name === '20260807_140000_clinical_agent_admission')).toBe(true)

    const created = await pool.query<{ event_table: string | null; lease_table: string | null }>(
      "SELECT to_regclass('clinical_agent_admission_events') AS event_table, to_regclass('clinical_agent_admission_leases') AS lease_table",
    )
    expect(created.rows[0]).toEqual({
      event_table: 'clinical_agent_admission_events',
      lease_table: 'clinical_agent_admission_leases',
    })

    await admissionMigration.down(migrationArgs())
    const removed = await pool.query<{ event_table: string | null; lease_table: string | null }>(
      "SELECT to_regclass('clinical_agent_admission_events') AS event_table, to_regclass('clinical_agent_admission_leases') AS lease_table",
    )
    expect(removed.rows[0]).toEqual({ event_table: null, lease_table: null })
    await admissionMigration.up(migrationArgs())
  })

  it('uses a stable HMAC pseudonym and never persists the raw Payload user identity', async () => {
    const subjectId = `payload-user-${crypto.randomUUID()}`
    const expectedHash = hashAdmissionSubject(subjectId, SECRET)

    expect(expectedHash).toHaveLength(64)
    expect(hashAdmissionSubject(subjectId, SECRET)).toBe(expectedHash)
    expect(hashAdmissionSubject(subjectId, 'different-secret')).not.toBe(expectedHash)
    await expect(admission(subjectId)).resolves.toMatchObject({ ok: true })

    const stored = await pool.query<{ subject_hash: string }>(
      `SELECT subject_hash FROM clinical_agent_admission_events WHERE subject_hash = $1
       UNION ALL
       SELECT subject_hash FROM clinical_agent_admission_leases WHERE subject_hash = $1`,
      [expectedHash],
    )
    expect(stored.rows).toEqual([{ subject_hash: expectedHash }, { subject_hash: expectedHash }])
    expect(JSON.stringify(stored.rows)).not.toContain(subjectId)
  })

  it('atomically permits exactly 60 requests per rolling hour', async () => {
    const subjectId = `hourly-${crypto.randomUUID()}`
    const service = createPostgresAdmission({ pool, secret: SECRET, now: () => NOW })
    const subjectHash = hashAdmissionSubject(subjectId, SECRET)

    await pool.query(
      `INSERT INTO clinical_agent_admission_events (event_id, subject_hash, admitted_at)
       SELECT md5($1 || series::text)::uuid, $1, $2::timestamptz
       FROM generate_series(1, 59) AS series`,
      [subjectHash, NOW],
    )

    const sixtieth = await service.acquire(subjectId)
    expect(sixtieth.ok).toBe(true)
    if (sixtieth.ok) await expect(service.release(sixtieth.leaseId)).resolves.toEqual({ ok: true })

    await expect(service.acquire(subjectId)).resolves.toEqual({ ok: false, code: 'RATE_LIMITED' })
  })

  it('atomically permits two concurrent leases, denies a third, and admits after release', async () => {
    const subjectId = `concurrent-${crypto.randomUUID()}`
    const service = createPostgresAdmission({ pool, secret: SECRET, now: () => NOW })
    const results = await Promise.all([
      service.acquire(subjectId),
      service.acquire(subjectId),
      service.acquire(subjectId),
    ])
    const admitted = results.filter((result): result is { ok: true; leaseId: string } => result.ok)

    expect(admitted).toHaveLength(2)
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: 'CONCURRENT_LIMIT' }])
    await expect(service.release(admitted[0].leaseId)).resolves.toEqual({ ok: true })
    await expect(service.acquire(subjectId)).resolves.toMatchObject({ ok: true })
  })

  it('recovers expired leases and rolling-hour events after a crash', async () => {
    const subjectId = `expiry-${crypto.randomUUID()}`
    const service = createPostgresAdmission({ pool, secret: SECRET, now: () => NOW })
    const first = await service.acquire(subjectId)
    const second = await service.acquire(subjectId)
    expect(first.ok && second.ok).toBe(true)

    const afterLeaseExpiry = createPostgresAdmission({
      pool,
      secret: SECRET,
      now: () => new Date(NOW.getTime() + LEASE),
    })
    await expect(afterLeaseExpiry.acquire(subjectId)).resolves.toMatchObject({ ok: true })

    const afterHour = createPostgresAdmission({
      pool,
      secret: SECRET,
      now: () => new Date(NOW.getTime() + HOUR + LEASE),
    })
    await expect(afterHour.acquire(subjectId)).resolves.toMatchObject({ ok: true })
  })

  it('fails closed when admission storage or lease cleanup is unavailable', async () => {
    const misconfigured = createPostgresAdmission({ pool, secret: undefined })
    await expect(misconfigured.acquire('payload-user')).resolves.toEqual({ ok: false, code: 'UNAVAILABLE' })

    const unavailable = createPostgresAdmission({
      pool: { connect: async () => { throw new Error('database unavailable') } },
      secret: SECRET,
    })
    await expect(unavailable.acquire('payload-user')).resolves.toEqual({ ok: false, code: 'UNAVAILABLE' })

    const admitted = await admission(`release-${crypto.randomUUID()}`)
    expect(admitted.ok).toBe(true)
    if (!admitted.ok) return

    const cleanupFailure = createPostgresAdmission({
      pool: {
        connect: async () => ({
          query: async () => { throw new Error('database unavailable') },
          release: () => undefined,
        }),
      },
      secret: SECRET,
    })
    await expect(cleanupFailure.release(admitted.leaseId)).resolves.toEqual({ ok: false, code: 'UNAVAILABLE' })
  })
})
