/**
 * Dump the catalogue vocabulary to tmp/migration/vocabulary.json.
 *
 * This is the Agente Extractor's required input. Without it the extractor writes
 * a fresh term for something the database already holds, and the loader is left
 * guessing whether two near-identical strings mean the same thing — which is the
 * one decision this pipeline deliberately refuses to automate.
 *
 * With it, the extractor reuses an existing term verbatim and the loader resolves
 * by exact equality. See docs/agente-extractor.md.
 *
 *   pnpm db:local:vocabulary
 *
 * Read-only: it opens one connection, runs selects, and writes a single file. It
 * never writes to the database.
 *
 * Plain .mjs on purpose, like extract-real-catalogue.mjs — it never loads Payload,
 * so it needs neither the config nor tsx to run.
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// pnpm keeps pg where @payloadcms/db-postgres can see it, not at the top level,
// so resolve it the way that package would rather than guessing a store path.
const require = createRequire(import.meta.url)
const pg = createRequire(require.resolve('@payloadcms/db-postgres'))('pg')

const URL_ = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(URL_)

// Production is the source of truth for the vocabulary: the doctor's manual
// corrections — a contraindication moved from absoluta to relativa, a curated
// alias — live only there. A local database is a copy that drifts.
//
// So reaching production is allowed, through the same deliberate per-command
// escape hatch payload.config.ts uses, and never by accident.
if (!LOCAL && process.env.ALLOW_REMOTE_DATABASE !== '1') {
  throw new Error(
    `Refusing to read from "${URL_}".\n`
      + 'Set ALLOW_REMOTE_DATABASE=1 on this one command if you mean to read production.',
  )
}

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tmp/migration/vocabulary.json',
)

const client = new pg.Client(URL_)
await client.connect()

// Enforced by Postgres, not by this file staying honest. Every statement below runs
// inside a read-only transaction, so a bug here — or a query someone adds next year —
// is rejected by the server rather than reaching production data.
await client.query('BEGIN TRANSACTION READ ONLY')

const rows = async (sql) => (await client.query(sql)).rows

// Sorted so the file diffs cleanly between runs and stays scannable by eye.
const terms = async (table, col = 'name') =>
  (await rows(`select distinct ${col} as v from ${table} where ${col} is not null`))
    .map((r) => r.v)
    .sort((a, b) => a.localeCompare(b, 'es'))

const [
  laboratories,
  activeIngredients,
  applicationZones,
  administrationRoutes,
  applicationTechniques,
  clinicalIndications,
  adverseEffects,
  postCareNotes,
  safetyWarnings,
  protocols,
  products,
] = await Promise.all([
  terms('laboratories'),
  terms('active_ingredients'),
  terms('application_zones'),
  terms('administration_routes'),
  terms('application_techniques'),
  terms('clinical_indications'),
  terms('adverse_effects', 'description'),
  terms('post_care_notes', 'description'),
  terms('safety_warnings', 'description'),
  terms('protocols'),
  terms('products', 'canonical_name'),
])

// A local database is not trustworthy by default: `pnpm db:local:seed:fiction`
// loads four invented products, and anyone can hand-edit it while testing. Handing
// that to the extractor is worse than handing it nothing — it would reuse invented
// clinical terms for real products, and the invented contraindications are generic
// enough ("Embarazo o lactancia") to pass unnoticed. The invented product and
// laboratory names are not, so they are what this checks.
const invented = require('./fixtures/invented-catalogue.json')
const contamination = [
  ...invented.products.map((p) => p.canonicalName).filter((n) => products.includes(n)),
  ...(invented.laboratories ?? []).filter((n) => laboratories.includes(n)),
]

if (contamination.length) {
  await client.end()
  throw new Error(
    `This database holds the fiction dataset — found: ${contamination.join(', ')}.\n`
      + 'The extractor would reuse invented clinical terms for real products.\n'
      + 'Reseed with `pnpm db:local:reset` and run this again.',
  )
}

// Contraindications carry their type, because the extractor has to know which
// existing record it is reusing before it decides anything about a new one.
const contraindications = (
  await rows('select description, type from contraindications where description is not null')
)
  .map((r) => ({ description: r.description, type: r.type }))
  .sort((a, b) => a.description.localeCompare(b.description, 'es'))

const vocabulary = {
  generatedAt: new Date().toISOString(),
  // Which database this came from, because a vocabulary dumped from a developer
  // copy and one dumped from production are not interchangeable, and the file
  // outlives the terminal that produced it.
  source: LOCAL ? 'local' : 'production',
  laboratories,
  activeIngredients,
  applicationZones,
  administrationRoutes,
  applicationTechniques,
  clinicalIndications,
  contraindications,
  adverseEffects,
  postCareNotes,
  safetyWarnings,
  protocols,
  // Not vocabulary to reuse, but the extractor needs to know what is already
  // loaded so it does not re-extract a product that is done.
  products,
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(vocabulary, null, 2) + '\n', 'utf8')
await client.query('COMMIT')
await client.end()

console.log(`source: ${vocabulary.source}\n`)
for (const [key, value] of Object.entries(vocabulary)) {
  if (Array.isArray(value)) console.log(`${String(value.length).padStart(4)}  ${key}`)
}
// Printed so the operator can recognise a database that drifted. The fiction guard
// above catches the seeded dataset; it cannot catch a product typed in by hand.
console.log(`\nproducts: ${products.join(', ')}`)
console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`)
