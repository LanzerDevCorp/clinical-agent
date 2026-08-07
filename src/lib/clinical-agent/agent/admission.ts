import { createHmac, randomUUID } from 'node:crypto'

const HOUR_MS = 60 * 60 * 1000
const LEASE_MS = 180 * 1000
const MAX_REQUESTS_PER_HOUR = 60
const MAX_CONCURRENT_REQUESTS = 2

type QueryResult<Row> = { rows: Row[] }

export type AdmissionClient = {
  query<Row = Record<string, unknown>>(query: string, values?: unknown[]): Promise<QueryResult<Row>>
  release(): void
}

export type AdmissionPool = {
  connect(): Promise<AdmissionClient>
}

export type AdmissionResult =
  | { ok: true; leaseId: string }
  | { ok: false; code: 'RATE_LIMITED' | 'CONCURRENT_LIMIT' | 'UNAVAILABLE' }

export type ReleaseResult = { ok: true } | { ok: false; code: 'UNAVAILABLE' }

type PostgresAdmissionOptions = {
  pool: AdmissionPool
  secret: string | undefined
  now?: () => Date
  createLeaseId?: () => string
}

export function hashAdmissionSubject(subjectId: string, secret: string): string {
  if (!secret) throw new Error('Admission HMAC secret is required')
  return createHmac('sha256', secret).update(`users:${subjectId}`).digest('hex')
}

export function createPostgresAdmission({
  pool,
  secret,
  now = () => new Date(),
  createLeaseId = randomUUID,
}: PostgresAdmissionOptions) {
  async function acquire(subjectId: string): Promise<AdmissionResult> {
    if (!secret) return { ok: false, code: 'UNAVAILABLE' }

    const subjectHash = hashAdmissionSubject(subjectId, secret)
    const admittedAt = now()
    const leaseId = createLeaseId()
    let client: AdmissionClient | undefined

    try {
      client = await pool.connect()
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [subjectHash])
      await client.query(
        "DELETE FROM clinical_agent_admission_events WHERE subject_hash = $1 AND admitted_at <= $2::timestamptz - INTERVAL '1 hour'",
        [subjectHash, admittedAt],
      )
      await client.query(
        'DELETE FROM clinical_agent_admission_leases WHERE subject_hash = $1 AND expires_at <= $2',
        [subjectHash, admittedAt],
      )
      const counts = await client.query<{ event_count: number; lease_count: number }>(
        `SELECT
          (SELECT count(*)::int FROM clinical_agent_admission_events WHERE subject_hash = $1) AS event_count,
          (SELECT count(*)::int FROM clinical_agent_admission_leases WHERE subject_hash = $1) AS lease_count`,
        [subjectHash],
      )
      const { event_count: eventCount, lease_count: leaseCount } = counts.rows[0] ?? { event_count: MAX_REQUESTS_PER_HOUR, lease_count: MAX_CONCURRENT_REQUESTS }

      if (eventCount >= MAX_REQUESTS_PER_HOUR) {
        await client.query('COMMIT')
        return { ok: false, code: 'RATE_LIMITED' }
      }
      if (leaseCount >= MAX_CONCURRENT_REQUESTS) {
        await client.query('COMMIT')
        return { ok: false, code: 'CONCURRENT_LIMIT' }
      }

      await client.query(
        'INSERT INTO clinical_agent_admission_events (event_id, subject_hash, admitted_at) VALUES ($1, $2, $3)',
        [randomUUID(), subjectHash, admittedAt],
      )
      await client.query(
        'INSERT INTO clinical_agent_admission_leases (lease_id, subject_hash, expires_at) VALUES ($1, $2, $3)',
        [leaseId, subjectHash, new Date(admittedAt.getTime() + LEASE_MS)],
      )
      await client.query('COMMIT')
      return { ok: true, leaseId }
    } catch {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // The original storage failure remains fail-closed.
        }
      }
      return { ok: false, code: 'UNAVAILABLE' }
    } finally {
      client?.release()
    }
  }

  async function release(leaseId: string): Promise<ReleaseResult> {
    let client: AdmissionClient | undefined

    try {
      client = await pool.connect()
      await client.query('DELETE FROM clinical_agent_admission_leases WHERE lease_id = $1', [leaseId])
      return { ok: true }
    } catch {
      return { ok: false, code: 'UNAVAILABLE' }
    } finally {
      client?.release()
    }
  }

  return { acquire, release }
}

export const admissionLimits = {
  hourMs: HOUR_MS,
  leaseMs: LEASE_MS,
  maxRequestsPerHour: MAX_REQUESTS_PER_HOUR,
  maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
} as const
