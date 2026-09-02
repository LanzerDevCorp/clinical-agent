import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import type { Product } from '@/payload-types'
import {
  createClinicalProductRepository,
  type ClinicalProductReader,
} from '@/lib/clinical-agent/repository'

const internalUser = {
  id: 17,
  collection: 'users',
} as const

const pendingProduct = {
  id: 41,
  canonicalName: 'RAW-PENDING-SENTINEL',
  validationStatus: 'PENDING',
  presentations: [{ id: 'pending-presentation', canonicalName: 'Pending', status: 'activa' }],
} as Product

const approvedWithoutActivePresentation = {
  id: 42,
  canonicalName: 'RAW-INACTIVE-SENTINEL',
  validationStatus: 'APPROVED',
  presentations: [{ id: 'inactive-presentation', canonicalName: 'Inactive', status: 'descontinuada' }],
} as Product

function approvedProduct(
  id: number,
  canonicalName: string,
  presentations: Array<{ id: string; canonicalName: string; aliases?: { term: string }[] }>,
  aliases: { term: string }[] = [],
): Product {
  return {
    id,
    canonicalName,
    aliases,
    validationStatus: 'APPROVED',
    presentations: presentations.map((presentation) => ({ ...presentation, status: 'activa' })),
  } as Product
}

function createHarness(options: {
  docs?: Product[]
  pages?: Product[][]
  error?: Error
  detail?: Product
  detailError?: Error
  user?: { collection: string; id?: number } | undefined
} = {}) {
  const { docs = [], pages = [docs], error, detail, detailError } = options
  const user = 'user' in options ? options.user : internalUser
  const find = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockImplementation(({ page = 1 }: { page?: number }) => Promise.resolve({
      docs: pages[page - 1] ?? [],
      hasNextPage: page < pages.length,
    }))
  const findByID = detailError
    ? vi.fn().mockRejectedValue(detailError)
    : vi.fn().mockResolvedValue(detail)
  const legacySource = vi.fn()
  const reader = { find, findByID, legacySource } as unknown as ClinicalProductReader
  const req = { payload: reader, user } as unknown as PayloadRequest

  return {
    find,
    findByID,
    legacySource,
    repository: createClinicalProductRepository(req, reader),
    req,
  }
}

