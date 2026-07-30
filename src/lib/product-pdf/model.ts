import type {
  ActiveIngredient,
  ApplicationTechnique,
  ApplicationZone,
  AdministrationRoute,
  ClinicalNote,
  Contraindication,
  Laboratory,
  Product,
  Protocol,
} from '@/payload-types'

const NOT_REPORTED = 'No informado'
const NO_RECORDS = 'Sin registros'

export class ProductPdfIncompleteGraphError extends Error {
  readonly code = 'INCOMPLETE_PRODUCT_GRAPH'

  constructor(path: string) {
    super(`Incomplete Product graph at ${path}`)
    this.name = 'ProductPdfIncompleteGraphError'
  }
}

export type ProductPdfViewModel = {
  traceability: {
    canonicalName: string
    productId: string
    validationStatus: Product['validationStatus']
    validationNotes: string
    createdAt: string
    updatedAt: string
  }
  general: { productType: string; laboratory: string; activeIngredients: string[]; aliases: string[] }
  specifications: {
    visibleEffectsOnset: string
    effectDuration: string
    recommendedDose: string
    injectionDepth: string
    certifications: string
  }
  clinicalSafety: {
    contraindications: Array<{ type: Contraindication['type']; description: string }>
    adverseEffects: string[]
  }
  presentations: Array<{
    canonicalName: string
    status: string
    aliases: string[]
    clinicalNotes: Array<{ type: ClinicalNote['type']; description: string }>
    reconstitution: { diluentType: string; volumeMl: string; instructions: string }
    protocols: Array<{
      name: string
      zones: string[]
      routes: string[]
      techniques: string[]
      sessionsMin: string
      sessionsMax: string
      frequency: string
    }>
  }>
}

function value(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? NOT_REPORTED : String(value)
}

function records<T>(items: readonly T[] | null | undefined, mapper: (item: T, index: number) => string): string[] {
  return !items?.length ? [NO_RECORDS] : items.map(mapper)
}

function populated<T extends object>(record: number | T, path: string): T {
  if (typeof record === 'number') throw new ProductPdfIncompleteGraphError(path)
  return record
}

function named(recordsToMap: readonly (number | { name: string })[] | null | undefined, path: string): string[] {
  return records(recordsToMap, (record, index) => populated(record, `${path}[${index}]`).name)
}

export function toProductPdfViewModel(product: Product): ProductPdfViewModel {
  const laboratory = populated(product.laboratory, 'laboratory') as Laboratory

  return {
    traceability: {
      canonicalName: product.canonicalName,
      productId: String(product.id),
      validationStatus: product.validationStatus,
      validationNotes: value(product.validationNotes),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    },
    general: {
      productType: value(product.productType),
      laboratory: laboratory.name,
      activeIngredients: named(product.activeIngredients as (number | ActiveIngredient)[] | null | undefined, 'activeIngredients'),
      aliases: records(product.aliases, (alias) => alias.term),
    },
    specifications: {
      visibleEffectsOnset: value(product.visibleEffectsOnset),
      effectDuration: value(product.effectDuration),
      recommendedDose: value(product.recommendedDose),
      injectionDepth: value(product.injectionDepth),
      certifications: value(product.certifications),
    },
    clinicalSafety: {
      contraindications: (product.contraindications ?? []).map((record, index) => {
        const contraindication = populated(record, `contraindications[${index}]`) as Contraindication
        return { type: contraindication.type, description: contraindication.description }
      }),
      adverseEffects: records(product.adverseEffects, (record, index) => populated(record, `adverseEffects[${index}]`).description),
    },
    presentations: (product.presentations ?? []).map((presentation, presentationIndex) => ({
      canonicalName: presentation.canonicalName,
      status: value(presentation.status),
      aliases: records(presentation.aliases, (alias) => alias.term),
      clinicalNotes: (presentation.clinicalNotes ?? []).map((record, index) => {
        const note = populated(record, `presentations[${presentationIndex}].clinicalNotes[${index}]`) as ClinicalNote
        return { type: note.type, description: note.description }
      }),
      reconstitution: {
        diluentType: value(presentation.reconstitution?.diluentType),
        volumeMl: value(presentation.reconstitution?.volumeMl),
        instructions: value(presentation.reconstitution?.instructions),
      },
      protocols: (presentation.protocols ?? []).map((record, protocolIndex) => {
        const protocol = populated(record, `presentations[${presentationIndex}].protocols[${protocolIndex}]`) as Protocol
        return {
          name: protocol.name,
          zones: named(protocol.zones as (number | ApplicationZone)[], `protocols[${protocolIndex}].zones`),
          routes: named(protocol.routes as (number | AdministrationRoute)[], `protocols[${protocolIndex}].routes`),
          techniques: named(protocol.techniques as (number | ApplicationTechnique)[], `protocols[${protocolIndex}].techniques`),
          sessionsMin: value(protocol.sessionsMin),
          sessionsMax: value(protocol.sessionsMax),
          frequency: value(protocol.frequency),
        }
      }),
    })),
  }
}

export function toSafePdfFilename(canonicalName: string, productId: number | string): string {
  const base = canonicalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80)

  return `${base || `producto-${String(productId).replace(/[^a-zA-Z0-9-]/g, '') || 'sin-id'}`}.pdf`
}
