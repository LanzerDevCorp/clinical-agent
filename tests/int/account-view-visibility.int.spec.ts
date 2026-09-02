import { describe, expect, it } from 'vitest'

import { adminOnly } from '@/access/adminOnly'
import { Users } from '@/collections/Users'
import type { Field } from 'payload'

function fieldNamed(name: string): Field {
  const field = Users.fields.find((candidate) => 'name' in candidate && candidate.name === name)
  if (!field) throw new Error(`Users has no field named ${name}`)
  return field
}

describe('a non-admin viewing its own Account page', () => {
  it('restricts unlocking any account to admin', () => {
    expect(Users.access?.unlock).toBe(adminOnly)
  })

  it('hides the role field unless the viewer is an admin', () => {
    const condition = fieldNamed('role').admin?.condition
    if (!condition) throw new Error('role field has no admin.condition')

    expect(condition({}, {}, { user: { collection: 'users', role: 'admin' } } as never)).toBe(true)
    expect(condition({}, {}, { user: { collection: 'users', role: 'medico' } } as never)).toBe(false)
    expect(condition({}, {}, { user: { collection: 'users', role: 'user' } } as never)).toBe(false)
    expect(condition({}, {}, { user: undefined } as never)).toBe(false)
  })
})
