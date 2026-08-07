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

export type ClinicalToolset = {
  searchProducts(input: { query: string }): Promise<SafeResult<SearchData>>
  getProductDetails(input: { productId: string | number; presentationId: string }): Promise<SafeResult<ProductDetails>>
  canShareProtocol(input: { productId: string | number; presentationId: string; protocolId: string | number }): Promise<SafeResult<{ shareable: boolean }>>
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

export type ClinicalAgentEvent =
  | { type: 'status'; status: 'processing' }
  | { type: 'artifact'; internal: string; client: string }
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

export function renderClinicalArtifact(artifact: ClinicalArtifact, facts: readonly ClinicalFact[]): ClinicalAgentEvent {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const render = (ids: readonly string[], label: string) => `${label}\n${ids.map((id) => JSON.stringify(byId.get(id)?.value)).join('\n')}`
  return {
    type: 'artifact',
    internal: render(artifact.internalFactIds, 'Internal clinical facts:'),
    client: render(artifact.clientFactIds, 'Client-shareable facts:'),
  }
}
