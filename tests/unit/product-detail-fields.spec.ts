import { describe, expect, it } from 'vitest'

import type { ProductDetails } from '@/lib/clinical-agent/contracts'
import { isClientEligibleField, productDetailFieldGroups } from '@/lib/clinical-agent/agent/detailFields'

const FULL_DETAILS: ProductDetails = {
  product: {
    id: 'product-1', canonicalName: 'L-CARNITINE', description: 'Lipolytic agent',
    productType: 'injectable', laboratory: 'Acme Labs', activeIngredients: ['L-Carnitine'],
  },
  presentation: {
    id: 'presentation-1', canonicalName: '10 vials',
    characteristics: 'Clear solution', certifications: 'INVIMA',
    contraindications: [{ description: 'Pregnancy', type: 'absoluta' }],
    adverseEffects: ['Local irritation'],
    clinicalIndications: ['Localized fat reduction'],
    postCareNotes: ['Avoid sun exposure'],
    safetyWarnings: ['Do not exceed recommended dose'],
    reconstitution: { diluentType: 'Saline', volumeMl: 5, instructions: 'Dilute before use' },
    protocols: [{ id: 'protocol-1', name: 'Standard protocol', zones: [], routes: [], techniques: [] }],
  },
}

describe('productDetailFieldGroups', () => {
  it('splits details into one partial ProductDetails per populated field group', () => {
    const groups = productDetailFieldGroups(FULL_DETAILS)

    expect(Object.keys(groups).sort()).toEqual([
      'adverseEffects', 'clinicalIndications', 'contraindications', 'identity',
      'postCareNotes', 'presentationInfo', 'protocols', 'reconstitution', 'safetyWarnings',
    ])
  })

  it('every group carries full product and presentation identity, even when the group itself is unrelated', () => {
    const groups = productDetailFieldGroups(FULL_DETAILS)

    for (const group of Object.values(groups)) {
      expect(group!.product.id).toBe('product-1')
      expect(group!.product.canonicalName).toBe('L-CARNITINE')
      expect(group!.presentation.id).toBe('presentation-1')
      expect(group!.presentation.canonicalName).toBe('10 vials')
    }
  })

  it('the clinicalIndications group carries only that field, nothing else from the sheet', () => {
    const groups = productDetailFieldGroups(FULL_DETAILS)

    expect(groups.clinicalIndications!.presentation.clinicalIndications).toEqual(['Localized fat reduction'])
    expect(groups.clinicalIndications!.presentation.contraindications).toBeUndefined()
    expect(groups.clinicalIndications!.presentation.adverseEffects).toBeUndefined()
    expect(groups.clinicalIndications!.presentation.protocols).toEqual([])
    expect(groups.clinicalIndications!.product.description).toBeNull()
  })

  it('the identity group carries description, type, laboratory and ingredients, nothing clinical', () => {
    const groups = productDetailFieldGroups(FULL_DETAILS)

    expect(groups.identity!.product.description).toBe('Lipolytic agent')
    expect(groups.identity!.product.productType).toBe('injectable')
    expect(groups.identity!.product.laboratory).toBe('Acme Labs')
    expect(groups.identity!.product.activeIngredients).toEqual(['L-Carnitine'])
    expect(groups.identity!.presentation.clinicalIndications).toBeUndefined()
  })

  it('omits a group entirely when the sheet has nothing for it', () => {
    const sparse: ProductDetails = {
      product: { id: 'p', canonicalName: 'Sparse', description: null, productType: null, laboratory: 'Lab' },
      presentation: { id: 'pr', canonicalName: 'Only presentation', characteristics: null, certifications: null, protocols: [] },
    }
    const groups = productDetailFieldGroups(sparse)

    expect(Object.keys(groups)).toEqual(['identity'])
  })
})

describe('isClientEligibleField', () => {
  it('marks identity, clinicalIndications and presentationInfo as client-eligible', () => {
    expect(isClientEligibleField('identity')).toBe(true)
    expect(isClientEligibleField('clinicalIndications')).toBe(true)
    expect(isClientEligibleField('presentationInfo')).toBe(true)
  })

  it('keeps contraindications, adverse effects, post-care, safety warnings, reconstitution and protocols internal-only', () => {
    expect(isClientEligibleField('contraindications')).toBe(false)
    expect(isClientEligibleField('adverseEffects')).toBe(false)
    expect(isClientEligibleField('postCareNotes')).toBe(false)
    expect(isClientEligibleField('safetyWarnings')).toBe(false)
    expect(isClientEligibleField('reconstitution')).toBe(false)
    expect(isClientEligibleField('protocols')).toBe(false)
  })
})
