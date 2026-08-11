import {
  clinicalAgentLimits,
  selectClinicalArtifactFacts,
  validateClinicalArtifact,
  type ClinicalAgentEvent,
  type ClinicalFact,
  type ClinicalToolset,
} from './contracts'
import { createConsoleDiagnostics, failureReasonOf, type ClinicalDiagnostics } from './diagnostics'
import { clinicalAgentModel, isRetryableGatewayFailure, type ClinicalGateway } from './gateway'
import { buildClinicalAgentPrompt } from './prompt'
import type { ClinicalUserMessage } from './gateway'

export { clinicalAgentLimits }
export type { ClinicalAgentEvent }

type OrchestratorTimers = {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(timer: unknown): void
}

type OrchestratorOptions = {
  gateway: ClinicalGateway
  tools: ClinicalToolset & { ledger: { snapshot(): readonly ClinicalFact[] }; hasLimitExceeded(): boolean }
  now?: () => number
  timers?: OrchestratorTimers
  createRequestId?: () => string
  diagnostics?: ClinicalDiagnostics
}

type RunOptions = {
  onEvent(event: ClinicalAgentEvent): void
  abortSignal?: AbortSignal
  messages?: readonly ClinicalUserMessage[]
}

function defaultTimers(): OrchestratorTimers {
  return { setTimeout, clearTimeout }
}

function errorEvent(requestId: string): ClinicalAgentEvent {
  return { type: 'error', message: `Unable to complete the clinical response. Reference: ${requestId}` }
}

export function createClinicalOrchestrator({
  gateway,
  tools,
  now = Date.now,
  timers = defaultTimers(),
  createRequestId = () => crypto.randomUUID(),
  diagnostics = createConsoleDiagnostics(),
}: OrchestratorOptions) {
  return {
    async run({ onEvent, abortSignal, messages = [] }: RunOptions): Promise<{ ok: true } | { ok: false; code: 'TEMPORARY_FAILURE' }> {
      const requestId = createRequestId()
      let attempts = 0
      let submittedClientFactIds: readonly string[] | undefined
      const controller = new AbortController()
      let rejectExternalAbort: ((error: Error) => void) | undefined
      const externalAbort = abortSignal && !abortSignal.aborted
        ? new Promise<never>((_resolve, reject) => { rejectExternalAbort = reject })
        : undefined
      const abort = () => {
        controller.abort()
        rejectExternalAbort?.(new Error('ABORTED'))
      }
      abortSignal?.addEventListener('abort', abort, { once: true })
      let totalTimer: unknown
      let firstPartTimer: unknown
      let totalExpired = false
      let firstPartExpired = false
      const startedAt = now()
      const totalDeadline = new Promise<void>((resolve) => {
        totalTimer = timers.setTimeout(() => {
          totalExpired = true
          controller.abort()
          resolve()
        }, clinicalAgentLimits.totalTimeoutMs)
      })
      const firstPartDeadline = new Promise<void>((resolve) => {
        firstPartTimer = timers.setTimeout(() => {
          firstPartExpired = true
          controller.abort()
          resolve()
        }, clinicalAgentLimits.firstPartTimeoutMs)
      })

      try {
        if (abortSignal?.aborted) {
          abort()
          throw new Error('ABORTED')
        }
        for (let attempt = 0; attempt < 2; attempt += 1) {
          attempts += 1
          let receivedPart = false
          let iterator: AsyncIterator<import('./gateway').GatewayPart> | undefined
          try {
            const stream = gateway.stream({
              model: clinicalAgentModel,
              prompt: buildClinicalAgentPrompt(),
              messages,
              tools,
              limits: clinicalAgentLimits,
              abortSignal: controller.signal,
            })
            iterator = stream[Symbol.asyncIterator]()
            while (true) {
              if (now() - startedAt >= clinicalAgentLimits.totalTimeoutMs) {
                totalExpired = true
                controller.abort()
                throw new Error('TOTAL_TIMEOUT')
              }
              const next = await Promise.race<IteratorResult<import('./gateway').GatewayPart> | { timedOut: true }>([
                iterator.next(),
                externalAbort ?? new Promise<never>(() => undefined),
                totalDeadline.then(() => ({ timedOut: true as const })),
                receivedPart
                  ? new Promise<{ timedOut: true }>(() => undefined)
                  : firstPartDeadline.then(() => ({ timedOut: true as const })),
              ])
              if ('timedOut' in next) throw new Error('TIMEOUT')
              if (totalExpired || firstPartExpired || abortSignal?.aborted || controller.signal.aborted) throw new Error('ABORTED')
              if (next.done) throw new Error('INCOMPLETE_STREAM')
              const part = next.value
              if (part.type === 'part') {
                if (!receivedPart) {
                  receivedPart = true
                  timers.clearTimeout(firstPartTimer)
                  onEvent({ type: 'status', status: 'processing' })
                }
                continue
              }
              if (tools.hasLimitExceeded() || part.steps > clinicalAgentLimits.maxSteps || part.outputTokens > clinicalAgentLimits.maxOutputTokens) {
                throw new Error('LIMIT_EXCEEDED')
              }
              const submitted = part.artifact as { clientFactIds?: unknown } | undefined
              if (Array.isArray(submitted?.clientFactIds)) {
                submittedClientFactIds = submitted.clientFactIds.filter((id): id is string => typeof id === 'string')
              }
              const artifact = validateClinicalArtifact(part.artifact, tools.ledger.snapshot())
              if (!artifact) throw new Error('INVALID_ARTIFACT')
              onEvent(selectClinicalArtifactFacts(artifact, tools.ledger.snapshot()))
              return { ok: true }
            }
          } catch (error) {
            if (attempt === 0 && !receivedPart && !totalExpired && !firstPartExpired && !abortSignal?.aborted && isRetryableGatewayFailure(error)) {
              continue
            }
            throw error
          } finally {
            if (controller.signal.aborted) {
              try {
                void iterator?.return?.().catch(() => undefined)
              } catch {
                // A non-cooperative iterator cannot block safe cancellation.
              }
            }
          }
        }
        throw new Error('RETRY_EXHAUSTED')
      } catch (error) {
        diagnostics.recordFailure({
          requestId,
          reason: failureReasonOf(error),
          attempts,
          toolLimitExceeded: tools.hasLimitExceeded(),
          ledgerFactIds: tools.ledger.snapshot().map((fact) => fact.id),
          requestedClientFactIds: submittedClientFactIds,
        })
        onEvent(errorEvent(requestId))
        return { ok: false, code: 'TEMPORARY_FAILURE' }
      } finally {
        timers.clearTimeout(firstPartTimer)
        timers.clearTimeout(totalTimer)
        abortSignal?.removeEventListener('abort', abort)
      }
    },
  }
}
