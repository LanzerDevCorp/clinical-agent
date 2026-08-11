/**
 * Failure reporting for the clinical agent.
 *
 * The client only ever receives an opaque message with a request id, which is the
 * right behaviour for a clinical surface but leaves that id useless unless the
 * server records what happened under it. This module is that record.
 *
 * Safety is enforced by the types rather than by discipline: a report can only
 * carry a request id, a reason from a closed set, counters, and fact identifiers.
 * There is no field a provider message, a product description, or any other
 * clinical value could travel in.
 */

export type ClinicalFailureReason =
  | 'ABORTED'
  | 'TOTAL_TIMEOUT'
  | 'TIMEOUT'
  | 'INCOMPLETE_STREAM'
  | 'LIMIT_EXCEEDED'
  | 'INVALID_ARTIFACT'
  | 'RETRY_EXHAUSTED'
  | 'PROVIDER_FAILURE'

const REASONS: readonly ClinicalFailureReason[] = [
  'ABORTED', 'TOTAL_TIMEOUT', 'TIMEOUT', 'INCOMPLETE_STREAM',
  'LIMIT_EXCEEDED', 'INVALID_ARTIFACT', 'RETRY_EXHAUSTED', 'PROVIDER_FAILURE',
]

/** Anything the orchestrator did not throw itself came from the provider. */
export function failureReasonOf(error: unknown): ClinicalFailureReason {
  const raw = error instanceof Error ? error.message : ''
  return REASONS.includes(raw as ClinicalFailureReason) ? raw as ClinicalFailureReason : 'PROVIDER_FAILURE'
}

export type ClinicalFailureReport = {
  requestId: string
  reason: ClinicalFailureReason
  attempts: number
  toolLimitExceeded: boolean
  /** Identifiers recorded by the tools during this request. */
  ledgerFactIds: readonly string[]
  /** Client fact ids the model asked for, when it submitted an artifact at all. */
  requestedClientFactIds?: readonly string[]
}

export type ClinicalDiagnostics = {
  recordFailure(report: ClinicalFailureReport): void
}

export function createConsoleDiagnostics(): ClinicalDiagnostics {
  return {
    recordFailure(report) {
      console.error('[clinical-agent] request failed', {
        requestId: report.requestId,
        reason: report.reason,
        attempts: report.attempts,
        toolLimitExceeded: report.toolLimitExceeded,
        ledgerFactIds: report.ledgerFactIds,
        requestedClientFactIds: report.requestedClientFactIds,
      })
    },
  }
}
