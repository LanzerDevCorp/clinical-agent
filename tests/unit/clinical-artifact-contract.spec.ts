import { describe, expect, it } from 'vitest'

import { validateClinicalArtifact, type ClinicalFact } from '@/lib/clinical-agent/agent/contracts'

const searchFact: ClinicalFact = {
  id: 'search:0', audience: 'internal', kind: 'search', clientEligible: true,
  value: { kind: 'clarification', choices: [], truncated: false },
}
const identityFact: ClinicalFact = {
  id: 'details:1:1:identity', audience: 'internal', kind: 'details', clientEligible: true,
  value: {
    product: { id: '1', canonicalName: 'X', description: null, productType: null, laboratory: 'Lab' },
    presentation: { id: '1', canonicalName: 'X', characteristics: null, certifications: null, protocols: [] },
  },
}
const contraindicationsFact: ClinicalFact = {
  id: 'details:1:1:contraindications', audience: 'internal', kind: 'details', clientEligible: false,
  value: {
    product: { id: '1', canonicalName: 'X', description: null, productType: null, laboratory: '' },
    presentation: {
      id: '1', canonicalName: 'X', characteristics: null, certifications: null, protocols: [],
      contraindications: [{ description: 'Pregnancy', type: 'absoluta' }],
    },
  },
}
const protocolFact: ClinicalFact = {
  id: 'protocol:1:1:p1', audience: 'client', kind: 'protocol', clientEligible: true,
  value: { id: 'p1', name: 'Protocol', zones: [], routes: [], techniques: [] },
}

describe('validateClinicalArtifact — internalFactIds omitted vs provided', () => {
  it('derives every internal fact when internalFactIds is omitted (generic question)', () => {
    const facts = [searchFact, identityFact, contraindicationsFact]
    const artifact = validateClinicalArtifact({ clientFactIds: [] }, facts)

    expect(artifact?.internalFactIds.sort()).toEqual(facts.map((fact) => fact.id).sort())
  })

  it('narrows to exactly the allowlisted ids when internalFactIds is provided (scoped question)', () => {
    const facts = [searchFact, identityFact, contraindicationsFact]
    const artifact = validateClinicalArtifact({ clientFactIds: [], internalFactIds: [identityFact.id] }, facts)

    expect(artifact?.internalFactIds).toEqual([identityFact.id])
  })

  it('accepts an explicit empty internalFactIds as a valid "show nothing internal" selection', () => {
    const facts = [identityFact]
    const artifact = validateClinicalArtifact({ clientFactIds: [], internalFactIds: [] }, facts)

    expect(artifact).toEqual({ internalFactIds: [], clientFactIds: [] })
  })

  it('rejects an internalFactIds id that is not in the ledger, or not internal-audience', () => {
    const facts = [identityFact, protocolFact]
    expect(validateClinicalArtifact({ clientFactIds: [], internalFactIds: ['not-a-real-id'] }, facts)).toBeUndefined()
    // protocolFact is audience:'client', not a legal internalFactIds member.
    expect(validateClinicalArtifact({ clientFactIds: [], internalFactIds: [protocolFact.id] }, facts)).toBeUndefined()
  })

  it('still rejects a run that gathered nothing internal at all, regardless of the submitted selection', () => {
    expect(validateClinicalArtifact({ clientFactIds: [] }, [])).toBeUndefined()
  })
})

describe('validateClinicalArtifact — client eligibility gate', () => {
  it('accepts non-sensitive search and details facts in clientFactIds, not just protocols', () => {
    const facts = [searchFact, identityFact, protocolFact]
    const artifact = validateClinicalArtifact({ clientFactIds: [searchFact.id, identityFact.id, protocolFact.id] }, facts)

    expect(artifact?.clientFactIds.sort()).toEqual([searchFact.id, identityFact.id, protocolFact.id].sort())
  })

  it('rejects an always-internal details fact even if the model lists it in clientFactIds', () => {
    const facts = [identityFact, contraindicationsFact]
    const artifact = validateClinicalArtifact({ clientFactIds: [contraindicationsFact.id] }, facts)

    expect(artifact).toBeUndefined()
  })

  it('rejects an unknown or fabricated id in clientFactIds', () => {
    const facts = [identityFact]
    expect(validateClinicalArtifact({ clientFactIds: ['made-up-id'] }, facts)).toBeUndefined()
  })
})
