/**
 * Resolve the names a fixture uses into the ids a collection just handed out.
 * A name that resolves to nothing is a broken fixture, not a row to skip quietly.
 */
export function idsFor(
  labels: string[] | undefined,
  index: Map<string, number>,
  field: string,
): number[] {
  return (labels ?? []).map((label) => {
    const id = index.get(label)
    if (id === undefined) {
      throw new Error(`Fixture refers to "${label}" in ${field}, which the catalogue does not hold.`)
    }
    return id
  })
}
