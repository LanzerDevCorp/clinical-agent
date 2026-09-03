import { describe, expect, it } from 'vitest'

import { factsToText, groupDetailFacts } from '@/app/(frontend)/agent/ClinicalFacts'
import type { ClinicalFact } from '@/lib/clinical-agent/agent/contracts'
import type { ProductDetails } from '@/lib/clinical-agent/contracts'

function shell(productId: string, presentationId: string): ProductDetails {
  return {
    product: {
      id: productId, canonicalName: 'L-CARNITINE',
      description: null, productType: null, laboratory: '',
    },
    presentation: {
      id: presentationId, canonicalName: 'Ampolleta de 5 ml',
      characteristics: null, certifications: null, protocols: [],
    },
  }
}

function identityFact(): ClinicalFact {
  const details = shell('27', 'p1')
  details.product.description = 'Reduce grasa localizada.'
  details.product.laboratory = 'Laboratorio MCCM'
  return { id: 'details:27:p1:identity', audience: 'internal', kind: 'details', clientEligible: true, group: 'identity', value: details }
}

function clinicalIndicationsFact(): ClinicalFact {
  const details = shell('27', 'p1')
  details.presentation.clinicalIndications = ['Reducción de grasa localizada']
  return { id: 'details:27:p1:clinicalIndications', audience: 'internal', kind: 'details', clientEligible: true, group: 'clinicalIndications', value: details }
}

function contraindicationsFact(): ClinicalFact {
  const details = shell('27', 'p1')
  details.presentation.contraindications = [{ description: 'Embarazo', type: 'absoluta' }]
  return { id: 'details:27:p1:contraindications', audience: 'internal', kind: 'details', clientEligible: false, group: 'contraindications', value: details }
}

function otherProductIdentityFact(): ClinicalFact {
  const details = shell('69', 'p2')
  details.product.canonicalName = 'AGUJAS DE MESOTERAPIA'
  details.product.laboratory = 'Otro laboratorio'
  return { id: 'details:69:p2:identity', audience: 'internal', kind: 'details', clientEligible: true, group: 'identity', value: details }
}

function searchFact(): ClinicalFact {
  return { id: 'search:0', audience: 'internal', kind: 'search', clientEligible: true, value: { kind: 'match', product: { id: '27', canonicalName: 'L-CARNITINE' }, presentation: { id: 'p1', canonicalName: 'Ampolleta de 5 ml' } } }
}

function protocolFact(): ClinicalFact {
  return {
    id: 'protocol:27:p1:1', audience: 'client', kind: 'protocol', clientEligible: true,
    value: { id: '1', name: 'Protocolo Mesoterapia Lipolítica', zones: [], routes: [], techniques: [] },
  }
}

describe('groupDetailFacts', () => {
  it('merges same-identity details facts into a single item', () => {
    const items = groupDetailFacts([identityFact(), clinicalIndicationsFact(), contraindicationsFact()])
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('details')
    if (items[0].kind !== 'details') throw new Error('unreachable')
    expect(items[0].details.product.description).toBe('Reduce grasa localizada.')
    expect(items[0].details.presentation.clinicalIndications).toEqual(['Reducción de grasa localizada'])
    expect(items[0].details.presentation.contraindications).toEqual([{ description: 'Embarazo', type: 'absoluta' }])
  })

  it('keeps distinct identities as separate items, without mixing their fields', () => {
    const items = groupDetailFacts([identityFact(), otherProductIdentityFact()])
    expect(items).toHaveLength(2)
    if (items[0].kind !== 'details' || items[1].kind !== 'details') throw new Error('unreachable')
    expect(items[0].details.product.canonicalName).toBe('L-CARNITINE')
    expect(items[1].details.product.canonicalName).toBe('AGUJAS DE MESOTERAPIA')
    expect(items[0].details.product.laboratory).toBe('Laboratorio MCCM')
    expect(items[1].details.product.laboratory).toBe('Otro laboratorio')
  })

  it('never groups search or protocol facts, one item per fact', () => {
    const items = groupDetailFacts([searchFact(), protocolFact(), protocolFact()])
    expect(items).toHaveLength(3)
    expect(items.every((item) => item.kind === 'other')).toBe(true)
  })

  it('groups non-consecutive same-identity facts at the position of the first', () => {
    const items = groupDetailFacts([identityFact(), searchFact(), clinicalIndicationsFact()])
    expect(items).toHaveLength(2)
    expect(items[0].kind).toBe('details')
    expect(items[1].kind).toBe('other')
    if (items[0].kind !== 'details') throw new Error('unreachable')
    expect(items[0].details.presentation.clinicalIndications).toEqual(['Reducción de grasa localizada'])
  })
})

describe('factsToText', () => {
  it('does not repeat the product/presentation line for multiple details facts of the same product', () => {
    const text = factsToText([identityFact(), clinicalIndicationsFact(), contraindicationsFact()])
    const occurrences = text.split('L-CARNITINE — Ampolleta de 5 ml').length - 1
    expect(occurrences).toBe(1)
  })

  it('prints one header per distinct product', () => {
    const text = factsToText([identityFact(), otherProductIdentityFact()])
    expect(text).toContain('L-CARNITINE — Ampolleta de 5 ml')
    expect(text).toContain('AGUJAS DE MESOTERAPIA — Ampolleta de 5 ml')
  })
})
