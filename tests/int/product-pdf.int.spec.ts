import { Children, isValidElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import type { Contraindication, Product, Protocol } from '@/payload-types'
import {
  ProductPdfIncompleteGraphError,
  toProductPdfViewModel,
  toSafePdfFilename,
} from '@/lib/product-pdf/model'
import { getPdfStatusLabel, ProductPdfDocument, renderProductPdf } from '@/lib/product-pdf/document'
import { createProductPdfResponse } from '@/lib/product-pdf/endpoint'

const completeProduct: Product = {
  id: 42,
  canonicalName: 'Ácido hialurónico',
  validationStatus: 'PENDING',
  validationNotes: 'Revisar ficha técnica.',
  productType: 'liofilizado',
  laboratory: { id: 99001, name: 'Laboratorio Clínico', createdAt: 'LAB-CREATED-SENTINEL', updatedAt: 'LAB-UPDATED-SENTINEL' },
  activeIngredients: [{ id: 99002, name: 'Hialuronato de sodio', createdAt: 'INGREDIENT-CREATED-SENTINEL', updatedAt: 'INGREDIENT-UPDATED-SENTINEL' }],
  aliases: [{ id: 'PRODUCT-ALIAS-ROW-SENTINEL', term: 'AH' }],
  presentations: [{
    id: 'PRESENTATION-ROW-SENTINEL',
    canonicalName: 'Jeringa 1 mL',
    status: 'activa',
    aliases: [{ id: 'PRESENTATION-ALIAS-ROW-SENTINEL', term: '1 ml' }],
    contraindications: [{ id: 99003, type: 'absoluta', description: 'Hipersensibilidad', createdAt: 'CONTRA-CREATED-SENTINEL', updatedAt: 'CONTRA-UPDATED-SENTINEL' }],
    adverseEffects: [{ id: 99004, description: 'Eritema', createdAt: 'ADVERSE-CREATED-SENTINEL', updatedAt: 'ADVERSE-UPDATED-SENTINEL' }],
    clinicalIndications: [{ id: 99005, name: 'Uso profesional', createdAt: 'NOTE-CREATED-SENTINEL', updatedAt: 'NOTE-UPDATED-SENTINEL' } as any],
    protocols: [{
      id: 99006,
      name: 'Protocolo facial',
      visibleEffectsOnset: '5 a 7 días',
      effectDuration: '4 a 6 meses',
      recommendedDose: '2-4 UI',
      injectionDepth: 'Intradérmica',
      zones: [{ id: 99007, name: 'Mejillas', createdAt: 'ZONE-CREATED-SENTINEL', updatedAt: 'ZONE-UPDATED-SENTINEL' }],
      routes: [{ id: 99008, name: 'Intradérmica', createdAt: 'ROUTE-CREATED-SENTINEL', updatedAt: 'ROUTE-UPDATED-SENTINEL' }],
      techniques: [{ id: 99009, name: 'Retroinyección', createdAt: 'TECHNIQUE-CREATED-SENTINEL', updatedAt: 'TECHNIQUE-UPDATED-SENTINEL' }],
      sessionsMin: 2,
      sessionsMax: 3,
      frequency: 'Cada 4 semanas',
      createdAt: 'PROTOCOL-CREATED-SENTINEL',
      updatedAt: 'PROTOCOL-UPDATED-SENTINEL',
    }],
    reconstitution: { diluentType: 'Solución salina', volumeMl: 2, instructions: 'Mezclar suavemente.' },
  }],
  createdAt: 'PRODUCT-CREATED-SENTINEL',
  updatedAt: 'PRODUCT-UPDATED-SENTINEL',
}

function renderedText(node: ReactNode): Array<{ text: string; fixed: boolean }> {
  if (typeof node === 'string' || typeof node === 'number') return [{ text: String(node), fixed: false }]
  if (!isValidElement<{ children?: ReactNode; fixed?: boolean }>(node)) return []
  const element = node
  if (typeof element.type === 'function') {
    const Component = element.type as (props: { children?: ReactNode; fixed?: boolean }) => ReactNode
    return renderedText(Component(element.props))
  }
  const children = Children.toArray(element.props.children)
  return children.flatMap((child) => renderedText(child,)).map((entry) => ({
    ...entry,
    fixed: Boolean(element.props.fixed) || entry.fixed,
  }))
}

describe('Product PDF review model', () => {
  it('maps the complete persisted graph to ID-free printable content', () => {
    const model = toProductPdfViewModel(completeProduct)

    expect(model).toMatchObject({
      traceability: {
        canonicalName: 'Ácido hialurónico',
        productId: '42',
        validationStatus: 'PENDING',
        validationNotes: 'Revisar ficha técnica.',
      },
      general: { laboratory: 'Laboratorio Clínico', activeIngredients: ['Hialuronato de sodio'], aliases: ['AH'] },
      presentations: [{
        canonicalName: 'Jeringa 1 mL',
        contraindications: [{ type: 'absoluta', description: 'Hipersensibilidad' }],
        adverseEffects: ['Eritema'],
        clinicalNotes: [{ type: 'indicacion_clinica', description: 'Uso profesional' }],
        protocols: [{
          name: 'Protocolo facial', zones: ['Mejillas'], routes: ['Intradérmica'],
          techniques: ['Retroinyección'], sessionsMin: '2', sessionsMax: '3', frequency: 'Cada 4 semanas',
        }],
      }],
    })
    expect(model.traceability).toMatchObject({
      productId: '42', createdAt: 'PRODUCT-CREATED-SENTINEL', updatedAt: 'PRODUCT-UPDATED-SENTINEL',
    })
    expect(model.presentations[0]).toMatchObject({
      status: 'activa', aliases: ['1 ml'],
      reconstitution: { diluentType: 'Solución salina', volumeMl: '2', instructions: 'Mezclar suavemente.' },
      protocols: [{ sessionsMin: '2', sessionsMax: '3', frequency: 'Cada 4 semanas' }],
    })
    const serialized = JSON.stringify(model)
    for (const forbidden of [
      '99001', '99002', '99003', '99004', '99005', '99006', '99007', '99008', '99009',
      'PRODUCT-ALIAS-ROW-SENTINEL', 'PRESENTATION-ROW-SENTINEL', 'PRESENTATION-ALIAS-ROW-SENTINEL',
      'LAB-CREATED-SENTINEL', 'INGREDIENT-CREATED-SENTINEL', 'CONTRA-CREATED-SENTINEL',
      'ADVERSE-CREATED-SENTINEL', 'NOTE-CREATED-SENTINEL', 'PROTOCOL-CREATED-SENTINEL',
      'ZONE-CREATED-SENTINEL', 'ROUTE-CREATED-SENTINEL', 'TECHNIQUE-CREATED-SENTINEL',
      'LAB-UPDATED-SENTINEL', 'INGREDIENT-UPDATED-SENTINEL', 'CONTRA-UPDATED-SENTINEL',
      'ADVERSE-UPDATED-SENTINEL', 'NOTE-UPDATED-SENTINEL', 'PROTOCOL-UPDATED-SENTINEL',
      'ZONE-UPDATED-SENTINEL', 'ROUTE-UPDATED-SENTINEL', 'TECHNIQUE-UPDATED-SENTINEL',
    ]) expect(serialized).not.toContain(forbidden)
    expect(toSafePdfFilename('Ácido / ../../"\r\n.pdf', 42)).toBe('acido-pdf.pdf')
  })

  it('uses explicit empty labels and rejects ID-only required relationships', () => {
    const sparseProduct: Product = {
      ...completeProduct,
      validationStatus: 'APPROVED',
      validationNotes: null,
      productType: null,
      activeIngredients: [],
      aliases: [],
      presentations: [],
    }

    expect(toProductPdfViewModel(sparseProduct)).toMatchObject({
      traceability: { validationStatus: 'APPROVED', validationNotes: 'No informado' },
      general: { productType: 'No informado', activeIngredients: ['Sin registros'], aliases: ['Sin registros'] },
      presentations: [],
    })
    expect(() => toProductPdfViewModel({ ...completeProduct, laboratory: 1 })).toThrow(ProductPdfIncompleteGraphError)
    for (const relationship of ['zones', 'routes', 'techniques'] as const) {
      const product = structuredClone(completeProduct)
      const protocol = product.presentations![0].protocols![0] as Protocol
      ;(protocol[relationship] as number[])[0] = 1
      expect(() => toProductPdfViewModel(product)).toThrow(ProductPdfIncompleteGraphError)
    }
  })
})

describe('Product PDF document', () => {
  it('renders a multi-page PENDING PDF with an explicit warning', async () => {
    const model = toProductPdfViewModel({
      ...completeProduct,
      presentations: [{
        ...completeProduct.presentations![0],
        canonicalName: 'Presentación clínica extensa',
        aliases: [{ id: 'PRESENTATION-ALIAS-ROW-SENTINEL', term: '1 ml' }],
        protocols: Array.from({ length: 32 }, (_, index) => ({
          ...(completeProduct.presentations![0].protocols![0] as Protocol),
          name: `Protocolo facial ${index + 1}`,
        })),
      }],
    })
    const startedAt = performance.now()
    const rssBefore = process.memoryUsage().rss
    const pdf = await renderProductPdf(model)
    const tree = renderedText(ProductPdfDocument({ model }))

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length).toBeGreaterThan(1)
    expect(performance.now() - startedAt).toBeLessThan(10_000)
    expect(process.memoryUsage().rss - rssBefore).toBeLessThan(256 * 1024 * 1024)
    expect(getPdfStatusLabel('PENDING')).toBe('PENDIENTE DE VALIDACIÓN — NO APROBADO')
    expect(tree).toContainEqual({ text: 'PENDIENTE DE VALIDACIÓN — NO APROBADO', fixed: true })
    const text = tree.map(({ text }) => text).join(' ')
    for (const expected of [
      'Ácido hialurónico', '42', 'PENDING', 'Revisar ficha técnica.', 'PRODUCT-CREATED-SENTINEL', 'PRODUCT-UPDATED-SENTINEL',
      'Liofilizado', 'Laboratorio Clínico', 'Hialuronato de sodio', 'AH', 'Absoluta', 'Hipersensibilidad', 'Eritema',
      'Presentación clínica extensa', 'Activa', '1 ml', 'Indicaciones clínicas', 'Uso profesional', 'Reconstitución / Dilución',
      'Tipo de diluyente', 'Solución salina', 'Volumen (mL)', '2', 'Instrucciones', 'Mezclar suavemente.',
      'Protocolo facial 1', 'Protocolo facial 32', 'Mejillas', 'Intradérmica', 'Retroinyección', '2', '3', 'Cada 4 semanas',
    ]) expect(text).toContain(expected)
    expect(text).not.toContain('PRESENTATION-ROW-SENTINEL')
    expect(text).not.toContain('PROTOCOL-CREATED-SENTINEL')
  })

  it('renders the approved treatment without the pending warning', () => {
    const product = structuredClone(completeProduct)
    product.validationStatus = 'APPROVED'
    ;(product.presentations![0].contraindications![0] as Contraindication).type = 'relativa'
    ;(product.presentations![0] as any).safetyWarnings = [{ id: 99005, description: 'Uso profesional', createdAt: 'NOTE-CREATED-SENTINEL', updatedAt: 'NOTE-UPDATED-SENTINEL' }]
    delete (product.presentations![0] as any).clinicalIndications
    product.presentations![0].reconstitution = { diluentType: null, volumeMl: null, instructions: null }
    const model = toProductPdfViewModel(product)
    const tree = renderedText(ProductPdfDocument({ model }))
    expect(tree).toContainEqual({ text: 'Aprobado', fixed: false })
    const text = tree.map(({ text }) => text).join(' ')
    expect(text).toContain('Relativa')
    expect(text).toContain('Advertencias de seguridad')
    expect(text).toContain('Reconstitución / Dilución')
    expect(text.match(/No informado/g)).toHaveLength(4)
    expect(text).not.toContain('PENDIENTE DE VALIDACIÓN — NO APROBADO')
  })
})

