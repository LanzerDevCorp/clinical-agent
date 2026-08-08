import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { createClinicalAgentRoute } from '@/app/api/chat/route'
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

type RouteEvent =
  | { type: 'status'; status: 'processing' }
  | { type: 'artifact'; internal: string; client: string }
  | { type: 'error'; message: string }

function request(body: BodyInit, signal?: AbortSignal) {
  return new Request('https://internal.example/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://internal.example' },
    body,
    signal,
  })
}

function messages(count = 1) {
  return JSON.stringify({
    messages: Array.from({ length: count }, (_, index) => ({
      id: `message-${index}`,
      role: 'user',
      parts: [{ type: 'text', text: `Question ${index}` }],
    })),
  })
}

function routeHarness(options: {
  user?: { id: string; collection: string } | null
  admission?: { ok: true; leaseId: string } | { ok: false; code: 'RATE_LIMITED' | 'CONCURRENT_LIMIT' | 'UNAVAILABLE' }
  admissionError?: boolean
  run?: (options: { onEvent(event: RouteEvent): void; abortSignal?: AbortSignal; messages: readonly unknown[] }) => Promise<unknown>
} = {}) {
  const calls: string[] = []
  let releases = 0
  const handler = createClinicalAgentRoute({
    authenticate: async () => {
      calls.push('authenticate')
      return options.user === undefined
        ? { user: { id: 'internal-user', collection: 'users' }, payload: {} } as never
        : options.user ? { user: options.user, payload: {} } as never : null
    },
    admission: {
      acquire: async () => {
        calls.push('admission')
        if (options.admissionError) throw new Error('database unavailable')
        return options.admission ?? { ok: true, leaseId: 'lease-1' }
      },
      release: async () => {
        calls.push('release')
        releases += 1
        return { ok: true }
      },
    },
    createGateway: () => {
      calls.push('gateway')
      return {} as never
    },
    createTools: () => {
      calls.push('tools')
      return {} as never
    },
    createOrchestrator: () => ({
      run: async ({ onEvent, abortSignal, messages: routeMessages }: { onEvent(event: RouteEvent): void; abortSignal?: AbortSignal; messages: readonly unknown[] }) => {
        calls.push('orchestrator')
        if (options.run) return options.run({ onEvent, abortSignal, messages: routeMessages })
        onEvent({ type: 'status', status: 'processing' })
        onEvent({ type: 'artifact', internal: 'Internal clinical facts:', client: 'Client-shareable facts:' })
        return { ok: true }
      },
    }),
  })
  return { POST: handler.POST, calls, releases: () => releases }
}

