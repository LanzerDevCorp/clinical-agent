/**
 * Merge the presentations a batch brings in with the ones already stored.
 *
 * This used to pair them by array position: `cleanedPresentations[idx]` against
 * `existingDoc.presentations[idx]`. Position is not identity, and the first real
 * batch proved it — two sheets of the same commercial product (CLH LIPASE, one
 * lyophilised and one liquid) both sat at index 0, so the liquid one was merged
 * into the lyophilised one. The liquid presentation vanished, and the lyophilised
 * one was left pointing at the liquid protocol: not missing data, wrong data.
 *
 * Mapping over the *existing* list made it worse — a presentation the batch
 * brought and the base did not have had nowhere to land, and was dropped.
 *
 * So: presentations are matched by canonical name, unmatched incoming ones are
 * appended, and unmatched stored ones are kept exactly as they are.
 *
 * No Payload import: merging is pure, so it is tested without a database.
 */

export interface PresentationShape {
  canonicalName?: string
  [key: string]: unknown
}

/** Relationship arrays merged as sets when a presentation matches. */
const RELATION_FIELDS = [
  'contraindications',
  'postCareNotes',
  'safetyWarnings',
  'adverseEffects',
  'clinicalIndications',
] as const

function key(presentation: PresentationShape): string {
  return String(presentation.canonicalName ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Relations arrive as ids or as populated documents, depending on depth. */
function ids(value: unknown): Array<number | string> {
  if (!Array.isArray(value)) return []
  return value.map((item) =>
    item !== null && typeof item === 'object' && 'id' in item
      ? (item as { id: number | string }).id
      : (item as number | string),
  )
}

function mergeOne(existing: PresentationShape, incoming: PresentationShape): PresentationShape {
  // Existing wins on everything not listed below: what the doctor edited by hand
  // in the admin is worth more than what the sheet says a second time.
  const merged: PresentationShape = { ...existing }

  for (const field of RELATION_FIELDS) {
    merged[field] = Array.from(new Set([...ids(existing[field]), ...ids(incoming[field])]))
  }

  const incomingProtocols = ids(incoming.protocols)
  merged.protocols = incomingProtocols.length > 0 ? incomingProtocols : ids(existing.protocols)

  return merged
}

export function mergePresentations(
  existing: PresentationShape[],
  incoming: PresentationShape[],
): PresentationShape[] {
  if (incoming.length === 0) return existing

  const consumed = new Set<string>()

  const merged = existing.map((stored) => {
    const match = incoming.find((p) => key(p) === key(stored) && !consumed.has(key(p)))
    if (!match) return stored
    consumed.add(key(match))
    return mergeOne(stored, match)
  })

  const added = incoming.filter((p) => !consumed.has(key(p)))
  return [...merged, ...added]
}
