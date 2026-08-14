import { describe, expect, it } from 'vitest'

import {
  emptyPlan,
  renderReport,
  reportFileName,
  type FileResult,
  type Plan,
} from '@/scripts/lib/ingest-report'

const at = new Date('2026-08-14T18:30:00Z')

const results: FileResult[] = [
  { file: 'CELOSOME.md.json', outcome: 'created', name: 'CELOSOME' },
  { file: 'DNA.md.json', outcome: 'updated', name: 'DNA' },
  { file: 'FAT BURNER.md.json', outcome: 'error', message: 'name.trim is not a function' },
]

describe('reportFileName', () => {
  it('marca el ensayo en el propio nombre del archivo', () => {
    // Confundir el reporte de un ensayo con el de una carga real es confundir
    // "esto pasaría" con "esto pasó", así que se distinguen antes de abrirlos.
    expect(reportFileName(true, at)).toBe('ingest-20260814T183000Z-ensayo.md')
    expect(reportFileName(false, at)).toBe('ingest-20260814T183000Z.md')
  })
})

describe('renderReport — resultado por archivo (regla 9)', () => {
  it('lista cada archivo con su resultado', () => {
    const report = renderReport({ dryRun: false, plan: emptyPlan(), results, at })

    expect(report).toContain('CELOSOME.md.json')
    expect(report).toContain('DNA.md.json')
    expect(report).toContain('FAT BURNER.md.json')
  })

  it('incluye el mensaje de cada error', () => {
    const report = renderReport({ dryRun: false, plan: emptyPlan(), results, at })

    expect(report).toContain('name.trim is not a function')
  })

  it('cuenta creados, actualizados y errores', () => {
    const report = renderReport({ dryRun: false, plan: emptyPlan(), results, at })

    expect(report).toMatch(/Creados[^\n]*1/)
    expect(report).toMatch(/Actualizados[^\n]*1/)
    expect(report).toMatch(/Errores[^\n]*1/)
  })

  it('dice en la primera línea si nada se escribió', () => {
    const dry = renderReport({ dryRun: true, plan: emptyPlan(), results, at })
    const real = renderReport({ dryRun: false, plan: emptyPlan(), results, at })

    expect(dry).toMatch(/^# Ensayo/m)
    expect(real).toMatch(/^# Ingesta/m)
    expect(dry).toContain('No se escribió nada')
  })

  it('no inventa secciones cuando no hay nada que reportar', () => {
    const report = renderReport({ dryRun: false, plan: emptyPlan(), results, at })

    expect(report).not.toContain('CASI-DUPLICADOS')
    expect(report).not.toContain('TIPOS EN CONFLICTO')
  })
})

describe('renderReport — lo que necesita ojo humano', () => {
  const plan: Plan = {
    ...emptyPlan(),
    nearDuplicates: [
      {
        collection: 'laboratories',
        term: 'ExoCoBio Inc, Corea del Sur',
        matched: 'HUGEL Inc., Corea del Sur',
        matchedId: 21,
      },
    ],
    assumedTypes: [{ term: 'Dermatitis activa' }],
    typeConflicts: [
      { term: 'Embarazo', existing: 'relativa', incoming: 'absoluta', id: 7 },
    ],
    createdEntities: [{ collection: 'laboratories', term: 'ExoCoBio Inc, Corea del Sur' }],
  }

  it('reporta los casi-duplicados con ambos textos', () => {
    const report = renderReport({ dryRun: false, plan, results, at })

    expect(report).toContain('CASI-DUPLICADOS')
    expect(report).toContain('ExoCoBio Inc, Corea del Sur')
    expect(report).toContain('HUGEL Inc., Corea del Sur')
  })

  it('reporta las contraindicaciones cuyo tipo hubo que asumir', () => {
    const report = renderReport({ dryRun: false, plan, results, at })

    expect(report).toContain('Dermatitis activa')
  })

  it('reporta un conflicto de tipo diciendo que no se tocó nada', () => {
    const report = renderReport({ dryRun: false, plan, results, at })

    expect(report).toContain('TIPOS EN CONFLICTO')
    expect(report).toContain('relativa')
    expect(report).toContain('absoluta')
    expect(report).toMatch(/no se (tocó|modificó)/i)
  })

  it('agrupa el mismo conflicto en vez de repetirlo por producto', () => {
    // Un término compartido por siete productos daba siete líneas idénticas, y
    // la decisión que hay que tomar sigue siendo una sola.
    const repeated: Plan = {
      ...emptyPlan(),
      typeConflicts: Array.from({ length: 7 }, () => ({
        term: 'Enfermedades crónico-degenerativas en descontrol',
        existing: 'relativa',
        incoming: 'absoluta',
        id: 26,
      })),
    }

    const report = renderReport({ dryRun: false, plan: repeated, results, at })
    const mentions = report.match(/Enfermedades crónico-degenerativas en descontrol/g) ?? []

    expect(mentions).toHaveLength(1)
    expect(report).toContain('7 productos')
  })
})
