'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'

export default function ProductPdfAction() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()

  if (!id) return null

  const messageId = 'product-pdf-save-required'
  const openPdf = () => {
    const url = new URL(`/api/products/${encodeURIComponent(String(id))}/pdf`, window.location.origin).toString()
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) opened.opener = null
  }

  return (
    <div>
      <button aria-describedby={modified ? messageId : undefined} disabled={modified} onClick={openPdf} type="button">
        Ver en PDF
      </button>
      {modified && <span id={messageId} role="status">Guarda los cambios antes de ver el PDF.</span>}
    </div>
  )
}
