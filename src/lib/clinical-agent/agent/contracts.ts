import type { ProductDetails, ProtocolSummary, SafeResult, SearchData } from '../contracts'

export const clinicalAgentLimits = {
  maxOutputTokens: 4096,
  maxSteps: 12,
  maxToolCalls: 8,
  maxDetailCalls: 4,
  totalTimeoutMs: 150_000,
  firstPartTimeoutMs: 45_000,
  toolTimeoutMs: 30_000,
} as const

/**
 * Every successful result carries the `factId` under which the payload was recorded
 * in the ledger. Those exact strings are the only values a ClinicalArtifact may
 * reference — the model cannot derive them, so the tools must hand them back.
 *
 * Shareability resolves inside `getProductDetails` rather than through a separate
 * tool, which keeps the tool budget flat regardless of how many protocols a
 * presentation has.
 */
export type ClinicalToolset = {
  searchProducts(input: { query: string }): Promise<SafeResult<{ factId: string; search: SearchData }>>
  getProductDetails(input: { productId: string | number; presentationId: string }): Promise<SafeResult<{
    factId: string
    details: ProductDetails
    clientShareableProtocols: readonly { protocolId: string; factId: string }[]
  }>>
}

export type ClinicalFact = {
  id: string
  audience: 'internal' | 'client'
  kind: 'search' | 'details' | 'protocol'
  value: SearchData | ProductDetails | ProtocolSummary
}

export type ClinicalArtifact = {
  internalFactIds: string[]
  clientFactIds: string[]
}

/**
 * The artifact carries the validated facts themselves, not rendered text: presenting
 * clinical data is the UI's job, and a pre-rendered string cannot be laid out,
 * styled per field, or partially copied. Only facts the artifact allowlisted are
 * included, so the audience boundary still holds at this edge.
 */
export type ClinicalAgentEvent =
  | { type: 'status'; status: 'processing' }
  | { type: 'artifact'; internal: readonly ClinicalFact[]; client: readonly ClinicalFact[] }
  | { type: 'error'; message: string }

function isArtifact(value: unknown): value is ClinicalArtifact {
  if (!value || typeof value !== 'object') return false
  const artifact = value as Record<string, unknown>
  return Array.isArray(artifact.internalFactIds)
    && Array.isArray(artifact.clientFactIds)
    && artifact.internalFactIds.every((id) => typeof id === 'string')
    && artifact.clientFactIds.every((id) => typeof id === 'string')
}

export function validateClinicalArtifact(value: unknown, facts: readonly ClinicalFact[]): ClinicalArtifact | undefined {
  if (!isArtifact(value)) return undefined
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const internalValid = value.internalFactIds.every((id) => byId.get(id)?.audience === 'internal')
  const clientValid = value.clientFactIds.every((id) => {
    const fact = byId.get(id)
    return fact?.audience === 'client' && fact.kind === 'protocol'
  })
  return internalValid && clientValid ? value : undefined
}

export function selectClinicalArtifactFacts(artifact: ClinicalArtifact, facts: readonly ClinicalFact[]): ClinicalAgentEvent {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const select = (ids: readonly string[]) => ids
    .map((id) => byId.get(id))
    .filter((fact): fact is ClinicalFact => fact !== undefined)
  return {
    type: 'artifact',
    internal: select(artifact.internalFactIds),
    client: select(artifact.clientFactIds),
  }
}
