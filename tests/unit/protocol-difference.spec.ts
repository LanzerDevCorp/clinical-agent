import { describe, expect, it } from 'vitest'

import { describeProtocolDifference } from '@/scripts/lib/protocol-difference'

const stored = {
  zones: [1, 2],
  routes: [3],
  techniques: [4],
  visibleEffectsOnset: '7 días',
  effectDuration: '6 meses',
  recommendedDose: '1 ml',
  injectionDepth: 'Dermis media',
  sessionsMin: 1,
  sessionsMax: 3,
  frequency: 'Semanal',
}

describe('describeProtocolDifference', () => {
  it('no reporta diferencia cuando el protocolo llega igual', () => {
    expect(describeProtocolDifference(stored, { ...stored })).toEqual([])
  })

  it('ignora el orden de las relaciones', () => {
    // Las zonas son un conjunto: que vengan al revés no las cambia.
    expect(describeProtocolDifference(stored, { ...stored, zones: [2, 1] })).toEqual([])
  })

  it('nombra el campo que cambió', () => {
    const diff = describeProtocolDifference(stored, { ...stored, injectionDepth: 'Dermis profunda' })

    expect(diff).toHaveLength(1)
    expect(diff[0].field).toBe('injectionDepth')
    expect(diff[0].existing).toBe('Dermis media')
    expect(diff[0].incoming).toBe('Dermis profunda')
  })

  it('detecta una zona distinta', () => {
    const diff = describeProtocolDifference(stored, { ...stored, zones: [1, 9] })

    expect(diff.map((d) => d.field)).toContain('zones')
  })

  it('acumula varios campos cambiados', () => {
    const diff = describeProtocolDifference(stored, {
      ...stored,
      sessionsMax: 6,
      frequency: 'Quincenal',
    })

    expect(diff.map((d) => d.field).sort()).toEqual(['frequency', 'sessionsMax'])
  })

  it('trata null, undefined y cadena vacía como el mismo vacío', () => {
    // El extractor omite lo que la ficha no dice, y la base guarda null. Que un
    // campo ausente cuente como cambio llenaría el reporte de ruido.
    const withNulls = { ...stored, recommendedDose: null }
    expect(describeProtocolDifference(withNulls, { ...stored, recommendedDose: undefined })).toEqual([])
    expect(describeProtocolDifference(withNulls, { ...stored, recommendedDose: '' })).toEqual([])
  })

  it('reporta cuando la base tiene un dato y la ficha nueva no lo trae', () => {
    // Esto sí importa: el protocolo guardado dice algo que el lote nuevo no
    // confirma, y enlazarlo igual dejaría al producto nuevo con un dato ajeno.
    const diff = describeProtocolDifference(stored, { ...stored, injectionDepth: null })

    expect(diff.map((d) => d.field)).toContain('injectionDepth')
  })
})
