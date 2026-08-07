import 'server-only'

import type { Payload, PayloadRequest, Where } from 'payload'
import type { Product, Protocol } from '@/payload-types'

import type {
  ClinicalProductErrorCode, ProductDetails, ProductIdentityInput, ProtocolShareDecision,
  ProtocolShareInput, SafeResult, SearchData, SearchProductsInput,
} from './contracts'

export type ClinicalProductReader = Pick<Payload, 'find' | 'findByID'>

export type ClinicalProductRepository = {
  searchProducts(input: SearchProductsInput): Promise<SafeResult<SearchData>>
  getProductDetails(input: ProductIdentityInput): Promise<SafeResult<ProductDetails>>
  canShareProtocol(input: ProtocolShareInput): Promise<SafeResult<ProtocolShareDecision>>
}

function isValidSearchInput(input: unknown): input is SearchProductsInput {
  if (!input || typeof input !== 'object' || !('query' in input)) return false
  return typeof input.query === 'string' && input.query.trim().length > 0
}

function isValidIdentifier(value: unknown): value is number | string {
  return (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value))
}

function isValidProductIdentityInput(input: unknown): input is ProductIdentityInput {
  if (!input || typeof input !== 'object' || !('productId' in input) || !('presentationId' in input)) return false
  return isValidIdentifier(input.productId)
    && typeof input.presentationId === 'string'
    && input.presentationId.trim().length > 0
}

function isValidProtocolShareInput(input: unknown): input is ProtocolShareInput {
  return isValidProductIdentityInput(input)
    && 'protocolId' in input
    && isValidIdentifier(input.protocolId)
}

function isInternalUserRequest(req: PayloadRequest): boolean {
  return req.user?.collection === 'users'
}

function safeFailure<T>(code: ClinicalProductErrorCode): SafeResult<T> {
  return { ok: false, code }
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase()
}

function rank(value: string, query: string): number {
  const candidate = normalized(value)
  if (candidate === query) return 0
  if (candidate.startsWith(query)) return 1
  return candidate.includes(query) ? 2 : Number.POSITIVE_INFINITY
}

type DiscoveryCandidate = {
  score: number
  product: { id: string; canonicalName: string }
  presentation: { id: string; canonicalName: string }
}

const DISCOVERY_PAGE_SIZE = 21
const MAX_DISCOVERY_PAGES = 10

function compareCandidates(left: DiscoveryCandidate, right: DiscoveryCandidate): number {
  return left.score - right.score
    || left.product.canonicalName.localeCompare(right.product.canonicalName)
    || left.presentation.canonicalName.localeCompare(right.presentation.canonicalName)
    || left.product.id.localeCompare(right.product.id)
    || left.presentation.id.localeCompare(right.presentation.id)
}

function discoveryWhere(query: string): Where {
  return { and: [
    { validationStatus: { equals: 'APPROVED' as const } },
    { or: [
      { canonicalName: { contains: query } },
      { 'aliases.term': { contains: query } },
      { 'presentations.canonicalName': { contains: query } },
      { 'presentations.aliases.term': { contains: query } },
    ] },
  ] }
}

function discoveryCandidates(products: Product[], query: string) {
  const normalizedQuery = normalized(query)
  return products.flatMap((product) => {
    if (product.validationStatus !== 'APPROVED') return []
    const productRank = Math.min(
      rank(product.canonicalName, normalizedQuery),
      ...(product.aliases ?? []).map((alias) => rank(alias.term, normalizedQuery)),
    )
    return (product.presentations ?? []).flatMap((presentation) => {
      if (presentation.status !== 'activa' || !presentation.id) return []
      const presentationRank = Math.min(
        rank(presentation.canonicalName, normalizedQuery),
        ...(presentation.aliases ?? []).map((alias) => rank(alias.term, normalizedQuery)),
      )
      const score = Math.min(productRank, presentationRank)
      return Number.isFinite(score) ? [{
        score,
        product: { id: String(product.id), canonicalName: product.canonicalName },
        presentation: { id: presentation.id, canonicalName: presentation.canonicalName },
      }] : []
    })
  }).sort(compareCandidates)
}

const detailSelect = {
  canonicalName: true, description: true, productType: true, validationStatus: true,
  presentations: {
    canonicalName: true, status: true, characteristics: true, certifications: true, protocols: true,
  },
} as const
const detailPopulate = {
  protocols: { clientShareable: true, name: true, zones: true, routes: true, techniques: true },
} as const

