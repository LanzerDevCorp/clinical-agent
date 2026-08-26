import { describe, expect, it } from 'vitest'

import { idsFor } from '@/scripts/lib/fixture-ids'

describe('idsFor', () => {
  const index = new Map([
    ['Embarazo y lactancia', 1],
    ['Hipersensibilidad', 2],
  ])

  it('resolves known labels to their ids, in order', () => {
    expect(idsFor(['Hipersensibilidad', 'Embarazo y lactancia'], index, 'contraindications')).toEqual([
      2, 1,
    ])
  })

  it('returns an empty array for undefined labels', () => {
    expect(idsFor(undefined, index, 'contraindications')).toEqual([])
  })

  it('returns an empty array for an empty list', () => {
    expect(idsFor([], index, 'contraindications')).toEqual([])
  })

  it('throws when a label is not in the index', () => {
    expect(() => idsFor(['Alergia al níquel'], index, 'contraindications')).toThrow(
      /Alergia al níquel.*contraindications/s,
    )
  })
})
