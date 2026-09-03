import type { ProductDetails } from '../contracts'

/**
 * One entry per group a scoped question can point at. `protocols` is here only
 * for the internal panel's full list — client access to protocols keeps going
 * through the existing per-protocol `clientShareable` facts in tools.ts, never
 * through this group.
 */
export type ProductDetailField =
  | 'identity'
  | 'clinicalIndications'
  | 'presentationInfo'
  | 'contraindications'
  | 'adverseEffects'
  | 'postCareNotes'
  | 'safetyWarnings'
  | 'reconstitution'
  | 'protocols'

/**
 * Fields safe to hand a patient when they ask about them directly. Everything
 * else is clinical-management data (dosing prep, contraindications, adverse
 * effects, safety warnings, post-care) that needs a professional in the loop,
 * so it stays internal-only regardless of audience.
 */
const CLIENT_ELIGIBLE_FIELDS: ReadonlySet<ProductDetailField> = new Set([
  'identity', 'clinicalIndications', 'presentationInfo',
])

export function isClientEligibleField(field: ProductDetailField): boolean {
  return CLIENT_ELIGIBLE_FIELDS.has(field)
}

/** Every field but the requested group cleared, identity always kept. */
function shell(details: ProductDetails): ProductDetails {
  return {
    product: {
      id: details.product.id,
      canonicalName: details.product.canonicalName,
      description: null,
      productType: null,
      laboratory: '',
    },
    presentation: {
      id: details.presentation.id,
      canonicalName: details.presentation.canonicalName,
      characteristics: null,
      certifications: null,
      protocols: [],
    },
  }
}

/**
 * Splits one full `ProductDetails` sheet into one partial `ProductDetails` per
 * populated field group, each carrying full product/presentation identity
 * plus only that group's data — everything else left at its "empty" value so
 * the existing `Details` renderer (which already hides empty fields) shows
 * just that group without any UI change.
 *
 * A group is omitted entirely when the source sheet has nothing for it, so a
 * scoped question never produces a fact with nothing to show.
 */
export function productDetailFieldGroups(details: ProductDetails): Partial<Record<ProductDetailField, ProductDetails>> {
  const groups: Partial<Record<ProductDetailField, ProductDetails>> = {}

  // Laboratory is required (non-null), so every sheet has an identity group.
  const identity = shell(details)
  identity.product.description = details.product.description
  identity.product.productType = details.product.productType
  identity.product.laboratory = details.product.laboratory
  if (details.product.activeIngredients) identity.product.activeIngredients = details.product.activeIngredients
  groups.identity = identity

  if (details.presentation.clinicalIndications?.length) {
    const fact = shell(details)
    fact.presentation.clinicalIndications = details.presentation.clinicalIndications
    groups.clinicalIndications = fact
  }

  if (details.presentation.characteristics || details.presentation.certifications) {
    const fact = shell(details)
    fact.presentation.characteristics = details.presentation.characteristics
    fact.presentation.certifications = details.presentation.certifications
    groups.presentationInfo = fact
  }

  if (details.presentation.contraindications?.length) {
    const fact = shell(details)
    fact.presentation.contraindications = details.presentation.contraindications
    groups.contraindications = fact
  }

  if (details.presentation.adverseEffects?.length) {
    const fact = shell(details)
    fact.presentation.adverseEffects = details.presentation.adverseEffects
    groups.adverseEffects = fact
  }

  if (details.presentation.postCareNotes?.length) {
    const fact = shell(details)
    fact.presentation.postCareNotes = details.presentation.postCareNotes
    groups.postCareNotes = fact
  }

  if (details.presentation.safetyWarnings?.length) {
    const fact = shell(details)
    fact.presentation.safetyWarnings = details.presentation.safetyWarnings
    groups.safetyWarnings = fact
  }

  if (details.presentation.reconstitution) {
    const fact = shell(details)
    fact.presentation.reconstitution = details.presentation.reconstitution
    groups.reconstitution = fact
  }

  if (details.presentation.protocols.length) {
    const fact = shell(details)
    fact.presentation.protocols = details.presentation.protocols
    groups.protocols = fact
  }

  return groups
}
