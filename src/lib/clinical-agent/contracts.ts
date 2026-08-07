export type ClinicalProductErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'UNAVAILABLE'
  | 'TEMPORARY_FAILURE'

export type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ClinicalProductErrorCode }

export type SearchProductsInput = {
  query: string
}

export type ProductSummary = {
  id: string
  canonicalName: string
}

export type PresentationSummary = {
  id: string
  canonicalName: string
}

export type ClarificationChoice = {
  product: ProductSummary
  presentation?: PresentationSummary
}

export type SearchData =
  | { kind: 'empty' }
  | { kind: 'match'; product: ProductSummary; presentation: PresentationSummary }
  | { kind: 'clarification'; choices: ClarificationChoice[]; truncated: boolean }

export type ProductIdentityInput = { productId: number | string; presentationId: string }
export type ProtocolShareInput = ProductIdentityInput & { protocolId: number | string }

export type ProtocolSummary = {
  id: string
  name: string
  zones: string[]
  routes: string[]
  techniques: string[]
  visibleEffectsOnset?: string
  effectDuration?: string
  recommendedDose?: string
  injectionDepth?: string
  sessionsMin?: number
  sessionsMax?: number
  frequency?: string
}

export type ProductDetails = {
  product: ProductSummary & {
    description: string | null
    productType: string | null
    laboratory: string
    activeIngredients?: string[]
  }
  presentation: PresentationSummary & {
    characteristics: string | null
    certifications: string | null
    contraindications?: Array<{ description: string; type: 'absoluta' | 'relativa' }>
    adverseEffects?: string[]
    clinicalIndications?: string[]
    postCareNotes?: string[]
    safetyWarnings?: string[]
    reconstitution?: { diluentType?: string; volumeMl?: number; instructions?: string }
    protocols: ProtocolSummary[]
  }
}

export type ProtocolShareDecision = { shareable: boolean }
