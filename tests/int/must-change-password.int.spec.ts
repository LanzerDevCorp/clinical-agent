import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminOrMedico } from '@/access/adminOrMedico'
import config from '@/payload.config'
import type { User } from '@/payload-types'

let payload: Payload
let admin: User

const stamp = Date.now()
const trash: number[] = []

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = await payload.create({
    collection: 'users',
    data: { email: `mcp-admin-${stamp}@test.com`, password: 'test-1234', role: 'admin', mustChangePassword: false },
  })
}, 60_000)

afterAll(async () => {
  for (const id of trash) await payload.delete({ collection: 'users', id }).catch(() => undefined)
  await payload.delete({ collection: 'users', id: admin.id }).catch(() => undefined)
}, 60_000)

describe('temporary passwords', () => {
  it('marks an admin-created account as needing a password change', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: `mcp-new-${stamp}@test.com`, password: 'temp-1234', role: 'user' },
      overrideAccess: false,
      user: admin,
    })
    trash.push(created.id)

    expect(created.mustChangePassword).toBe(true)
  })

  it('respects an explicit mustChangePassword on create, like the local seed does', async () => {
    const created = await payload.create({
      collection: 'users',
      data: {
        email: `mcp-exempt-${stamp}@test.com`, password: 'temp-1234', role: 'admin',
        mustChangePassword: false,
      },
    })
    trash.push(created.id)

    expect(created.mustChangePassword).toBe(false)
  })

  it('clears the flag when the account changes its own password', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: `mcp-self-${stamp}@test.com`, password: 'temp-1234', role: 'user' },
    })
    trash.push(created.id)
    expect(created.mustChangePassword).toBe(true)

    const updated = await payload.update({
      collection: 'users',
      id: created.id,
      data: { password: 'new-password-1234' },
      overrideAccess: false,
      user: created,
    })

    expect(updated.mustChangePassword).toBe(false)
  })

  it('re-arms the flag when an admin resets someone else\'s password', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: `mcp-reset-${stamp}@test.com`, password: 'temp-1234', role: 'user', mustChangePassword: false },
    })
    trash.push(created.id)
    expect(created.mustChangePassword).toBe(false)

    const reset = await payload.update({
      collection: 'users',
      id: created.id,
      data: { password: 'admin-reset-1234' },
      overrideAccess: false,
      user: admin,
    })

    expect(reset.mustChangePassword).toBe(true)
  })

  it('does not let a non-admin clear the flag directly, without changing the password', async () => {
    const created = await payload.create({
      collection: 'users',
      data: { email: `mcp-direct-${stamp}@test.com`, password: 'temp-1234', role: 'user' },
    })
    trash.push(created.id)
    expect(created.mustChangePassword).toBe(true)

    const updated = await payload.update({
      collection: 'users',
      id: created.id,
      data: { mustChangePassword: false },
      overrideAccess: false,
      user: created,
    })

    expect(updated.mustChangePassword).toBe(true)
  })

  it('denies admin-or-medico catalogue access while a temporary password is pending', () => {
    expect(adminOrMedico({ req: { user: { collection: 'users', role: 'admin', mustChangePassword: true } } } as never)).toBe(false)
    expect(adminOrMedico({ req: { user: { collection: 'users', role: 'medico', mustChangePassword: true } } } as never)).toBe(false)
    expect(adminOrMedico({ req: { user: { collection: 'users', role: 'admin', mustChangePassword: false } } } as never)).toBe(true)
  })
})