describe('clinical agent route boundary', () => {
  it('authenticates the native request and denies unauthenticated or external callers before reading the body, admission, or provider work', async () => {
    let bodyRead = false
    const unreadableRequest = {
      url: 'https://internal.example/api/chat',
      headers: new Headers({ 'content-type': 'application/json', origin: 'https://internal.example' }),
      body: {
        getReader: () => {
          bodyRead = true
          throw new Error('body must not be read')
        },
      },
      signal: new AbortController().signal,
    } as never as Request
    const unauthenticated = routeHarness({ user: null })

    const unauthenticatedResponse = await unauthenticated.POST(unreadableRequest)
    expect(unauthenticatedResponse.status).toBe(401)
    expect(bodyRead).toBe(false)
    expect(unauthenticated.calls).toEqual(['authenticate'])

    const external = routeHarness()
    const externalResponse = await external.POST(new Request('https://internal.example/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://outside.example' },
      body: messages(),
    }))
    expect(externalResponse.status).toBe(403)
    expect(external.calls).toEqual([])

    const originless = routeHarness()
    const originlessResponse = await originless.POST(new Request('https://internal.example/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: messages(),
    }))
    expect(originlessResponse.status).toBe(403)
    expect(originless.calls).toEqual([])
  })

  it('admits before reading bounded JSON, rejects oversized or invalid messages, and never creates tools or a provider on invalid input', async () => {
    const malformed = routeHarness()
    const malformedResponse = await malformed.POST(request('{'))
    expect(malformedResponse.status).toBe(400)
    expect(malformed.calls).toEqual(['authenticate', 'admission', 'release'])

    const tooMany = routeHarness()
    const tooManyResponse = await tooMany.POST(request(messages(41)))
    expect(tooManyResponse.status).toBe(400)
    expect(tooMany.calls).toEqual(['authenticate', 'admission', 'release'])

    const oversized = routeHarness()
    const oversizedResponse = await oversized.POST(request(JSON.stringify({ messages: [{ id: 'one', role: 'user', parts: [{ type: 'text', text: 'x'.repeat(256 * 1024) }] }] })))
    expect(oversizedResponse.status).toBe(413)
    expect(oversized.calls).toEqual(['authenticate', 'admission', 'release'])

    const unexpectedMessageKey = routeHarness()
    const unexpectedMessageKeyResponse = await unexpectedMessageKey.POST(request(JSON.stringify({
      messages: [{ id: 'one', role: 'user', parts: [{ type: 'text', text: 'Question' }], unexpected: true }],
    })))
    expect(unexpectedMessageKeyResponse.status).toBe(400)
    expect(await unexpectedMessageKeyResponse.json()).toEqual({ error: 'Request unavailable.' })
    expect(unexpectedMessageKey.calls).toEqual(['authenticate', 'admission', 'release'])
    expect(unexpectedMessageKey.releases()).toBe(1)

    const unexpectedPartKey = routeHarness()
    const unexpectedPartKeyResponse = await unexpectedPartKey.POST(request(JSON.stringify({
      messages: [{ id: 'one', role: 'user', parts: [{ type: 'text', text: 'Question', unexpected: true }] }],
    })))
    expect(unexpectedPartKeyResponse.status).toBe(400)
    expect(await unexpectedPartKeyResponse.json()).toEqual({ error: 'Request unavailable.' })
    expect(unexpectedPartKey.calls).toEqual(['authenticate', 'admission', 'release'])
    expect(unexpectedPartKey.releases()).toBe(1)

    const exactLimit = routeHarness()
    const exactLimitResponse = await exactLimit.POST(request(messages(40)))
    await exactLimitResponse.text()
    expect(exactLimitResponse.status).toBe(200)
    expect(exactLimit.calls).toEqual(['authenticate', 'admission', 'gateway', 'tools', 'orchestrator', 'release'])
  })

  it('maps admission limits and unavailability to redacted 429 and 503 responses before provider or tool construction', async () => {
    const rateLimited = routeHarness({ admission: { ok: false, code: 'RATE_LIMITED' } })
    const rateLimitedResponse = await rateLimited.POST(request(messages()))
    expect(rateLimitedResponse.status).toBe(429)
    expect(await rateLimitedResponse.json()).toEqual({ error: 'Request unavailable.' })
    expect(rateLimited.calls).toEqual(['authenticate', 'admission'])

    const unavailable = routeHarness({ admission: { ok: false, code: 'UNAVAILABLE' } })
    const unavailableResponse = await unavailable.POST(request(messages()))
    expect(unavailableResponse.status).toBe(503)
    expect(await unavailableResponse.json()).toEqual({ error: 'Request unavailable.' })
    expect(unavailable.calls).toEqual(['authenticate', 'admission'])

    const storageFailure = routeHarness({ admissionError: true })
    const storageFailureResponse = await storageFailure.POST(request(messages()))
    expect(storageFailureResponse.status).toBe(503)
    expect(await storageFailureResponse.json()).toEqual({ error: 'Request unavailable.' })
    expect(storageFailure.calls).toEqual(['authenticate', 'admission'])
  })

  it('emits only safe UI stream events and releases an admitted lease exactly once when the stream finishes, fails, or is cancelled', async () => {
    const finished = routeHarness()
    const finishedResponse = await finished.POST(request(messages()))
    const finishedPayload = await finishedResponse.text()
    expect(finishedPayload).toContain('processing')
    expect(finishedPayload).toContain('Internal clinical facts:')
    expect(finished.releases()).toBe(1)

    const failed = routeHarness({
      run: async ({ onEvent }) => {
        onEvent({ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-id' })
        return { ok: false, code: 'TEMPORARY_FAILURE' }
      },
    })
    const failedResponse = await failed.POST(request(messages()))
    expect(await failedResponse.text()).toContain('opaque-id')
    expect(failed.releases()).toBe(1)

    const thrown = routeHarness({
      run: async () => { throw new Error('raw provider failure') },
    })
    const thrownResponse = await thrown.POST(request(messages()))
    const thrownPayload = await thrownResponse.text()
    expect(thrownPayload).toContain('Unable to complete the clinical response. Reference:')
    expect(thrownPayload).not.toContain('raw provider failure')
    expect(thrown.releases()).toBe(1)

    const abortController = new AbortController()
    let abortObserved = false
    const cancelled = routeHarness({
      run: async ({ onEvent, abortSignal }) => {
        onEvent({ type: 'status', status: 'processing' })
        await new Promise<void>((resolve) => abortSignal?.addEventListener('abort', () => {
          abortObserved = true
          resolve()
        }, { once: true }))
        return { ok: false, code: 'TEMPORARY_FAILURE' }
      },
    })
    const cancelledResponse = await cancelled.POST(request(messages(), abortController.signal))
    const reader = cancelledResponse.body?.getReader()
    await reader?.read()
    abortController.abort()
    await reader?.cancel()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(abortObserved).toBe(true)
    expect(cancelled.releases()).toBe(1)
  })
})
