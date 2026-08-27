import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

let payload: Payload
let userA: User
let userB: User

const stamp = Date.now()
const trash: { collection: 'laboratories' | 'products'; id: number }[] = []

const idOf = (value: unknown): number | null =>
  value == null ? null : typeof value === 'object' ? (value as { id: number }).id : (value as number)

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  userA = await payload.create({
    collection: 'users',
    data: { email: `audit-a-${stamp}@test.com`, password: 'test-1234', role: 'admin' },
  })
  userB = await payload.create({
    collection: 'users',
    data: { email: `audit-b-${stamp}@test.com`, password: 'test-1234', role: 'admin' },
  })
}, 60_000)

afterAll(async () => {
  for (const item of trash.reverse()) {
    await payload.delete({ collection: item.collection, id: item.id }).catch(() => {})
  }
  await payload.delete({ collection: 'users', id: userA.id }).catch(() => {})
  await payload.delete({ collection: 'users', id: userB.id }).catch(() => {})
}, 60_000)

async function newLaboratory(user: User | undefined) {
  const lab = await payload.create({
    collection: 'laboratories',
    data: { name: `Audit Lab ${stamp} ${Math.random()}` },
    user,
  })
  trash.push({ collection: 'laboratories', id: lab.id })
  return lab
}

describe('shared attribution stamping', () => {
  it('stamps createdBy and updatedBy to the acting user on create', async () => {
    const lab = await newLaboratory(userA)

    expect(idOf(lab.createdBy)).toBe(userA.id)
    expect(idOf(lab.updatedBy)).toBe(userA.id)
  })

  it('moves updatedBy to the next editor and leaves createdBy alone', async () => {
    const lab = await newLaboratory(userA)

    const updated = await payload.update({
      collection: 'laboratories',
      id: lab.id,
      data: { name: `${lab.name} (edited)` },
      user: userB,
    })

    expect(idOf(updated.createdBy)).toBe(userA.id)
    expect(idOf(updated.updatedBy)).toBe(userB.id)
  })

  it('leaves attribution null when there is no authenticated user', async () => {
    const lab = await newLaboratory(undefined)

    expect(idOf(lab.createdBy)).toBeNull()
    expect(idOf(lab.updatedBy)).toBeNull()

    const updated = await payload.update({
      collection: 'laboratories',
      id: lab.id,
      data: { name: `${lab.name} (anon edit)` },
    })
    expect(idOf(updated.updatedBy)).toBeNull()
  })

  it('does not treat an MCP api-key principal as a user', async () => {
    const lab = await payload.create({
      collection: 'laboratories',
      data: { name: `Audit Lab apikey ${stamp}` },
      user: { collection: 'payload-mcp-api-keys', id: 999999 } as never,
      overrideAccess: true,
    })
    trash.push({ collection: 'laboratories', id: lab.id })

    expect(idOf(lab.createdBy)).toBeNull()
    expect(idOf(lab.updatedBy)).toBeNull()
  })
})

describe('product approval stamping', () => {
  async function newProduct(status: 'PENDING' | 'APPROVED', user: User | undefined) {
    const lab = await newLaboratory(user)
    const product = await payload.create({
      collection: 'products',
      data: { canonicalName: `Audit Product ${stamp} ${Math.random()}`, laboratory: lab.id, validationStatus: status },
      user,
      overrideAccess: true,
    })
    trash.push({ collection: 'products', id: product.id })
    return product
  }

  const setStatus = (id: number, status: 'PENDING' | 'APPROVED', user: User | undefined) =>
    payload.update({ collection: 'products', id, data: { validationStatus: status }, user, overrideAccess: true })

  it('leaves approval fields empty for a PENDING product', async () => {
    const product = await newProduct('PENDING', userA)

    expect(idOf(product.approvedBy)).toBeNull()
    expect(product.approvedAt ?? null).toBeNull()
  })

  it('stamps the approver and time on the transition to APPROVED', async () => {
    const product = await newProduct('PENDING', userA)

    const approved = await setStatus(product.id, 'APPROVED', userA)

    expect(idOf(approved.approvedBy)).toBe(userA.id)
    expect(approved.approvedAt).toBeTruthy()
  })

  it('records the approval time on the transition to APPROVED with no acting user', async () => {
    const product = await newProduct('PENDING', userA)

    const approved = await setStatus(product.id, 'APPROVED', undefined)

    expect(idOf(approved.approvedBy)).toBeNull()
    expect(approved.approvedAt).toBeTruthy()
  })

  it('never rewrites approvedBy or approvedAt when an approved product is edited elsewhere', async () => {
    const product = await newProduct('PENDING', userA)
    const approved = await setStatus(product.id, 'APPROVED', userA)

    const edited = await payload.update({
      collection: 'products',
      id: product.id,
      data: { validationNotes: 'unrelated edit' },
      user: userB,
      overrideAccess: true,
    })

    expect(idOf(edited.approvedBy)).toBe(userA.id)
    expect(edited.approvedAt).toBe(approved.approvedAt)
  })

  it('does not backfill approvedBy when an approved product with no approver on file is edited', async () => {
    const product = await newProduct('PENDING', userA)
    const approved = await setStatus(product.id, 'APPROVED', undefined)
    expect(idOf(approved.approvedBy)).toBeNull()

    const edited = await payload.update({
      collection: 'products',
      id: product.id,
      data: { validationNotes: 'edited by a real user' },
      user: userA,
      overrideAccess: true,
    })

    expect(idOf(edited.approvedBy)).toBeNull()
    expect(edited.approvedAt).toBe(approved.approvedAt)
  })

  it('clears the approval when a product returns to PENDING', async () => {
    const product = await newProduct('PENDING', userA)
    await setStatus(product.id, 'APPROVED', userA)

    const reverted = await setStatus(product.id, 'PENDING', userA)

    expect(idOf(reverted.approvedBy)).toBeNull()
    expect(reverted.approvedAt ?? null).toBeNull()
  })

  it('stamps a fresh approval time when re-approved after returning to PENDING', async () => {
    const product = await newProduct('PENDING', userA)
    const firstApproval = await setStatus(product.id, 'APPROVED', userA)
    await setStatus(product.id, 'PENDING', userA)

    const reApproved = await setStatus(product.id, 'APPROVED', userB)

    expect(idOf(reApproved.approvedBy)).toBe(userB.id)
    expect(reApproved.approvedAt).toBeTruthy()
    expect(reApproved.approvedAt).not.toBe(firstApproval.approvedAt)
  })
})
