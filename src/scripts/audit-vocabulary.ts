/**
 * Audit the shared catalogue for records that mean the same thing.
 *
 * The loader already reports near duplicates, but only in one direction: an
 * incoming term against what exists. Nothing has ever compared the existing
 * records with each other, so every pair that entered together — or entered
 * before the detector did — is still sitting there unexamined. The albumin pair
 * (contraindications 3 and 11, both approved in production) is what that costs.
 *
 * This produces the material for that review. It does not decide anything:
 *
 *   1. every record of the ten shared collections, with its id and text
 *   2. which products use each record, and how many
 *   3. the resembling pairs a machine can find, scored
 *
 * The semantic judgement — are these two the same idea? which text survives? —
 * belongs to the Agente Curador and, past it, to the doctor. See
 * docs/agente-curador.md.
 *
 *   pnpm db:vocabulary:audit
 *
 * Read-only, enforced by Postgres and not by this file staying honest.
 *
 * TypeScript rather than .mjs — unlike dump-vocabulary.mjs this one needs the
 * matching rules from lib/vocabulary-index.ts, and duplicating them is how two
 * detectors drift apart. It still never loads Payload.
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { findNearPairs, type EntityRecord, type NearPair } from './lib/vocabulary-index'

const require = createRequire(import.meta.url)
const pg = createRequire(require.resolve('@payloadcms/db-postgres'))('pg')

const URL_ = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(URL_)

// Same deliberate per-command escape hatch as the vocabulary dump. Reading
// production is a decision, never an accident.
if (!LOCAL && process.env.ALLOW_REMOTE_DATABASE !== '1') {
  throw new Error(
    `Refusing to read from "${URL_}".\n`
      + 'Set ALLOW_REMOTE_DATABASE=1 on this one command if you mean to read production.',
  )
}

/**
 * The floor for reporting a pair, looser than the loader's 0.65.
 *
 * The loader's threshold decides what interrupts a load, so it is tuned against
 * false alarms. This output is a list a human reads once, so it is tuned the
 * other way: the albumin pair scores 0.43 and is a real duplicate, and missing it
 * costs more than printing a few unrelated rows.
 */
const AUDIT_FLOOR = 0.4

/**
 * The ten shared collections, and how a product reaches each one.
 *
 * `via` is the difference that matters. Clinical safety hangs off the product's
 * presentations (`products_rels`, path `presentations.N.contraindications`),
 * while zones, routes and techniques hang off a protocol (`protocols_rels`),
 * which hangs off a presentation in turn. Counting usage without that distinction
 * reports every zone as unused.
 */
const COLLECTIONS = [
  { key: 'contraindications', table: 'contraindications', column: 'description', via: 'product' },
  { key: 'adverseEffects', table: 'adverse_effects', column: 'description', via: 'product' },
  { key: 'clinicalIndications', table: 'clinical_indications', column: 'name', via: 'product' },
  { key: 'postCareNotes', table: 'post_care_notes', column: 'description', via: 'product' },
  { key: 'safetyWarnings', table: 'safety_warnings', column: 'description', via: 'product' },
  { key: 'activeIngredients', table: 'active_ingredients', column: 'name', via: 'product' },
  { key: 'laboratories', table: 'laboratories', column: 'name', via: 'laboratory' },
  { key: 'applicationZones', table: 'application_zones', column: 'name', via: 'protocol' },
  { key: 'administrationRoutes', table: 'administration_routes', column: 'name', via: 'protocol' },
  { key: 'applicationTechniques', table: 'application_techniques', column: 'name', via: 'protocol' },
] as const

type Via = (typeof COLLECTIONS)[number]['via']

interface AuditRecord extends EntityRecord {
  /** Contraindications carry a type; the rest report null. */
  type: string | null
  products: string[]
}

const client = new pg.Client(URL_)
await client.connect()
await client.query('BEGIN TRANSACTION READ ONLY')

const rows = async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await client.query(sql, params)).rows as T[]

/**
 * Which products use each record of one collection.
 *
 * Three shapes, because there are three ways a product reaches a shared record.
 * The relationship column in the rels tables is the collection name in snake
 * case with `_id`, which is Payload's convention and not a guess.
 */
function usageQuery(table: string, via: Via): string {
  const fk = `${table}_id`

  if (via === 'laboratory') {
    return `select l.id as record_id, p.canonical_name as product
              from ${table} l
              join products p on p.laboratory_id = l.id`
  }

  if (via === 'protocol') {
    return `select r.${fk} as record_id, p.canonical_name as product
              from protocols_rels r
              join products_rels pr on pr.protocols_id = r.parent_id
              join products p on p.id = pr.parent_id
             where r.${fk} is not null`
  }

  return `select r.${fk} as record_id, p.canonical_name as product
            from products_rels r
            join products p on p.id = r.parent_id
           where r.${fk} is not null`
}

const report: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  source: LOCAL ? 'local' : 'production',
  auditFloor: AUDIT_FLOOR,
  collections: {},
}

const collections = report.collections as Record<string, unknown>

for (const { key, table, column, via } of COLLECTIONS) {
  const hasType = table === 'contraindications'

  const records = await rows<{ id: number; text: string; type: string | null }>(
    `select id, ${column} as text, ${hasType ? 'type' : 'null as type'}
       from ${table}
      where ${column} is not null
      order by id`,
  )

  const usage = await rows<{ record_id: number; product: string }>(usageQuery(table, via))

  const byRecord = new Map<number, Set<string>>()
  for (const row of usage) {
    if (!byRecord.has(row.record_id)) byRecord.set(row.record_id, new Set())
    byRecord.get(row.record_id)!.add(row.product)
  }

  const enriched: AuditRecord[] = records.map((record) => ({
    id: record.id,
    text: record.text,
    type: record.type,
    products: [...(byRecord.get(record.id) ?? [])].sort((a, b) => a.localeCompare(b, 'es')),
  }))

  const pairs: NearPair[] = findNearPairs(enriched, AUDIT_FLOOR)

  collections[key] = {
    total: enriched.length,
    // Surfaced on purpose: a shared record nobody uses is either dead weight left
    // by an edit or the survivor of a merge someone already did by hand.
    unused: enriched.filter((r) => r.products.length === 0).map((r) => r.id),
    records: enriched,
    nearPairs: pairs.map((pair) => ({
      score: Number(pair.score.toFixed(2)),
      containment: pair.containment,
      numericConflict: pair.numericConflict,
      a: { id: pair.a.id, text: pair.a.text, products: (pair.a as AuditRecord).products },
      b: { id: pair.b.id, text: pair.b.text, products: (pair.b as AuditRecord).products },
    })),
  }
}

const OUT = path.resolve(process.cwd(), 'tmp/migration/vocabulary-audit.json')
mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8')

await client.query('COMMIT')
await client.end()

console.log(`source: ${report.source}   floor: ${AUDIT_FLOOR}\n`)
console.log('  colección                registros  sin uso  pares')
for (const { key } of COLLECTIONS) {
  const c = collections[key] as {
    total: number
    unused: number[]
    nearPairs: unknown[]
  }
  console.log(
    `  ${key.padEnd(24)} ${String(c.total).padStart(9)} ${String(c.unused.length).padStart(8)} ${String(c.nearPairs.length).padStart(6)}`,
  )
}
console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`)
