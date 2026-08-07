import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import { internalUsersOnly } from '@/access/internalUsersOnly'
import { Products } from '@/collections/Products'
import { Protocols } from '@/collections/Protocols'
import config from '@/payload.config'
import { createClinicalProductRepository } from '@/lib/clinical-agent/repository'
import type { User } from '@/payload-types'

let payload: Payload
let internalUser: User
let productId: number
let protocolId: number
let seededProductId: number, seededProtocolId: number, seededPresentationId: string

function enforcedReadContext(user: User | undefined) {
  return {
    depth: 0 as const,
    overrideAccess: false as const,
    user,
  }
}

function readProductAsInternalUser() {
  return payload.findByID({
    collection: 'products',
    id: productId,
    ...enforcedReadContext(internalUser),
  })
}

function readProtocolAsInternalUser() {
  return payload.findByID({
    collection: 'protocols',
    id: protocolId,
    ...enforcedReadContext(internalUser),
  })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await payload.delete({ collection: 'products', where: { canonicalName: { contains: 'Runtime Clinical' } } })
  await payload.delete({ collection: 'protocols', where: { name: { contains: 'Runtime shareable' } } })

  const [users, products, protocols] = await Promise.all([
    payload.find({ collection: 'users', depth: 0, limit: 1 }),
    payload.find({ collection: 'products', depth: 0, limit: 1 }),
    payload.find({ collection: 'protocols', depth: 0, limit: 20 }),
  ])

  if (!users.docs[0] || !products.docs[0] || !protocols.docs[0]) {
    throw new Error('Postgres integration fixtures require an existing user, product, and protocol')
  }

  internalUser = users.docs[0]
  productId = products.docs[0].id
  const defaultProtocol = protocols.docs.find((protocol) => !protocol.clientShareable)
  if (!defaultProtocol) throw new Error('Postgres integration fixtures require a default-deny protocol')
  protocolId = defaultProtocol.id

  const sourceProtocol = protocols.docs[0]
  const protocol = await payload.create({
    collection: 'protocols', data: {
      clientShareable: true, name: `Runtime shareable ${Date.now()}`,
      zones: sourceProtocol.zones.map((item) => typeof item === 'number' ? item : item.id),
      routes: sourceProtocol.routes.map((item) => typeof item === 'number' ? item : item.id),
      techniques: sourceProtocol.techniques.map((item) => typeof item === 'number' ? item : item.id),
    },
  })
  const sourceProduct = products.docs[0]
  const product = await payload.create({
    collection: 'products',
    data: {
      canonicalName: `Runtime Clinical ${Date.now()}`,
      aliases: [{ term: 'runtime nested alias' }],
      laboratory: typeof sourceProduct.laboratory === 'number' ? sourceProduct.laboratory : sourceProduct.laboratory.id,
      presentations: [{
        canonicalName: 'Runtime Presentation', status: 'activa',
        aliases: [{ term: 'runtime presentation alias' }], protocols: [protocol.id],
      }, {
        canonicalName: 'Runtime Inactive', status: 'descontinuada', aliases: [{ term: 'runtime inactive alias' }],
      }],
      validationStatus: 'APPROVED',
    },
  })
  ;[seededProductId, seededProtocolId, seededPresentationId] = [product.id, protocol.id, product.presentations![0].id!]
}, 30_000)

afterAll(async () => {
  if (seededProductId) await payload.delete({ collection: 'products', id: seededProductId })
  if (seededProtocolId) await payload.delete({ collection: 'protocols', id: seededProtocolId })
}, 30_000)

describe('clinical product collection access', () => {
  it.each([
    ['an authenticated Payload user', { collection: 'users' }, true],
    ['an unauthenticated request', undefined, false],
    ['an authenticated non-user identity', { collection: 'payload-mcp-api-keys' }, false],
  ])('allows only %s', (_scenario, user, expected) => {
    expect(internalUsersOnly({ req: { user } } as never)).toBe(expected)
  })

  it('applies the same users-only read policy to products and protocols', () => {
    expect(Products.access?.read).toBe(internalUsersOnly)
    expect(Protocols.access?.read).toBe(internalUsersOnly)
  })

  it('allows an internal user to read products and protocols with access explicitly enforced', async () => {
    const [product, protocol] = await Promise.all([
      readProductAsInternalUser(),
      readProtocolAsInternalUser(),
    ])

    expect(product.id).toBe(productId)
    expect(protocol.id).toBe(protocolId)
  })

  it('denies product and protocol reads without an internal user', async () => {
    await expect(
      payload.find({
        collection: 'products',
        limit: 1,
        where: { id: { equals: productId } },
        ...enforcedReadContext(undefined),
      }),
    ).rejects.toMatchObject({ status: 403 })

    await expect(
      payload.find({
        collection: 'protocols',
        limit: 1,
        where: { id: { equals: protocolId } },
        ...enforcedReadContext(undefined),
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('protocol client sharing migration', () => {
  it('defaults an existing protocol to not client-shareable', async () => {
    const protocol = await readProtocolAsInternalUser()

    expect(protocol.clientShareable).toBe(false)
  })
})

describe('clinical repository Postgres runtime', () => {
  it('discovers an approved active presentation through a nested contains query', async () => {
    const req = { payload, user: internalUser } as PayloadRequest
    const repository = createClinicalProductRepository(req)

    await expect(repository.searchProducts({ query: 'runtime nested alias' })).resolves.toMatchObject({
      ok: true, data: { kind: 'match', product: { id: String(seededProductId) },
        presentation: { id: seededPresentationId },
      },
    })
  })

  it('excludes an ineligible nested presentation and returns bounded details/shareability', async () => {
    const req = { payload, user: internalUser } as PayloadRequest
    const repository = createClinicalProductRepository(req)

    await expect(repository.searchProducts({ query: 'runtime inactive alias' }))
      .resolves.toEqual({ ok: false, code: 'UNAVAILABLE' })
    await expect(repository.getProductDetails({ productId: seededProductId, presentationId: seededPresentationId }))
      .resolves.toMatchObject({ ok: true, data: {
        product: { id: String(seededProductId) },
        presentation: { id: seededPresentationId, protocols: [{ id: String(seededProtocolId) }] },
      } })
    await expect(repository.canShareProtocol({ productId: seededProductId, presentationId: seededPresentationId,
      protocolId: seededProtocolId })).resolves.toEqual({ ok: true, data: { shareable: true } })
  })
})
