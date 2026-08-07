import {
  clinicalAgentLimits,
  renderClinicalArtifact,
  validateClinicalArtifact,
  type ClinicalAgentEvent,
  type ClinicalFact,
  type ClinicalToolset,
} from './contracts'
import { clinicalAgentModel, isRetryableGatewayFailure, type ClinicalGateway } from './gateway'
import { buildClinicalAgentPrompt } from './prompt'

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
}

type RunOptions = {
  onEvent(event: ClinicalAgentEvent): void
  abortSignal?: AbortSignal
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
}: OrchestratorOptions) {
  return {
    async run({ onEvent, abortSignal }: RunOptions): Promise<{ ok: true } | { ok: false; code: 'TEMPORARY_FAILURE' }> {
      const requestId = createRequestId()
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

      try {
        if (abortSignal?.aborted) {
          abort()
          throw new Error('ABORTED')
        }
        for (let attempt = 0; attempt < 2; attempt += 1) {
          let receivedPart = false
          let iterator: AsyncIterator<import('./gateway').GatewayPart> | undefined
          try {
            const stream = gateway.stream({
              model: clinicalAgentModel,
              prompt: buildClinicalAgentPrompt(),
              tools,
              limits: clinicalAgentLimits,
              abortSignal: controller.signal,
            })
            iterator = stream[Symbol.asyncIterator]()
            const firstPartDeadline = new Promise<void>((resolve) => {
              firstPartTimer = timers.setTimeout(() => {
                firstPartExpired = true
                controller.abort()
                resolve()
              }, clinicalAgentLimits.firstPartTimeoutMs)
            })

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
              const artifact = validateClinicalArtifact(part.artifact, tools.ledger.snapshot())
              if (!artifact) throw new Error('INVALID_ARTIFACT')
              onEvent(renderClinicalArtifact(artifact, tools.ledger.snapshot()))
              return { ok: true }
            }
          } catch (error) {
            if (attempt === 0 && !receivedPart && !totalExpired && !firstPartExpired && !abortSignal?.aborted && isRetryableGatewayFailure(error)) {
              continue
            }
            throw error
          } finally {
            timers.clearTimeout(firstPartTimer)
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
      } catch {
        onEvent(errorEvent(requestId))
        return { ok: false, code: 'TEMPORARY_FAILURE' }
      } finally {
        timers.clearTimeout(totalTimer)
        abortSignal?.removeEventListener('abort', abort)
      }
    },
  }
}
