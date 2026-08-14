/**
 * In-memory index of one catalogue collection, built once per run.
 *
 * The loader used to resolve every term with two queries — an exact `find` and a
 * `find` pulling up to 500 documents to scan — and it did that per term and per
 * product. A batch of ten products asks for a few hundred round trips to answer
 * questions about a vocabulary that does not change while the batch runs.
 *
 * So it is read once and answered from memory. That is not only cheaper: it is
 * what makes a dry run possible at all, because resolving stops depending on
 * having written anything.
 *
 * No Payload import on purpose. This file holds the matching rules and nothing
 * else, so it can be tested without a database.
 */

/** One existing record: the id to link to, and the text it is recognised by. */
export interface EntityRecord {
  id: number
  text: string
}

/**
 * How a term resolved.
 *
 * Only `exact` links to an existing record. A near miss creates a new record and
 * is reported — merging by resemblance is what erases a clinical distinction, and
 * a machine cannot tell "the same thing worded differently" from "a different
 * thing worded similarly". A human can, so a human decides.
 */
export type Resolution =
  | { kind: 'exact'; id: number }
  | { kind: 'near'; matched: string; matchedId: number }
  | { kind: 'new' }

export interface VocabularyIndex {
  /** An existing id, a new record worth reporting, or a new record outright. */
  resolve: (value: string) => Resolution
  /** Teach the index a term created during this run, so it is reused, not recreated. */
  register: (value: string, id: number) => void
  /** How many records the index answers from, preloaded plus registered. */
  readonly size: number
}

/** Below this score two texts are unrelated enough not to be worth reporting. */
const NEAR_THRESHOLD = 0.8

export function normalizeCanonicalText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(y|o|e|u)\b/gi, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Every number in a text, as a set.
 *
 * This is what the numeric veto compares. Order does not matter and repetition
 * does not either: what matters is which quantities the text mentions.
 */
function numbersIn(normalized: string): Set<string> {
  const found = normalized.match(/\d+/g)
  return new Set(found ?? [])
}

function sameNumbers(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Tokens worth comparing: words of more than two letters, and every number.
 *
 * The old filter was `w.length > 2` alone, which dropped every one- and two-digit
 * number before comparing — so "primeras 12 horas" and "primeras 24 horas" scored
 * a perfect 1.00. It was blind exactly where clinical precision lives.
 */
function significantTokens(text: string): string[] {
  return Array.from(
    new Set(
      normalizeCanonicalText(text)
        .split(' ')
        .filter((w) => w.length > 2 || /^\d+$/.test(w)),
    ),
  )
}

function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = significantTokens(str1)
  const tokens2 = significantTokens(str2)
  if (tokens1.length === 0 || tokens2.length === 0) return 0

  let matches = 0
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      // Numbers only ever match themselves: the edit distance between "12" and
      // "24" is small, and treating that as a near miss is the whole defect.
      const numeric = /^\d+$/.test(t1) || /^\d+$/.test(t2)
      const equal = t1 === t2
      const close =
        !numeric && t1.length >= 4 && t2.length >= 4 && levenshteinDistance(t1, t2) <= 2

      if (equal || close) {
        matches++
        break
      }
    }
  }
  return matches / Math.max(tokens1.length, tokens2.length)
}

export function createVocabularyIndex(records: EntityRecord[]): VocabularyIndex {
  const byNormalized = new Map<string, number>()
  const all: Array<EntityRecord & { normalized: string; numbers: Set<string> }> = []

  const add = (value: string, id: number) => {
    const normalized = normalizeCanonicalText(value)
    // First writer wins: a later duplicate is the same record under another
    // spelling, and repointing the key would silently move existing links.
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, id)
    all.push({ id, text: value, normalized, numbers: numbersIn(normalized) })
  }

  for (const record of records) add(record.text, record.id)

  return {
    resolve(value: string): Resolution {
      const normalized = normalizeCanonicalText(value)

      const exact = byNormalized.get(normalized)
      if (exact !== undefined) return { kind: 'exact', id: exact }

      const numbers = numbersIn(normalized)

      for (const candidate of all) {
        // Numeric veto: different quantities are different records, however alike
        // the wording. "12 horas" and "24 horas" are not a doubtful pair — they
        // are simply two records, so this case is not even worth reporting.
        if (!sameNumbers(numbers, candidate.numbers)) continue

        if (tokenSimilarity(value, candidate.text) >= NEAR_THRESHOLD) {
          return { kind: 'near', matched: candidate.text, matchedId: candidate.id }
        }
      }

      return { kind: 'new' }
    },

    register(value: string, id: number) {
      add(value, id)
    },

    get size() {
      return all.length
    },
  }
}
