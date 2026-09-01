/**
 * Rebuild fixtures/real-catalogue.json from a production dump.
 *
 * The fixture is committed but the dump is not, so without this script the
 * fixture is a dead artifact: nobody could refresh it when production moves. It
 * exists to be run rarely and to leave no trace when it is done.
 *
 * Production is hosted Supabase Postgres. Get the dump with
 * scripts/db/backup-production.sh, which produces
 * backups/supabase-full-<stamp>.dump among its artifacts.
 *
 * It reads a *scratch* database — never the app's own. Restore the dump into one
 * first, inside the container the local Supabase already runs:
 *
 *   docker cp backups/supabase-full-<stamp>.dump supabase_db_clinical-agent:/tmp/prod.dump
 *   docker exec supabase_db_clinical-agent psql -U postgres -d postgres \
 *     -c "DROP DATABASE IF EXISTS prodref_seed;" -c "CREATE DATABASE prodref_seed;"
 *   docker exec supabase_db_clinical-agent pg_restore -U postgres -d prodref_seed \
 *     --no-owner --no-privileges /tmp/prod.dump
 *
 *   pnpm db:local:fixture
 *
 *   docker exec supabase_db_clinical-agent psql -U postgres -d postgres \
 *     -c "DROP DATABASE prodref_seed;"
 *   docker exec supabase_db_clinical-agent rm -f /tmp/prod.dump
 *
 * On Git Bash those docker paths need MSYS_NO_PATHCONV=1, or /tmp is rewritten
 * into a Windows path before docker ever sees it.
 *
 * What it deliberately does not extract: users, sessions, preferences, admission
 * events, and validationNotes. The first four are not catalogue; the last holds
 * internal team notes, and this output is committed.
 *
 * Plain .mjs on purpose — it never loads Payload, so it needs neither the config
 * nor tsx to run.
 *
 * Second use: dumping the live local catalogue for promotion to production
 * (see promote-catalogue-to-production.ts). That flow points FIXTURE_SOURCE_URL
 * at the app's own local database on purpose — local IS the reviewed state being
 * promoted there — and sets FIXTURE_OUT_PATH so the committed fixture never gets
 * overwritten by a promotion run.
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// pnpm keeps pg where @payloadcms/db-postgres can see it, not at the top level,
// so resolve it the way that package would rather than guessing a store path.
const require = createRequire(import.meta.url)
const pg = createRequire(require.resolve('@payloadcms/db-postgres'))('pg')

const SCRATCH_URL =
  process.env.FIXTURE_SOURCE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/prodref_seed'

const isLocalSource = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(SCRATCH_URL)

// Read-only script, so a remote source only needs an explicit opt-in — no backup/dry-run
// ceremony, unlike ALLOW_REMOTE_DATABASE for the write-side scripts. Used to verify a
// promotion after the fact: dump production and diff it against the fixture that drove it.
if (!isLocalSource && process.env.FIXTURE_ALLOW_REMOTE !== '1') {
  throw new Error(
    `Refusing to read from "${SCRATCH_URL}". This script only ever reads a local scratch ` +
      'database unless FIXTURE_ALLOW_REMOTE=1 is set on the command.',
  )
}

const OUT = process.env.FIXTURE_OUT_PATH
  ? path.resolve(process.env.FIXTURE_OUT_PATH)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'real-catalogue.json')

const client = new pg.Client(SCRATCH_URL)
await client.connect()

const rows = async (sql) => (await client.query(sql)).rows
const column = (list, col = 'name') => list.map((r) => r[col])

// Simple catalogues: a name or a description, nothing else.
const laboratories = column(await rows('select name from laboratories order by id'))
const productTypes = (await rows('select name, slug from product_types order by id')).map((r) => ({
  name: r.name,
  slug: r.slug,
}))
const activeIngredients = column(await rows('select name from active_ingredients order by id'))
const applicationZones = column(await rows('select name from application_zones order by id'))
const administrationRoutes = column(await rows('select name from administration_routes order by id'))
const applicationTechniques = column(
  await rows('select name from application_techniques order by id'),
)
const clinicalIndications = column(await rows('select name from clinical_indications order by id'))
const adverseEffects = column(
  await rows('select description from adverse_effects order by id'),
  'description',
)
const postCareNotes = column(
  await rows('select description from post_care_notes order by id'),
  'description',
)
const safetyWarnings = column(
  await rows('select description from safety_warnings order by id'),
  'description',
)
const contraindications = (
  await rows('select description, type from contraindications order by id')
).map((r) => ({ description: r.description, type: r.type }))

// Lookup tables, so relations come out as the names the seed resolves against.
const byId = async (sql, col) => {
  const map = new Map()
  for (const r of await rows(sql)) map.set(r.id, r[col])
  return map
}
const labById = await byId('select id, name from laboratories', 'name')
const productTypeSlugById = await byId('select id, slug from product_types', 'slug')
const ingredientById = await byId('select id, name from active_ingredients', 'name')
const zoneById = await byId('select id, name from application_zones', 'name')
const routeById = await byId('select id, name from administration_routes', 'name')
const techniqueById = await byId('select id, name from application_techniques', 'name')
const contraById = await byId('select id, description from contraindications', 'description')
const adverseById = await byId('select id, description from adverse_effects', 'description')
const indicationById = await byId('select id, name from clinical_indications', 'name')
const postCareById = await byId('select id, description from post_care_notes', 'description')
const warningById = await byId('select id, description from safety_warnings', 'description')
const protocolById = await byId('select id, name from protocols', 'name')

// --- protocols ---------------------------------------------------------------
const protocolRels = await rows('select * from protocols_rels order by parent_id, "order"')
const protocolRel = (parentId, relPath, map, col) =>
  protocolRels
    .filter((r) => r.parent_id === parentId && r.path === relPath)
    .map((r) => map.get(r[col]))
    .filter(Boolean)

const protocols = (await rows('select * from protocols order by id')).map((p) => ({
  name: p.name,
  clientShareable: p.client_shareable,
  zones: protocolRel(p.id, 'zones', zoneById, 'application_zones_id'),
  routes: protocolRel(p.id, 'routes', routeById, 'administration_routes_id'),
  techniques: protocolRel(p.id, 'techniques', techniqueById, 'application_techniques_id'),
  visibleEffectsOnset: p.visible_effects_onset,
  effectDuration: p.effect_duration,
  recommendedDose: p.recommended_dose,
  injectionDepth: p.injection_depth,
  sessionsMin: p.sessions_min,
  sessionsMax: p.sessions_max,
  frequency: p.frequency,
}))

// --- products ----------------------------------------------------------------
const productRels = await rows('select * from products_rels order by parent_id, "order"')
const presentations = await rows('select * from products_presentations order by _parent_id, _order')
const productAliases = await rows('select * from products_aliases order by _parent_id, _order')
const presentationAliases = await rows(
  'select * from products_presentations_aliases order by _parent_id, _order',
)

// Payload writes array relations under "presentations.<zero-based index>.<field>",
// while the row itself carries a one-based _order.
const presRel = (productId, index, field, map, col) =>
  productRels
    .filter((r) => r.parent_id === productId && r.path === `presentations.${index}.${field}`)
    .map((r) => map.get(r[col]))
    .filter(Boolean)

// Payload treats an absent key and an empty one differently on create, and a
// fixture full of nulls is a fixture nobody can read.
const dropEmpty = (obj) =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
    ),
  )

const products = (await rows('select * from products order by id')).map((p) => {
  const own = presentations.filter((pr) => pr._parent_id === p.id)

  return dropEmpty({
    canonicalName: p.canonical_name,
    // validationNotes intentionally omitted; see the header.
    validationStatus: p.validation_status,
    description: p.description,
    productType: productTypeSlugById.get(p.product_type_id),
    laboratory: labById.get(p.laboratory_id),
    activeIngredients: productRels
      .filter((r) => r.parent_id === p.id && r.path === 'activeIngredients')
      .map((r) => ingredientById.get(r.active_ingredients_id))
      .filter(Boolean),
    aliases: productAliases.filter((a) => a._parent_id === p.id).map((a) => ({ term: a.term })),
    presentations: own.map((pr) => {
      const i = pr._order - 1
      const reconstitution = dropEmpty({
        diluentType: pr.reconstitution_diluent_type,
        volumeMl: pr.reconstitution_volume_ml === null ? null : Number(pr.reconstitution_volume_ml),
        instructions: pr.reconstitution_instructions,
      })

      return dropEmpty({
        canonicalName: pr.canonical_name,
        status: pr.status,
        characteristics: pr.characteristics,
        certifications: pr.certifications,
        aliases: presentationAliases
          .filter((a) => a._parent_id === pr.id)
          .map((a) => ({ term: a.term })),
        contraindications: presRel(p.id, i, 'contraindications', contraById, 'contraindications_id'),
        adverseEffects: presRel(p.id, i, 'adverseEffects', adverseById, 'adverse_effects_id'),
        clinicalIndications: presRel(
          p.id,
          i,
          'clinicalIndications',
          indicationById,
          'clinical_indications_id',
        ),
        postCareNotes: presRel(p.id, i, 'postCareNotes', postCareById, 'post_care_notes_id'),
        safetyWarnings: presRel(p.id, i, 'safetyWarnings', warningById, 'safety_warnings_id'),
        protocols: presRel(p.id, i, 'protocols', protocolById, 'protocols_id'),
        reconstitution: Object.keys(reconstitution).length ? reconstitution : null,
      })
    }),
  })
})

const fixture = {
  laboratories,
  productTypes,
  activeIngredients,
  applicationZones,
  administrationRoutes,
  applicationTechniques,
  contraindications,
  adverseEffects,
  clinicalIndications,
  postCareNotes,
  safetyWarnings,
  protocols,
  products,
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + '\n', 'utf8')
await client.end()

const presCount = products.reduce((n, p) => n + (p.presentations?.length ?? 0), 0)
console.log(`products ${products.length}  presentations ${presCount}  protocols ${protocols.length}`)
console.log(`wrote ${path.relative(process.cwd(), OUT)}`)
