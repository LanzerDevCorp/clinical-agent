import { describe, expect, it } from 'vitest'

import type { ClinicalFact } from '@/lib/clinical-agent/agent/contracts'
import { clientEmptyLabel, PROFESSIONAL_ONLY_LABEL } from '@/app/(frontend)/agent/clientEmptyLabel'

const eligibleDetailsFact: ClinicalFact = {
  id: 'details:1:1:identity', audience: 'internal', kind: 'details', clientEligible: true,
  value: {
    product: { id: '1', canonicalName: 'X', description: null, productType: null, laboratory: 'Lab' },
    presentation: { id: '1', canonicalName: 'X', characteristics: null, certifications: null, protocols: [] },
  },
}
const alwaysInternalDetailsFact: ClinicalFact = {
  id: 'details:1:1:contraindications', audience: 'internal', kind: 'details', clientEligible: false,
  value: {
    product: { id: '1', canonicalName: 'X', description: null, productType: null, laboratory: '' },
    presentation: { id: '1', canonicalName: 'X', characteristics: null, certifications: null, protocols: [] },
  },
}
const searchFact: ClinicalFact = {
  id: 'search:0', audience: 'internal', kind: 'search', clientEligible: true,
  value: { kind: 'empty' },
}

describe('clientEmptyLabel', () => {
  it('uses the "no protocol shareable" label when nothing internal-only was asked for', () => {
    expect(clientEmptyLabel([eligibleDetailsFact, searchFact])).toBe(
      'Ningún protocolo está autorizado para compartir con el paciente.',
    )
  })

  it('uses the professional-redirect label when an always-internal field was asked for and none reached the client', () => {
    expect(clientEmptyLabel([alwaysInternalDetailsFact])).toBe(PROFESSIONAL_ONLY_LABEL)
  })

  it('still uses the professional-redirect label when mixed with eligible facts, as long as one is always-internal', () => {
    expect(clientEmptyLabel([eligibleDetailsFact, alwaysInternalDetailsFact])).toBe(PROFESSIONAL_ONLY_LABEL)
  })
})
