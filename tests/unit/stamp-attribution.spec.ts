import { describe, expect, it } from 'vitest'

import { stampAttribution } from '@/collections/hooks/stampAttribution'

type RunOptions = {
  data: Record<string, unknown>
  operation: 'create' | 'update'
  user?: { collection: string; id: number }
  originalDoc?: Record<string, unknown>
}

function run({ data, operation, user, originalDoc }: RunOptions) {
  return stampAttribution({
    collection: {} as never,
    context: {} as never,
    data,
    operation,
    originalDoc: originalDoc as never,
    req: { user } as never,
  }) as Record<string, unknown>
}

const internalUser = { collection: 'users', id: 7 } as const
const otherUser = { collection: 'users', id: 12 } as const
const apiKeyPrincipal = { collection: 'payload-mcp-api-keys', id: 3 } as const

describe('stampAttribution', () => {
  it('stamps createdBy and updatedBy on create for a real users-collection user', () => {
    const result = run({ data: { name: 'X' }, operation: 'create', user: internalUser })

    expect(result.createdBy).toBe(7)
    expect(result.updatedBy).toBe(7)
  })

  it('stamps only updatedBy on update and never touches createdBy', () => {
    const result = run({ data: { name: 'X' }, operation: 'update', user: otherUser, originalDoc: { createdBy: 7 } })

    expect(result.updatedBy).toBe(12)
    expect('createdBy' in result).toBe(false)
  })

  it('does not stamp when there is no authenticated user (seed / migration / anon)', () => {
    const result = run({ data: { name: 'X' }, operation: 'create', user: undefined })

    expect('createdBy' in result).toBe(false)
    expect('updatedBy' in result).toBe(false)
  })

  it('does not stamp when the principal is an MCP api key rather than a user', () => {
    const result = run({ data: { name: 'X' }, operation: 'create', user: apiKeyPrincipal })

    expect('createdBy' in result).toBe(false)
    expect('updatedBy' in result).toBe(false)
  })

  it('does not throw when req.user is absent on update', () => {
    expect(() => run({ data: { name: 'X' }, operation: 'update', user: undefined })).not.toThrow()
  })
})
