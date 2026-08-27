import type {
  ActiveIngredient,
  ApplicationTechnique,
  ApplicationZone,
  AdministrationRoute,
  Contraindication,
  Laboratory,
  Product,
  ProductType,
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
  general: { description: string; productType: string; laboratory: string; activeIngredients: string[]; aliases: string[]; certifications: string }
  presentations: Array<{
    canonicalName: string
    status: string
    characteristics: string
    aliases: string[]
    contraindications: Array<{ type: Contraindication['type']; description: string }>
    adverseEffects: string[]
    clinicalNotes: Array<{ type: 'indicacion_clinica' | 'cuidado_post_aplicacion' | 'advertencia_seguridad'; description: string }>
    reconstitution: { diluentType: string; volumeMl: string; instructions: string }
    protocols: Array<{
      name: string
      visibleEffectsOnset: string
      effectDuration: string
      recommendedDose: string
      injectionDepth: string
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
      description: value((product as any).description),
      productType: value(
        product.productType && typeof product.productType === 'object'
          ? (product.productType as ProductType).name
          : null,
      ),
      laboratory: laboratory.name,
      activeIngredients: named(product.activeIngredients as (number | ActiveIngredient)[] | null | undefined, 'activeIngredients'),
      aliases: records(product.aliases, (alias) => alias.term),
      certifications: value((product.presentations?.[0] as any)?.certifications ?? (product as any).certifications),
    },
    presentations: (product.presentations ?? []).map((presentation, presentationIndex) => ({
      canonicalName: presentation.canonicalName,
      status: value(presentation.status),
      characteristics: value((presentation as any).characteristics),
      aliases: records(presentation.aliases, (alias) => alias.term),
      contraindications: ((presentation as any).contraindications ?? [])
        .filter((record: any) => typeof record === 'object' && record !== null)
        .map((record: any) => ({ type: record.type, description: record.description })),
      adverseEffects: records(
        ((presentation as any).adverseEffects ?? []).filter((record: any) => typeof record === 'object' && record !== null),
        (record: any) => record.description,
      ),
      clinicalNotes: [
        ...((presentation as any).clinicalIndications ?? [])
          .filter((record: any) => typeof record === 'object' && record !== null)
          .map((item: any) => ({ type: 'indicacion_clinica' as const, description: item.name || item.description || '' })),
        ...((presentation as any).postCareNotes ?? [])
          .filter((record: any) => typeof record === 'object' && record !== null)
          .map((item: any) => ({ type: 'cuidado_post_aplicacion' as const, description: item.description || '' })),
        ...((presentation as any).safetyWarnings ?? [])
          .filter((record: any) => typeof record === 'object' && record !== null)
          .map((item: any) => ({ type: 'advertencia_seguridad' as const, description: item.description || '' })),
      ],
      reconstitution: {
        diluentType: value(presentation.reconstitution?.diluentType),
        volumeMl: value(presentation.reconstitution?.volumeMl),
        instructions: value(presentation.reconstitution?.instructions),
      },
      protocols: (presentation.protocols ?? []).map((record, protocolIndex) => {
        const protocol = populated(record, `presentations[${presentationIndex}].protocols[${protocolIndex}]`) as Protocol
        return {
          name: protocol.name,
          visibleEffectsOnset: value((protocol as any).visibleEffectsOnset),
          effectDuration: value((protocol as any).effectDuration),
          recommendedDose: value((protocol as any).recommendedDose),
          injectionDepth: value((protocol as any).injectionDepth),
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
