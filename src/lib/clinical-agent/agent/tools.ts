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

  const tools: ClinicalToolset = {
    async searchProducts(input) {
      if (!admit()) return temporaryFailure<SearchData>()
      const result = await withinToolDeadline(() => source.searchProducts(input))
      if (result.ok) facts.push({ id: `search:${facts.length}`, audience: 'internal', kind: 'search', value: result.data })
      return result
    },
    async getProductDetails(input) {
      if (!admit(true)) return temporaryFailure<ProductDetails>()
      const result = await withinToolDeadline(() => source.getProductDetails(input))
      if (result.ok) {
        facts.push({
          id: `details:${input.productId}:${input.presentationId}`,
          audience: 'internal', kind: 'details', value: result.data,
        })
      }
      return result
    },
    async canShareProtocol(input) {
      if (!admit()) return temporaryFailure<{ shareable: boolean }>()
      const result = await withinToolDeadline(() => source.canShareProtocol(input))
      if (!result.ok || !result.data.shareable) return result

      const detail = facts.find((fact) => fact.id === `details:${input.productId}:${input.presentationId}`)
      const productDetails = detail?.kind === 'details' ? detail.value as ProductDetails : undefined
      const protocol = productDetails?.presentation.protocols.find((candidate) => candidate.id === String(input.protocolId))
      if (protocol) {
        facts.push({
          id: protocolId(input.productId, input.presentationId, input.protocolId),
          audience: 'client', kind: 'protocol', value: protocol as ProtocolSummary,
        })
      }
      return result
    },
  }

  return { ...tools, ledger: { snapshot: () => [...facts] }, hasLimitExceeded: () => limitExceeded }
}