describe('Product PDF endpoint', () => {
  it('returns an atomic private inline PDF through the request-bound authorized lookup', async () => {
    const user = { id: 1 }
    let lookupOptions: unknown
    const findByID = async (options: unknown) => {
      lookupOptions = options
      expect(options).toMatchObject({ collection: 'products', id: '42', depth: 5, overrideAccess: false })
      return { ...completeProduct, canonicalName: 'Ácido\r\n../producto' }
    }
    const request = { user, payload: { findByID } } as never
    const response = await createProductPdfResponse(request, '42', async () => Buffer.from('%PDF-example'))

    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('%PDF-example'))
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-disposition')).toMatch(/^inline; filename="acido-producto\.pdf"$/)
    expect(response.headers.get('content-length')).toBe(String(Buffer.byteLength('%PDF-example')))
    expect(lookupOptions).toMatchObject({ user, req: request })
  })

  it.each([
    ['unauthenticated', { user: undefined, payload: {} }, '42', 401, 'UNAUTHORIZED'],
    ['invalid', { user: { id: 1 }, payload: { findByID: async () => { throw new Error('not found') } } }, '../42', 404, 'PRODUCT_NOT_FOUND'],
    ['incomplete', { user: { id: 1 }, payload: { findByID: async () => ({ ...completeProduct, laboratory: 1 }) } }, '42', 422, 'INCOMPLETE_PRODUCT_GRAPH'],
  ])('returns a concise non-PDF %s error', async (_scenario, request, id, status, error) => {
    const response = await createProductPdfResponse(request as never, id, async () => Buffer.from('%PDF-example'))

    expect(response.status).toBe(status)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('content-disposition')).toBeNull()
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('x-content-type-options')).toBeNull()
    expect(await response.json()).toEqual({ error })
  })

  it('makes missing and inaccessible products indistinguishable 404 responses', async () => {
    const missing = await createProductPdfResponse({ user: { id: 1 }, payload: { findByID: async () => { throw new Error('missing') } } } as never, '42')
    const inaccessible = await createProductPdfResponse({ user: { id: 1 }, payload: { findByID: async () => { throw new Error('inaccessible') } } } as never, '42')

    expect([missing.status, await missing.json(), missing.headers.get('content-type')]).toEqual([404, { error: 'PRODUCT_NOT_FOUND' }, 'application/json'])
    expect([inaccessible.status, await inaccessible.json(), inaccessible.headers.get('content-type')]).toEqual([404, { error: 'PRODUCT_NOT_FOUND' }, 'application/json'])
  })

  it('returns a stable non-PDF error when rendering fails', async () => {
    const request = { user: { id: 1 }, payload: { findByID: async () => completeProduct } } as never
    const response = await createProductPdfResponse(request, '42', async () => { throw new Error('renderer failed') })

    expect(response.status).toBe(500)
    expect(response.headers.get('content-disposition')).toBeNull()
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('x-content-type-options')).toBeNull()
    expect(await response.json()).toEqual({ error: 'PDF_RENDER_FAILED' })
  })
})
