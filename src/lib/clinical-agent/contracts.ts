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
}

export type ProductDetails = {
  product: ProductSummary & { description: string | null; productType: string | null }
  presentation: PresentationSummary & {
    characteristics: string | null
    certifications: string | null
    protocols: ProtocolSummary[]
  }
}

export type ProtocolShareDecision = { shareable: boolean }
