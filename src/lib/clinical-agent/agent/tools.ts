import type { PayloadRequest } from 'payload'

import type { ClinicalProductReader } from '../repository'
import { createClinicalProductRepository } from '../repository'
import type { ProductDetails, ProtocolSummary, SafeResult, SearchData } from '../contracts'
import { clinicalAgentLimits, type ClinicalFact, type ClinicalToolset } from './contracts'

export type ClinicalAgentTimers = {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(timer: unknown): void
}

type ToolOptions = {
  req: PayloadRequest
  reader?: ClinicalProductReader
  timers?: ClinicalAgentTimers
}

function defaultTimers(): ClinicalAgentTimers {
  return { setTimeout, clearTimeout }
}

function temporaryFailure<T>(): SafeResult<T> {
  return { ok: false, code: 'TEMPORARY_FAILURE' }
}

function protocolId(productId: string | number, presentationId: string, protocolIdValue: string | number): string {
  return `protocol:${productId}:${presentationId}:${protocolIdValue}`
}

export function createClinicalTools({ req, reader, timers = defaultTimers() }: ToolOptions) {
  const source = createClinicalProductRepository(req, reader)
  const facts: ClinicalFact[] = []
  let totalCalls = 0
  let detailCalls = 0
  let limitExceeded = false

  async function withinToolDeadline<T>(operation: () => Promise<SafeResult<T>>): Promise<SafeResult<T>> {
    let timer: unknown
    const timeout = new Promise<SafeResult<T>>((resolve) => {
      timer = timers.setTimeout(() => resolve(temporaryFailure<T>()), clinicalAgentLimits.toolTimeoutMs)
    })
    try {
      return await Promise.race([operation().catch(() => temporaryFailure<T>()), timeout])
    } finally {
      timers.clearTimeout(timer)
    }
  }

  function admit(detail = false): boolean {
    if (totalCalls >= clinicalAgentLimits.maxToolCalls || (detail && detailCalls >= clinicalAgentLimits.maxDetailCalls)) {
      limitExceeded = true
      return false
    }
    totalCalls += 1
    if (detail) detailCalls += 1
    return true
  }

  type SearchPayload = { factId: string; search: SearchData }
  type DetailsPayload = {
    factId: string
    details: ProductDetails
    clientShareableProtocols: readonly { protocolId: string; factId: string }[]
  }

  const tools: ClinicalToolset = {
    async searchProducts(input) {
      if (!admit()) return temporaryFailure<SearchPayload>()
      const result = await withinToolDeadline(() => source.searchProducts(input))
      if (!result.ok) return result
      const factId = `search:${facts.length}`
      facts.push({ id: factId, audience: 'internal', kind: 'search', value: result.data })
      return { ok: true, data: { factId, search: result.data } }
    },
    async getProductDetails(input) {
      if (!admit(true)) return temporaryFailure<DetailsPayload>()

      type Resolved = { details: ProductDetails; shareable: readonly ProtocolSummary[] }
      const outcome = await withinToolDeadline<Resolved>(async () => {
        const detail = await source.getProductDetails(input)
        if (!detail.ok) return detail
        const checks = await Promise.all(detail.data.presentation.protocols.map(async (protocol) => ({
          protocol,
          decision: await source.canShareProtocol({
            productId: input.productId, presentationId: input.presentationId, protocolId: protocol.id,
          }),
        })))
        // Fail closed if any protocol is unverifiable rather than reporting it as
        // "not shareable" — that would turn a transient fault into a definitive
        // negative clinical decision.
        const failed = checks.find((check) => !check.decision.ok)
        if (failed && !failed.decision.ok) return { ok: false as const, code: failed.decision.code }
        return {
          ok: true as const,
          data: {
            details: detail.data,
            shareable: checks.filter((check) => check.decision.ok && check.decision.data.shareable).map((check) => check.protocol),
          },
        }
      })
      if (!outcome.ok) return outcome

      const factId = `details:${input.productId}:${input.presentationId}`
      facts.push({ id: factId, audience: 'internal', kind: 'details', value: outcome.data.details })
      const clientShareableProtocols = outcome.data.shareable.map((protocol) => {
        const id = protocolId(input.productId, input.presentationId, protocol.id)
        facts.push({ id, audience: 'client', kind: 'protocol', value: protocol })
        return { protocolId: protocol.id, factId: id }
      })
      return { ok: true, data: { factId, details: outcome.data.details, clientShareableProtocols } }
    },
  }

  return { ...tools, ledger: { snapshot: () => [...facts] }, hasLimitExceeded: () => limitExceeded }
}