describe('ClinicalProductRepository safe contract', () => {
  it.each([
    ['missing', undefined],
    ['non-string', 42],
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('rejects a %s query without reading clinical data', async (_scenario, query) => {
    const { find, findByID, repository } = createHarness()

    await expect(repository.searchProducts({ query } as never)).resolves.toEqual({
      ok: false,
      code: 'INVALID_REQUEST',
    })
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it.each([
    ['unauthenticated request', undefined],
    ['non-user identity', { id: 9, collection: 'payload-mcp-api-keys' }],
  ])('denies a %s without reading clinical data', async (_scenario, user) => {
    const { find, findByID, repository } = createHarness({ user })

    await expect(repository.searchProducts({ query: 'product' })).resolves.toEqual({
      ok: false,
      code: 'UNAUTHORIZED',
    })
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it('normalizes reader errors without exposing details or consulting a legacy source', async () => {
    const { find, findByID, legacySource, repository } = createHarness({
      error: new Error('DATABASE-URL-AND-STACK-SENTINEL'),
    })

    const result = await repository.searchProducts({ query: 'product' })

    expect(result).toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(JSON.stringify(result)).not.toContain('DATABASE-URL-AND-STACK-SENTINEL')
    expect(find).toHaveBeenCalledOnce()
    expect(findByID).not.toHaveBeenCalled()
    expect(legacySource).not.toHaveBeenCalled()
  })

  it('maps an approved product without an active presentation to UNAVAILABLE without returning raw data', async () => {
    const { find, repository, req } = createHarness({ docs: [approvedWithoutActivePresentation] })

    const result = await repository.searchProducts({ query: 'inactive-sentinel' })

    expect(result).toEqual({ ok: false, code: 'UNAVAILABLE' })
    expect(JSON.stringify(result)).not.toContain(approvedWithoutActivePresentation.canonicalName)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'products',
      overrideAccess: true,
      req,
      user: internalUser,
    }))
  })

  it('reports a pending product as absent even when its name matches the query', async () => {
    const { repository } = createHarness({ docs: [pendingProduct] })

    const result = await repository.searchProducts({ query: 'pending-sentinel' })

    expect(result).toEqual({ ok: true, data: { kind: 'empty' } })
    expect(JSON.stringify(result)).not.toContain(pendingProduct.canonicalName)
  })
})

describe('ClinicalProductRepository discovery', () => {
  it('matches canonical, alias, presentation, and partial names with bounded query options', async () => {
    const cases = [
      ['alp', approvedProduct(1, 'Alpha Product', [{ id: 'vial', canonicalName: 'Vial' }])],
      ['skin alias', approvedProduct(2, 'Beta', [{ id: 'ampoule', canonicalName: 'Ampoule' }], [{ term: 'Skin Alias' }])],
      ['syringe', approvedProduct(3, 'Gamma', [{ id: 'syringe', canonicalName: 'Syringe 1ml' }])],
      ['presentation alias', approvedProduct(4, 'Delta', [{ id: 'box', canonicalName: 'Box', aliases: [{ term: 'Presentation Alias' }] }])],
    ] as const
    expect(cases).toHaveLength(4)

    for (const [query, product] of cases) {
      const { find, repository, req } = createHarness({ docs: [product] })
      await expect(repository.searchProducts({ query })).resolves.toEqual({
        ok: true,
        data: {
          kind: 'match',
          product: { id: String(product.id), canonicalName: product.canonicalName },
          presentation: { id: product.presentations![0].id, canonicalName: product.presentations![0].canonicalName },
        },
      })
      expect(find).toHaveBeenCalledWith({
        collection: 'products',
        depth: 0,
        limit: 21,
        page: 1,
        sort: 'id',
        overrideAccess: true,
        req,
        user: internalUser,
        where: { validationStatus: { equals: 'APPROVED' } },
      })
    }
  })

  it('matches a query whose accents differ from the stored name', async () => {
    const product = approvedProduct(5, 'Centella Asiática', [{ id: 'vial', canonicalName: 'Vial' }])
    const { repository } = createHarness({ docs: [product] })

    await expect(repository.searchProducts({ query: 'Centella Asiatica' })).resolves.toEqual({
      ok: true,
      data: {
        kind: 'match',
        product: { id: '5', canonicalName: 'Centella Asiática' },
        presentation: { id: 'vial', canonicalName: 'Vial' },
      },
    })
  })

  it('returns deterministic clarification for ambiguous products and presentations', async () => {
    const beta = approvedProduct(2, 'Beta', [{ id: 'beta-vial', canonicalName: 'Vial' }], [{ term: 'shared' }])
    const alpha = approvedProduct(1, 'Alpha', [{ id: 'alpha-vial', canonicalName: 'Vial' }], [{ term: 'shared' }])
    const products = createHarness({ docs: [beta, alpha] }).repository
    await expect(products.searchProducts({ query: 'shared' })).resolves.toMatchObject({
      ok: true, data: { kind: 'clarification', truncated: false, choices: [
        { product: { id: '1', canonicalName: 'Alpha' } },
        { product: { id: '2', canonicalName: 'Beta' } },
      ] },
    })

    const multi = approvedProduct(3, 'Multi', [{ id: 'zeta', canonicalName: 'Zeta' }, { id: 'alpha', canonicalName: 'Alpha' }])
    const presentations = createHarness({ docs: [multi] }).repository
    await expect(presentations.searchProducts({ query: 'multi' })).resolves.toMatchObject({
      ok: true, data: { kind: 'clarification', truncated: false, choices: [
        { presentation: { id: 'alpha', canonicalName: 'Alpha' } },
        { presentation: { id: 'zeta', canonicalName: 'Zeta' } },
      ] },
    })
  })

  it('reads beyond inactive first-page rows before deciding a match is unique', async () => {
    const inactive = Array.from({ length: 20 }, (_, index) => ({
      ...approvedWithoutActivePresentation,
      id: index + 1,
      canonicalName: `Shared inactive ${index + 1}`,
      presentations: [{
        id: `inactive-${index + 1}`,
        canonicalName: 'Shared inactive',
        status: 'descontinuada' as const,
      }],
    })) as Product[]
    const firstMatch = approvedProduct(21, 'Shared Alpha', [{ id: 'alpha', canonicalName: 'Vial' }])
    const laterMatch = approvedProduct(22, 'Shared Beta', [{ id: 'beta', canonicalName: 'Vial' }])
    const { find, repository } = createHarness({ pages: [[...inactive, firstMatch], [laterMatch]] })

    await expect(repository.searchProducts({ query: 'shared' })).resolves.toMatchObject({
      ok: true,
      data: {
        kind: 'clarification',
        truncated: false,
        choices: [
          { product: { id: '21', canonicalName: 'Shared Alpha' } },
          { product: { id: '22', canonicalName: 'Shared Beta' } },
        ],
      },
    })
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('caps discovery reads and marks a known match as uncertain when pages remain', async () => {
    const match = approvedProduct(1, 'Shared match', [{ id: 'match', canonicalName: 'Vial' }])
    const inactivePages = Array.from({ length: 10 }, (_, index) => [{
      ...approvedWithoutActivePresentation,
      id: index + 2,
      canonicalName: `Shared inactive ${index + 2}`,
    } as Product])
    const { find, repository } = createHarness({ pages: [[match], ...inactivePages] })

    await expect(repository.searchProducts({ query: 'shared' })).resolves.toMatchObject({
      ok: true,
      data: {
        kind: 'clarification',
        choices: [{ product: { id: '1', canonicalName: 'Shared match' } }],
        truncated: true,
      },
    })
    expect(find).toHaveBeenCalledTimes(10)
  })

  it('returns a stable empty result when Payload finds no eligible match', async () => {
    const { repository } = createHarness()
    await expect(repository.searchProducts({ query: 'missing' }))
      .resolves.toEqual({ ok: true, data: { kind: 'empty' } })
  })
})

describe('ClinicalProductRepository details and protocol sharing', () => {
  const protocol = {
    id: 70, clientShareable: true, name: 'Facial protocol',
    visibleEffectsOnset: '48 hours', effectDuration: '6 months',
    recommendedDose: '0.1 mL per point', injectionDepth: 'Intradermal',
    sessionsMin: 2, sessionsMax: 4, frequency: 'Monthly',
    zones: [{ id: 71, name: 'Face' }],
    routes: [{ id: 72, name: 'Intradermal' }],
    techniques: [{ id: 73, name: 'Papule' }],
  }
  const detail = {
    ...approvedProduct(7, 'Detailed Product', [{ id: 'active', canonicalName: 'Active Presentation' }]),
    description: 'Bounded description', validationNotes: 'RAW-NOTES-SENTINEL', createdAt: 'RAW-CREATED-SENTINEL',
    laboratory: { id: 74, name: 'Approved Laboratory' },
    activeIngredients: [{ id: 75, name: 'Hyaluronic Acid' }],
  } as Product
  Object.assign(detail.presentations![0], {
    contraindications: [{ id: 76, description: 'Pregnancy', type: 'absoluta' }],
    adverseEffects: [{ id: 77, description: 'Temporary redness' }],
    clinicalIndications: [{ id: 78, name: 'Hydration' }],
    postCareNotes: [{ id: 79, description: 'Avoid heat for 24 hours' }],
    safetyWarnings: [{ id: 80, description: 'Professional use only' }],
    protocols: [protocol],
    reconstitution: { diluentType: 'Saline', volumeMl: 2, instructions: 'Mix gently' },
  })

  it.each([
    ['missing product ID', { presentationId: 'active' }],
    ['whitespace product ID', { productId: '   ', presentationId: 'active' }],
    ['non-finite product ID', { productId: Number.NaN, presentationId: 'active' }],
    ['empty presentation ID', { productId: 7, presentationId: '' }],
    ['non-string presentation ID', { productId: 7, presentationId: 70 }],
  ])('rejects details with a %s without reading clinical data', async (_scenario, input) => {
    const { find, findByID, repository } = createHarness({ detail })

    await expect(repository.getProductDetails(input as never)).resolves.toEqual({
      ok: false,
      code: 'INVALID_REQUEST',
    })
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it('denies unauthorized details without reading or disclosing clinical data', async () => {
    const { find, findByID, repository } = createHarness({ detail, user: undefined })

    await expect(repository.getProductDetails({ productId: 7, presentationId: 'active' }))
      .resolves.toEqual({ ok: false, code: 'UNAUTHORIZED' })
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it.each([
    ['missing protocol ID', { productId: 7, presentationId: 'active' }],
    ['whitespace protocol ID', { productId: 7, presentationId: 'active', protocolId: '   ' }],
    ['non-finite protocol ID', { productId: 7, presentationId: 'active', protocolId: Number.NaN }],
    ['empty presentation ID', { productId: 7, presentationId: '', protocolId: 70 }],
    ['non-string presentation ID', { productId: 7, presentationId: 70, protocolId: 70 }],
  ])('rejects protocol sharing with a %s without reading clinical data', async (_scenario, input) => {
    const { find, findByID, repository } = createHarness({ detail })

    await expect(repository.canShareProtocol(input as never)).resolves.toEqual({
      ok: false,
      code: 'INVALID_REQUEST',
    })
    expect(find).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it('returns only approved present extended fields through a depth-2 request-bound read', async () => {
    const { findByID, repository, req } = createHarness({ detail })
    const result = await repository.getProductDetails({ productId: 7, presentationId: 'active' })

    expect(result).toEqual({
      ok: true, data: {
        product: {
          id: '7', canonicalName: 'Detailed Product', description: 'Bounded description',
          productType: null, laboratory: 'Approved Laboratory', activeIngredients: ['Hyaluronic Acid'],
        },
        presentation: {
          id: 'active', canonicalName: 'Active Presentation', characteristics: null, certifications: null,
          contraindications: [{ description: 'Pregnancy', type: 'absoluta' }],
          adverseEffects: ['Temporary redness'], clinicalIndications: ['Hydration'],
          postCareNotes: ['Avoid heat for 24 hours'], safetyWarnings: ['Professional use only'],
          reconstitution: { diluentType: 'Saline', volumeMl: 2, instructions: 'Mix gently' },
          protocols: [{
            id: '70', name: 'Facial protocol', zones: ['Face'], routes: ['Intradermal'], techniques: ['Papule'],
            visibleEffectsOnset: '48 hours', effectDuration: '6 months', recommendedDose: '0.1 mL per point',
            injectionDepth: 'Intradermal', sessionsMin: 2, sessionsMax: 4, frequency: 'Monthly',
          }],
        },
      },
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('RAW-NOTES-SENTINEL')
    expect(serialized).not.toContain('RAW-CREATED-SENTINEL')
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'products', depth: 2, id: 7, overrideAccess: true,
      populate: expect.objectContaining({ protocols: expect.any(Object) }),
      req, user: internalUser,
      select: expect.objectContaining({ presentations: expect.any(Object) }),
    }))
  })

  it('omits absent and unresolved approved fields without inference or relationship IDs', async () => {
    const sparse = structuredClone(detail)
    sparse.activeIngredients = [75]
    Object.assign(sparse.presentations![0], {
      contraindications: undefined, adverseEffects: null, clinicalIndications: [78],
      postCareNotes: undefined, safetyWarnings: null, reconstitution: {},
    })
    Object.assign(sparse.presentations![0].protocols![0], {
      visibleEffectsOnset: null, effectDuration: null, recommendedDose: null,
      injectionDepth: null, sessionsMin: null, sessionsMax: null, frequency: null,
    })

    const result = await createHarness({ detail: sparse }).repository
      .getProductDetails({ productId: 7, presentationId: 'active' })

    expect(result).toEqual({ ok: true, data: {
      product: {
        id: '7', canonicalName: 'Detailed Product', description: 'Bounded description',
        productType: null, laboratory: 'Approved Laboratory',
      },
      presentation: {
        id: 'active', canonicalName: 'Active Presentation', characteristics: null, certifications: null,
        protocols: [{
          id: '70', name: 'Facial protocol', zones: ['Face'], routes: ['Intradermal'], techniques: ['Papule'],
        }],
      },
    } })
    expect(JSON.stringify(result)).not.toContain('75')
    expect(JSON.stringify(result)).not.toContain('78')
  })

  it('resolves the product type relationship to its name, and to null when the product has none', async () => {
    const withoutType = await createHarness({ detail })
      .repository.getProductDetails({ productId: 7, presentationId: 'active' })
    expect(withoutType).toMatchObject({ ok: true, data: { product: { productType: null } } })

    const typed = structuredClone(detail)
    ;(typed as { productType?: unknown }).productType = { id: 90, name: 'Gel', slug: 'gel' }
    const withType = await createHarness({ detail: typed })
      .repository.getProductDetails({ productId: 7, presentationId: 'active' })
    expect(withType).toMatchObject({ ok: true, data: { product: { productType: 'Gel' } } })
  })

  it('returns TEMPORARY_FAILURE for an ID-only required relationship without follow-up reads', async () => {
    const idOnly = structuredClone(detail)
    ;(idOnly.presentations![0].protocols![0] as typeof protocol).zones = [71] as never
    const { find, findByID, repository } = createHarness({ detail: idOnly })

    await expect(repository.getProductDetails({ productId: 7, presentationId: 'active' })).resolves
      .toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(findByID).toHaveBeenCalledOnce()
    expect(find).not.toHaveBeenCalled()
  })

  it('reads details with errors disabled so a missing or forbidden document never throws', async () => {
    const { findByID, repository } = createHarness({ detail })
    await repository.getProductDetails({ productId: 7, presentationId: 'active' })

    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ disableErrors: true }))
  })

  it.each([
    ['an absent document', undefined],
    ['a forbidden document', null],
  ])('maps %s to UNAVAILABLE instead of a transient failure', async (_scenario, document) => {
    const { repository } = createHarness({ detail: document as never })

    await expect(repository.getProductDetails({ productId: 7, presentationId: 'active' }))
      .resolves.toEqual({ ok: false, code: 'UNAVAILABLE' })
  })

  it('maps a details reader failure to TEMPORARY_FAILURE without exposing internals', async () => {
    const { repository } = createHarness({ detailError: new Error('DETAILS-STACK-SENTINEL') })

    const result = await repository.getProductDetails({ productId: 7, presentationId: 'active' })

    expect(result).toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(JSON.stringify(result)).not.toContain('DETAILS-STACK-SENTINEL')
  })

  it('maps a protocol-sharing reader failure to TEMPORARY_FAILURE without exposing internals', async () => {
    const { repository } = createHarness({ detailError: new Error('SHARE-STACK-SENTINEL') })

    const result = await repository.canShareProtocol({
      productId: 7, presentationId: 'active', protocolId: 70,
    })

    expect(result).toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(JSON.stringify(result)).not.toContain('SHARE-STACK-SENTINEL')
  })

  it('allows only the exact explicitly shareable protocol', async () => {
    const { repository } = createHarness({ detail })
    await expect(repository.canShareProtocol({ productId: 7, presentationId: 'active', protocolId: 70 }))
      .resolves.toEqual({ ok: true, data: { shareable: true } })
  })

  it('returns indistinguishable instruction-free false decisions', async () => {
    const unshareable = structuredClone(detail)
    ;(unshareable.presentations![0].protocols![0] as typeof protocol).clientShareable = false
    const scenarios = [
      createHarness({ detail }).repository.canShareProtocol({ productId: 7, presentationId: 'active', protocolId: 999 }),
      createHarness({ detail: unshareable }).repository.canShareProtocol({ productId: 7, presentationId: 'active', protocolId: 70 }),
      createHarness({ detail: null as never }).repository.canShareProtocol({
        productId: 7, presentationId: 'active', protocolId: 70,
      }),
    ]
    const results = await Promise.all(scenarios)
    expect(results).toEqual(Array(3).fill({ ok: true, data: { shareable: false } }))
    expect(JSON.stringify(results)).not.toContain('INSTRUCTIONS-SENTINEL')
  })
})
