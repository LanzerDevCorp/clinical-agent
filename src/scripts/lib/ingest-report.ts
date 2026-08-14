/**
 * The written record of one ingest run.
 *
 * The console output scrolls past and dies with the terminal. What the loader
 * decided about shared records has to outlive that: it is what the reviewer works
 * from, what gets compared against the next batch, and — when a dry run is
 * reviewed before the real thing — the only place both runs can be set side by
 * side.
 *
 * Markdown on purpose. A person reads it in the editor and an agent reads it as
 * text; a JSON blob would serve the second and lose the first.
 *
 * No Payload import: rendering is pure, so it is tested without a database.
 */

/**
 * What the run did, or would do. Every shared-record decision lands here: those
 * are the ones that touch data the doctor already approved, and the ones a dry
 * run exists to show before anything is written.
 */
export interface Plan {
  reused: Array<{ collection: string; term: string; id: number }>
  /** Created anyway, but close enough to an existing record to deserve a look. */
  nearDuplicates: Array<{ collection: string; term: string; matched: string; matchedId: number }>
  createdEntities: Array<{ collection: string; term: string }>
  /** Contraindications the sheet did not type, created `absoluta` on the safe side. */
  assumedTypes: Array<{ term: string }>
  /** The JSON types a contraindication differently than the record already in the base. */
  typeConflicts: Array<{ term: string; existing: string; incoming: string; id: number }>
  protocols: Array<{ name: string; action: 'reuse' | 'create' }>
  /** A stored protocol already holds that name with different clinical content. */
  protocolConflicts: Array<{
    name: string
    id: number
    differences: Array<{ field: string; existing: string; incoming: string }>
  }>
  products: Array<{ name: string; action: 'create' | 'update' }>
}

export interface FileResult {
  file: string
  outcome: 'created' | 'updated' | 'error'
  /** The product's canonical name, absent when the file failed before naming one. */
  name?: string
  /** Why it failed. Only on `error`. */
  message?: string
}

export function emptyPlan(): Plan {
  return {
    reused: [],
    nearDuplicates: [],
    createdEntities: [],
    assumedTypes: [],
    typeConflicts: [],
    protocols: [],
    protocolConflicts: [],
    products: [],
  }
}

type TypeConflict = Plan['typeConflicts'][number]

/** One entry per distinct disagreement, keeping every product that hit it. */
function groupConflicts(rows: TypeConflict[]): Map<string, TypeConflict[]> {
  const grouped = new Map<string, TypeConflict[]>()
  for (const row of rows) {
    const key = `${row.id}|${row.existing}|${row.incoming}`
    const bucket = grouped.get(key)
    if (bucket) bucket.push(row)
    else grouped.set(key, [row])
  }
  return grouped
}

