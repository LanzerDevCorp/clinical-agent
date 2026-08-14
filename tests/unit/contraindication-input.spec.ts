import { describe, expect, it } from 'vitest'

import { readContraindication } from '@/scripts/lib/contraindication-input'

describe('readContraindication — el tipo llega en el JSON (regla 6)', () => {
  it('toma el tipo que declara el extractor', () => {
    expect(readContraindication({ description: 'Embarazo', type: 'absoluta' })).toEqual({
      description: 'Embarazo',
      type: 'absoluta',
      assumed: false,
    })

    expect(readContraindication({ description: 'Rosácea', type: 'relativa' })).toEqual({
      description: 'Rosácea',
      type: 'relativa',
      assumed: false,
    })
  })

  it('sin tipo asume `absoluta` y lo marca para el reporte', () => {
    // El lado seguro es prohibir. Pero asumir en silencio convierte una duda de
    // la ficha en un dato afirmado, así que queda marcado para que lo mire la doctora.
    expect(readContraindication({ description: 'Dermatitis activa' })).toEqual({
      description: 'Dermatitis activa',
      type: 'absoluta',
      assumed: true,
    })
  })

  it('acepta una cadena suelta, como la traían los JSON viejos', () => {
    expect(readContraindication('Embarazo')).toEqual({
      description: 'Embarazo',
      type: 'absoluta',
      assumed: true,
    })
  })

  it('recorta los espacios de la descripción', () => {
    expect(readContraindication({ description: '  Embarazo  ', type: 'relativa' })).toEqual({
      description: 'Embarazo',
      type: 'relativa',
      assumed: false,
    })
  })

  it('trata un tipo desconocido como ausente', () => {
    // Un valor que el esquema no admite no es información: es un dato roto, y se
    // resuelve como se resuelve la ausencia — lado seguro y reportado.
    expect(readContraindication({ description: 'Embarazo', type: 'quizás' as never })).toEqual({
      description: 'Embarazo',
      type: 'absoluta',
      assumed: true,
    })
  })

  it('rechaza una entrada sin descripción utilizable', () => {
    expect(() => readContraindication({ description: '   ' })).toThrow(/descripción/i)
    expect(() => readContraindication('')).toThrow(/descripción/i)
    expect(() => readContraindication(null as never)).toThrow(/descripción/i)
  })
})
