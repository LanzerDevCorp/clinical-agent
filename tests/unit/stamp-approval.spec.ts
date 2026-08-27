import { describe, expect, it } from 'vitest'

import { stampApproval } from '@/collections/hooks/stampApproval'

type RunOptions = {
  data: Record<string, unknown>
  operation: 'create' | 'update'
  user?: { collection: string; id: number }
  originalDoc?: Record<string, unknown>
}

function run({ data, operation, user, originalDoc }: RunOptions) {
  return stampApproval({
    collection: {} as never,
    context: {} as never,
    data,
    operation,
    originalDoc: originalDoc as never,
    req: { user } as never,
  }) as Record<string, unknown>
}

const approver = { collection: 'users', id: 9 } as const
const apiKeyPrincipal = { collection: 'payload-mcp-api-keys', id: 3 } as const

describe('stampApproval', () => {
  it('leaves approval fields empty on a PENDING create', () => {
    const result = run({ data: { validationStatus: 'PENDING' }, operation: 'create', user: approver })

    expect(result.approvedBy ?? null).toBeNull()
    expect(result.approvedAt ?? null).toBeNull()
  })

  it('stamps approver and timestamp when a create lands directly on APPROVED', () => {
    const result = run({ data: { validationStatus: 'APPROVED' }, operation: 'create', user: approver })

    expect(result.approvedBy).toBe(9)
    expect(typeof result.approvedAt).toBe('string')
  })

  it('captures the approval time on a create that lands on APPROVED with no acting user', () => {
    const result = run({ data: { validationStatus: 'APPROVED' }, operation: 'create', user: undefined })

    expect(result.approvedBy).toBeNull()
    expect(typeof result.approvedAt).toBe('string')
  })

  it('does not treat an MCP api key as an approver but still records the time', () => {
    const result = run({ data: { validationStatus: 'APPROVED' }, operation: 'create', user: apiKeyPrincipal })

    expect(result.approvedBy).toBeNull()
    expect(typeof result.approvedAt).toBe('string')
  })

  it('stamps approver and timestamp on the transition from PENDING to APPROVED', () => {
    const result = run({
      data: { validationStatus: 'APPROVED' },
      operation: 'update',
      user: approver,
      originalDoc: { validationStatus: 'PENDING', approvedBy: null, approvedAt: null },
    })

    expect(result.approvedBy).toBe(9)
    expect(typeof result.approvedAt).toBe('string')
  })

  it('captures the approval time on the transition to APPROVED even with no acting user', () => {
    const result = run({
      data: { validationStatus: 'APPROVED' },
      operation: 'update',
      user: undefined,
      originalDoc: { validationStatus: 'PENDING', approvedBy: null, approvedAt: null },
    })

    expect(result.approvedBy).toBeNull()
    expect(typeof result.approvedAt).toBe('string')
  })

  it('never rewrites the approval when an already-APPROVED product is edited on another field', () => {
    const result = run({
      data: { validationNotes: 'touched' },
      operation: 'update',
      user: approver,
      originalDoc: { validationStatus: 'APPROVED', approvedBy: 4, approvedAt: '2026-01-01T00:00:00.000Z' },
    })

    expect('approvedBy' in result).toBe(false)
    expect('approvedAt' in result).toBe(false)
  })

  it('does not backfill an approver when an already-APPROVED product with no approver on file is edited', () => {
    const result = run({
      data: { validationNotes: 'touched' },
      operation: 'update',
      user: approver,
      originalDoc: { validationStatus: 'APPROVED', approvedBy: null, approvedAt: '2026-01-01T00:00:00.000Z' },
    })

    expect('approvedBy' in result).toBe(false)
    expect('approvedAt' in result).toBe(false)
  })

  it('clears approval fields when a product moves back to PENDING', () => {
    const result = run({
      data: { validationStatus: 'PENDING' },
      operation: 'update',
      user: approver,
      originalDoc: { validationStatus: 'APPROVED', approvedBy: 4, approvedAt: '2026-01-01T00:00:00.000Z' },
    })

    expect(result.approvedBy).toBeNull()
    expect(result.approvedAt).toBeNull()
  })

  it('stamps a fresh approval when a product is re-approved after returning to PENDING', () => {
    const result = run({
      data: { validationStatus: 'APPROVED' },
      operation: 'update',
      user: approver,
      originalDoc: { validationStatus: 'PENDING', approvedBy: null, approvedAt: null },
    })

    expect(result.approvedBy).toBe(9)
    expect(typeof result.approvedAt).toBe('string')
  })
})
