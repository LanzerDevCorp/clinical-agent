/**
 * Compare a stored protocol against the one a batch is bringing in.
 *
 * The loader identifies protocols by name, and `protocols.name` carries no unique
 * index — so two different protocols under one name are one record in the base.
 * The old behaviour was to `update` whatever it found, which meant the second
 * product to use a name silently overwrote the first one's zones, depth and dose.
 *
 * Those protocols hang off presentations of products the doctor already approved,
 * so this is the same case as a shared clinical record: it is not rewritten, the
 * disagreement is reported, and a human decides.
 *
 * No Payload import: comparison is pure, so it is tested without a database.
 */

/** The fields that carry a protocol's clinical content. Names are the identity. */
const SCALAR_FIELDS = [
  'visibleEffectsOnset',
  'effectDuration',
  'recommendedDose',
  'injectionDepth',
  'sessionsMin',
  'sessionsMax',
  'frequency',
] as const

const RELATION_FIELDS = ['zones', 'routes', 'techniques'] as const

export interface ProtocolShape {
  zones?: unknown
  routes?: unknown
  techniques?: unknown
  visibleEffectsOnset?: unknown
  effectDuration?: unknown
  recommendedDose?: unknown
  injectionDepth?: unknown
  sessionsMin?: unknown
  sessionsMax?: unknown
  frequency?: unknown
}

export interface FieldDifference {
  field: string
  existing: string
  incoming: string
}

/** `null`, `undefined` and `''` all mean "the sheet did not say". */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function show(value: unknown): string {
  if (isBlank(value)) return '(vacío)'
  if (Array.isArray(value)) return `[${value.map(idOf).join(', ')}]`
  return String(value)
}

/** Relations arrive as ids or as populated documents, depending on depth. */
function idOf(item: unknown): number | string {
  if (item !== null && typeof item === 'object' && 'id' in item) {
    return (item as { id: number | string }).id
  }
  return item as number | string
}

/** Relations are sets: a different order is not a different protocol. */
function sameRelation(a: unknown, b: unknown): boolean {
  const left = (Array.isArray(a) ? a : []).map(idOf).sort()
  const right = (Array.isArray(b) ? b : []).map(idOf).sort()
  return left.length === right.length && left.every((value, i) => value === right[i])
}

export function describeProtocolDifference(
  existing: ProtocolShape,
  incoming: ProtocolShape,
): FieldDifference[] {
  const differences: FieldDifference[] = []

  for (const field of RELATION_FIELDS) {
    if (!sameRelation(existing[field], incoming[field])) {
      differences.push({
        field,
        existing: show(existing[field]),
        incoming: show(incoming[field]),
      })
    }
  }

  for (const field of SCALAR_FIELDS) {
    const before = existing[field]
    const after = incoming[field]

    if (isBlank(before) && isBlank(after)) continue
    if (String(before) === String(after)) continue

    differences.push({ field, existing: show(before), incoming: show(after) })
  }

  return differences
}