function relationNames(records: Protocol['zones']): string[] {
  if (!records.every((record): record is Exclude<typeof record, number> => typeof record !== 'number')) throw new Error('ID_ONLY_RELATION')
  return records.map((record) => record.name)
}

function protocolSummary(record: number | Protocol) {
  if (typeof record === 'number') throw new Error('ID_ONLY_PROTOCOL')
  return {
    id: String(record.id), name: record.name,
    zones: relationNames(record.zones), routes: relationNames(record.routes),
    techniques: relationNames(record.techniques),
  }
}

export function createClinicalProductRepository(
  req: PayloadRequest,
  reader: ClinicalProductReader = req.payload,
): ClinicalProductRepository {
  async function readEligible({ productId, presentationId }: ProductIdentityInput) {
    const product = await reader.findByID({
      collection: 'products', id: productId, depth: 2, select: detailSelect,
      populate: detailPopulate, overrideAccess: false, disableErrors: true, req, user: req.user,
    })
    if (!product || product.validationStatus !== 'APPROVED') return null
    const presentation = product.presentations?.find((item) =>
      item.id === presentationId && item.status === 'activa')
    return presentation ? { product, presentation } : null
  }

  return {
    async searchProducts(input) {
      if (!isValidSearchInput(input)) return safeFailure('INVALID_REQUEST')

      if (!isInternalUserRequest(req)) return safeFailure('UNAUTHORIZED')

      try {
        const query = input.query.trim()
        const products: Product[] = []
        let hasMore = true
        let page = 1
        while (hasMore && page <= MAX_DISCOVERY_PAGES) {
          const result = await reader.find({
            collection: 'products',
            depth: 0,
            limit: DISCOVERY_PAGE_SIZE,
            page,
            sort: 'id',
            overrideAccess: false,
            req,
            user: req.user,
            where: discoveryWhere(query),
          })
          products.push(...result.docs)
          hasMore = result.hasNextPage
          page += 1
        }

        const candidates = discoveryCandidates(products, query)
        if (candidates.length === 0) {
          if (hasMore) return safeFailure('TEMPORARY_FAILURE')
          return products.length === 0
            ? { ok: true, data: { kind: 'empty' } }
            : safeFailure('UNAVAILABLE')
        }
        if (candidates.length === 1 && !hasMore) {
          const { product, presentation } = candidates[0]
          return { ok: true, data: { kind: 'match', product, presentation } }
        }
        return {
          ok: true,
          data: {
            kind: 'clarification',
            choices: candidates.slice(0, 20).map(({ product, presentation }) => ({ product, presentation })),
            truncated: hasMore || candidates.length > 20,
          },
        }
      } catch {
        return safeFailure('TEMPORARY_FAILURE')
      }
    },
    async getProductDetails(input) {
      if (!isValidProductIdentityInput(input)) return safeFailure('INVALID_REQUEST')

      if (!isInternalUserRequest(req)) return safeFailure('UNAUTHORIZED')
      try {
        const eligible = await readEligible(input)
        if (!eligible) return safeFailure('UNAVAILABLE')
        const { product, presentation } = eligible
        return { ok: true, data: {
          product: {
            id: String(product.id), canonicalName: product.canonicalName,
            description: product.description ?? null, productType: product.productType ?? null,
          },
          presentation: {
            id: presentation.id!, canonicalName: presentation.canonicalName,
            characteristics: presentation.characteristics ?? null,
            certifications: presentation.certifications ?? null,
            protocols: (presentation.protocols ?? []).map(protocolSummary),
          },
        } }
      } catch {
        return safeFailure('TEMPORARY_FAILURE')
      }
    },
    async canShareProtocol(input) {
      if (!isValidProtocolShareInput(input)) return safeFailure('INVALID_REQUEST')

      if (!isInternalUserRequest(req)) return safeFailure('UNAUTHORIZED')
      try {
        const eligible = await readEligible(input)
        const protocol = eligible?.presentation.protocols?.find((record) =>
          typeof record !== 'number' && String(record.id) === String(input.protocolId))
        return { ok: true, data: { shareable: Boolean(
          protocol && typeof protocol !== 'number' && protocol.clientShareable,
        ) } }
      } catch {
        return safeFailure('TEMPORARY_FAILURE')
      }
    },
  }
}
