import { describe, expect, it } from 'vitest'

import { createVocabularyIndex, normalizeCanonicalText } from '@/scripts/lib/vocabulary-index'

describe('normalizeCanonicalText', () => {
  it('ignora mayúsculas, acentos y puntuación', () => {
    expect(normalizeCanonicalText('Embarazo y Lactancia')).toBe(
      normalizeCanonicalText('EMBARAZO  Y  LACTANCIA.'),
    )
  })

  it('conserva los números', () => {
    expect(normalizeCanonicalText('esperar 12 horas')).toContain('12')
  })
})

describe('createVocabularyIndex — igualdad exacta (regla 3)', () => {
  const records = [
    { id: 1, text: 'Embarazo' },
    { id: 2, text: 'Lactancia' },
  ]

  it('resuelve por igualdad exacta normalizada', () => {
    const index = createVocabularyIndex(records)

    expect(index.resolve('embarazo')).toEqual({ kind: 'exact', id: 1 })
    expect(index.resolve('  EMBARAZO  ')).toEqual({ kind: 'exact', id: 1 })
    expect(index.resolve('Embarazo.')).toEqual({ kind: 'exact', id: 1 })
  })

  it('reporta un término desconocido como nuevo, sin parecido', () => {
    const index = createVocabularyIndex(records)

    expect(index.resolve('Diabetes tipo 2')).toEqual({ kind: 'new' })
  })

  it('NUNCA fusiona un casi-duplicado: crea el registro nuevo y lo reporta', () => {
    const index = createVocabularyIndex(records)
    const resolution = index.resolve('Embarazos')

    // El registro nuevo se crea igual. Lo que cambia es que queda reportado:
    // fusionar por parecido es exactamente lo que borra una distinción clínica.
    expect(resolution.kind).toBe('near')
    if (resolution.kind === 'near') {
      expect(resolution.matched).toBe('Embarazo')
      expect(resolution.matchedId).toBe(1)
    }
  })

  it('no fusiona dos laboratorios que solo comparten el país', () => {
    // El caso real que atrapó el primer ensayo: 4 de 5 tokens compartidos
    // ("inc", "corea", "del", "sur") daban 0.80 y fusionaban dos empresas
    // coreanas distintas. CELOSOME habría quedado atribuido a HUGEL.
    const labs = createVocabularyIndex([{ id: 21, text: 'HUGEL Inc., Corea del Sur' }])
    const resolution = labs.resolve('ExoCoBio Inc, Corea del Sur')

    expect(resolution.kind).not.toBe('exact')
    if (resolution.kind === 'near') {
      expect(resolution.matchedId).toBe(21)
    }
  })
})

describe('createVocabularyIndex — números (reglas 4 y 5)', () => {
  const records = [
    { id: 3, text: 'No realizar ejercicio durante las primeras 12 horas' },
    { id: 4, text: 'Evitar exposición solar por 24 horas' },
  ]

  it('separa dos textos que solo difieren en un número, sin reportarlos', () => {
    const index = createVocabularyIndex(records)
    const resolution = index.resolve('No realizar ejercicio durante las primeras 24 horas')

    // Son dos registros y no hay nada que discutir: el veto numérico gana sobre
    // cualquier similitud, y por eso esto ni siquiera se reporta como dudoso.
    expect(resolution).toEqual({ kind: 'new' })
  })

  it('aplica el veto aunque los números sean de una cifra', () => {
    const index = createVocabularyIndex([{ id: 5, text: 'Aplicar 1 sesión por semana' }])

    expect(index.resolve('Aplicar 3 sesiones por semana').kind).toBe('new')
  })

  it('distingue concentraciones que solo difieren en el número', () => {
    const index = createVocabularyIndex([
      { id: 6, text: 'Ácido Hialurónico reticulado 20 mg/ml' },
    ])

    expect(index.resolve('Ácido Hialurónico reticulado 24 mg/ml')).toEqual({ kind: 'new' })
  })

  it('sigue resolviendo por igualdad exacta cuando los números coinciden', () => {
    const index = createVocabularyIndex(records)

    expect(index.resolve('Evitar exposición solar por 24 horas')).toEqual({ kind: 'exact', id: 4 })
  })

  it('trata como distintos un texto con número y el mismo sin número', () => {
    const index = createVocabularyIndex([{ id: 7, text: 'Reposo absoluto 48 horas' }])

    expect(index.resolve('Reposo absoluto').kind).toBe('new')
  })
})

describe('createVocabularyIndex — registro durante la corrida', () => {
  it('reutiliza un término registrado durante la misma corrida', () => {
    const index = createVocabularyIndex([{ id: 1, text: 'Embarazo' }])

    expect(index.resolve('Diabetes tipo 2')).toEqual({ kind: 'new' })

    // Sin esto, dos productos del mismo lote que traen el mismo término nuevo lo
    // crearían dos veces: el segundo no lo encuentra porque la precarga es una foto.
    index.register('Diabetes tipo 2', 99)

    expect(index.resolve('Diabetes tipo 2')).toEqual({ kind: 'exact', id: 99 })
  })

  it('cuenta lo que tiene cargado', () => {
    const index = createVocabularyIndex([{ id: 1, text: 'Embarazo' }])
    expect(index.size).toBe(1)

    index.register('Diabetes tipo 2', 99)
    expect(index.size).toBe(2)
  })

  it('tolera un índice vacío', () => {
    const index = createVocabularyIndex([])

    expect(index.size).toBe(0)
    expect(index.resolve('Embarazo')).toEqual({ kind: 'new' })
  })
})