/** `20260814T183000Z`, which sorts chronologically as plain text. */
function stamp(at: Date): string {
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

export function reportFileName(dryRun: boolean, at: Date): string {
  return `ingest-${stamp(at)}${dryRun ? '-ensayo' : ''}.md`
}

interface ReportInput {
  dryRun: boolean
  plan: Plan
  results: FileResult[]
  at: Date
}

export function renderReport({ dryRun, plan, results, at }: ReportInput): string {
  const created = results.filter((r) => r.outcome === 'created').length
  const updated = results.filter((r) => r.outcome === 'updated').length
  const errors = results.filter((r) => r.outcome === 'error')

  const lines: string[] = []
  const would = (past: string, conditional: string) => (dryRun ? conditional : past)

  lines.push(`# ${dryRun ? 'Ensayo de ingesta' : 'Ingesta'} — ${at.toISOString()}`)
  lines.push('')

  if (dryRun) {
    lines.push('**No se escribió nada.** Esto es lo que haría la corrida real.')
    lines.push('')
  }

  lines.push('## Resumen')
  lines.push('')
  lines.push(`- Archivos: ${results.length}`)
  lines.push(`- ${would('Creados', 'Se crearían')}: ${created}`)
  lines.push(`- ${would('Actualizados', 'Se actualizarían')}: ${updated}`)
  lines.push(`- Errores: ${errors.length}`)
  lines.push('')

  // The shared records come before the products on purpose. A product enters
  // PENDING and stays invisible to the chat until the doctor approves it; the
  // contraindications, warnings and post-care notes attach to products already
  // approved. That is the half worth reading first.
  lines.push('## Registros compartidos')
  lines.push('')
  lines.push(`- Reutilizados por igualdad exacta: ${plan.reused.length}`)
  lines.push(`- ${would('Creados', 'Se crearían')}: ${plan.createdEntities.length}`)
  lines.push('')

  if (plan.createdEntities.length > 0) {
    for (const row of plan.createdEntities) {
      lines.push(`- \`${row.collection}\` — ${row.term}`)
    }
    lines.push('')
  }

  if (plan.nearDuplicates.length > 0) {
    lines.push(`## ⚠ CASI-DUPLICADOS (${plan.nearDuplicates.length})`)
    lines.push('')
    lines.push(
      `${would('Se creó', 'Se crearía')} el registro nuevo y no se ${would('fusionó', 'fusionaría')} nada.`,
    )
    lines.push('Si de verdad son el mismo término, se unifican a mano desde el admin.')
    lines.push('')
    for (const row of plan.nearDuplicates) {
      lines.push(`- \`${row.collection}\` — **${row.term}**`)
      lines.push(`  se parece a *${row.matched}* (ID: ${row.matchedId})`)
    }
    lines.push('')
  }

  if (plan.assumedTypes.length > 0) {
    lines.push(`## ⚠ Contraindicaciones sin tipo (${plan.assumedTypes.length})`)
    lines.push('')
    lines.push(
      `La ficha no permitía decidir. ${would('Se crearon', 'Se crearían')} \`absoluta\`, el lado seguro.`,
    )
    lines.push('La doctora confirma o las baja a `relativa`.')
    lines.push('')
    for (const row of plan.assumedTypes) {
      lines.push(`- ${row.term}`)
    }
    lines.push('')
  }

  if (plan.typeConflicts.length > 0) {
    lines.push(`## ⚠ TIPOS EN CONFLICTO (${groupConflicts(plan.typeConflicts).size})`)
    lines.push('')
    lines.push(
      `El registro compartido **no se ${would('tocó', 'tocaría')}**: cuelga de productos que la`,
    )
    lines.push('doctora ya aprobó. Se resuelve a mano desde el admin.')
    lines.push('')
    // Grouped: a term shared by seven products produced seven identical lines,
    // and the decision to take is still one.
    for (const [, group] of groupConflicts(plan.typeConflicts)) {
      const [row] = group
      const shared = group.length > 1 ? ` — lo traen ${group.length} productos` : ''
      lines.push(`- **${row.term}** (ID: ${row.id})${shared}`)
      lines.push(`  en base: \`${row.existing}\` · la ficha dice: \`${row.incoming}\``)
    }
    lines.push('')
  }

  const protocolsCreated = plan.protocols.filter((p) => p.action === 'create').length
  lines.push('## Protocolos')
  lines.push('')
  lines.push(`- ${would('Creados', 'Se crearían')}: ${protocolsCreated}`)
  lines.push(`- Enlazados a uno existente: ${plan.protocols.length - protocolsCreated}`)
  lines.push('')

  if (plan.protocolConflicts.length > 0) {
    lines.push(`## ⚠ PROTOCOLOS EN CONFLICTO (${plan.protocolConflicts.length})`)
    lines.push('')
    lines.push('Ese nombre ya existe con otro contenido clínico. El protocolo guardado')
    lines.push(`**no se ${would('tocó', 'tocaría')}**: cuelga de presentaciones ya aprobadas. O son`)
    lines.push('el mismo protocolo, o el nuevo necesita un nombre que los distinga.')
    lines.push('')
    for (const row of plan.protocolConflicts) {
      lines.push(`- **${row.name}** (ID: ${row.id})`)
      for (const d of row.differences) {
        lines.push(`  - \`${d.field}\` — en base: ${d.existing} · la ficha dice: ${d.incoming}`)
      }
    }
    lines.push('')
  }

  lines.push('## Resultado por archivo')
  lines.push('')
  for (const row of results) {
    if (row.outcome === 'error') {
      lines.push(`- ❌ \`${row.file}\` — ${row.message}`)
    } else {
      const verb = row.outcome === 'created' ? would('creado', 'se crearía') : would('actualizado', 'se actualizaría')
      lines.push(`- \`${row.file}\` — ${row.name} (${verb})`)
    }
  }
  lines.push('')

  if (errors.length > 0) {
    lines.push('## Qué hacer con los errores')
    lines.push('')
    lines.push('La corrida terminó igual y salió con código 1. Un archivo que falló no')
    lines.push('se reintenta a ciegas: primero se entiende por qué falló.')
    lines.push('')
  }

  return lines.join('\n')
}
