import type { ProductDetails, ProtocolSummary, SafeResult, SearchData } from '../contracts'
import type { ProductDetailField } from './detailFields'

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
 * Every successful result carries the `factId`(s) under which the payload was recorded
 * in the ledger. Those exact strings are the only values a ClinicalArtifact may
 * reference — the model cannot derive them, so the tools must hand them back.
 *
 * `getProductDetails` splits the sheet into one fact per field group (`fields`) instead
 * of one fact for the whole thing, so the model can point at exactly the group a scoped
 * question asked about. Shareability still resolves inline rather than through a
 * separate tool, which keeps the tool budget flat regardless of how many protocols a
 * presentation has.
 */
export type ClinicalToolset = {
  searchProducts(input: { query: string }): Promise<SafeResult<{ factId: string; search: SearchData }>>
  getProductDetails(input: { productId: string | number; presentationId: string }): Promise<SafeResult<{
    details: ProductDetails
    fields: readonly { group: ProductDetailField; factId: string; clientEligible: boolean }[]
    clientShareableProtocols: readonly { protocolId: string; factId: string }[]
  }>>
}

export type ClinicalFact = {
  id: string
  audience: 'internal' | 'client'
  kind: 'search' | 'details' | 'protocol'
  /** Whether this exact fact may legally appear in `clientFactIds`, set once at creation. */
  clientEligible: boolean
  /** Which field group a `details` fact carries; absent for `search`/`protocol` facts. */
  group?: ProductDetailField
  value: SearchData | ProductDetails | ProtocolSummary
}

/**
 * What the model submits.
 *
 * `internalFactIds` is optional: omitted, every internal fact gathered is shown (a
 * generic question — "tell me about X" — still gets the full sheet, no selection
 * needed). Provided, it acts as an allowlist that narrows the vendor's own panel to
 * exactly the fields a scoped question asked about. The allowlist shape — opt in to
 * narrow, rather than always enumerate — exists because asking a model to copy back
 * every gathered id on every generic answer is clerical work it does incompletely;
 * only the narrowing case needs it to actually decide something.
 *
 * `clientFactIds` is the one side that was always a judgement call: which facts, if
 * any, are appropriate to show the patient. No longer only protocols — any fact whose
 * `clientEligible` is true is a legal choice.
 */
export type SubmittedArtifact = {
  clientFactIds: string[]
  internalFactIds?: string[]
}

/** The validated artifact: client ids checked, internal ids derived from the ledger. */
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string')
}

function isSubmittedArtifact(value: unknown): value is SubmittedArtifact {
  if (!value || typeof value !== 'object') return false
  const artifact = value as Record<string, unknown>
  if (!isStringArray(artifact.clientFactIds)) return false
  if (artifact.internalFactIds === undefined) return true
  return isStringArray(artifact.internalFactIds)
}

export function validateClinicalArtifact(value: unknown, facts: readonly ClinicalFact[]): ClinicalArtifact | undefined {
  if (!isSubmittedArtifact(value)) return undefined

  // Everything the tools actually recorded for this request, regardless of selection.
  const gatheredInternalFactIds = facts.filter((fact) => fact.audience === 'internal').map((fact) => fact.id)
  // A run that gathered nothing is not an answer. Without this guard it would reach
  // the UI as a successful response with no content.
  if (gatheredInternalFactIds.length === 0) return undefined

  const byId = new Map(facts.map((fact) => [fact.id, fact]))

  let internalFactIds: string[]
  if (value.internalFactIds === undefined) {
    // Omitted: generic question, show everything gathered — the safe default needs
    // no model judgement.
    internalFactIds = gatheredInternalFactIds
  } else {
    // Provided: scoped question, an allowlist that must resolve to real internal facts.
    const internalValid = value.internalFactIds.every((id) => byId.get(id)?.audience === 'internal')
    if (!internalValid) return undefined
    internalFactIds = [...new Set(value.internalFactIds)]
  }

  const clientValid = value.clientFactIds.every((id) => byId.get(id)?.clientEligible === true)
  if (!clientValid) return undefined

  return { internalFactIds, clientFactIds: [...new Set(value.clientFactIds)] }
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
