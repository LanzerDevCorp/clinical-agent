import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ documentInfo: vi.fn(), formModified: vi.fn() }))

vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: hooks.documentInfo,
  useFormModified: hooks.formModified,
}))

import ProductPdfAction from '@/components/ProductPdfAction'

describe('ProductPdfAction', () => {
  beforeEach(() => {
    hooks.documentInfo.mockReset()
    hooks.formModified.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('hides the action while creating a Product', () => {
    hooks.documentInfo.mockReturnValue({ id: undefined })
    hooks.formModified.mockReturnValue(false)

    render(<ProductPdfAction />)

    expect(screen.queryByRole('button', { name: 'Ver en PDF' })).toBeNull()
  })

  it('disables the persisted action with an accessible save explanation while dirty', () => {
    hooks.documentInfo.mockReturnValue({ id: '42' })
    hooks.formModified.mockReturnValue(true)

    render(<ProductPdfAction />)

    expect(screen.getByRole('button', { name: 'Ver en PDF' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Guarda los cambios antes de ver el PDF.')
  })

  it('opens a clean persisted product at the encoded same-origin PDF URL without an opener', () => {
    hooks.documentInfo.mockReturnValue({ id: 'a/b' })
    hooks.formModified.mockReturnValue(false)
    const openedWindow = { opener: {} }
    const open = vi.spyOn(window, 'open').mockReturnValue(openedWindow as never)

    render(<ProductPdfAction />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver en PDF' }))

    expect(open).toHaveBeenCalledWith('http://localhost:3000/api/products/a%2Fb/pdf', '_blank', 'noopener,noreferrer')
    expect(openedWindow.opener).toBeNull()
  })
})
