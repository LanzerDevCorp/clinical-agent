import 'server-only'

import type { PayloadRequest } from 'payload'
import { renderProductPdf } from './document'
import { ProductPdfIncompleteGraphError, toProductPdfViewModel, toSafePdfFilename } from './model'

type PdfRenderer = typeof renderProductPdf

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

export async function createProductPdfResponse(
  req: Pick<PayloadRequest, 'payload' | 'user'>,
  id: string,
  render: PdfRenderer = renderProductPdf,
): Promise<Response> {
  if (!req.user) return jsonError(401, 'UNAUTHORIZED')
  if (!/^\d+$/.test(id)) return jsonError(404, 'PRODUCT_NOT_FOUND')

  let product
  try {
    product = await req.payload.findByID({
      collection: 'products',
      id,
      depth: 5,
      user: req.user,
      req: req as PayloadRequest,
      overrideAccess: false,
    })
  } catch {
    return jsonError(404, 'PRODUCT_NOT_FOUND')
  }

  let model
  try {
    model = toProductPdfViewModel(product)
  } catch (error) {
    return error instanceof ProductPdfIncompleteGraphError
      ? jsonError(422, error.code)
      : jsonError(404, 'PRODUCT_NOT_FOUND')
  }

  try {
    const pdf = await render(model)
    const filename = toSafePdfFilename(product.canonicalName, product.id)
    return new Response(pdf, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(pdf.byteLength),
        'Content-Type': 'application/pdf',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return jsonError(500, 'PDF_RENDER_FAILED')
  }
}
