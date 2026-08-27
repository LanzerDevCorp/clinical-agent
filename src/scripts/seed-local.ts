/**
 * Fill an empty local database with an admin user and a catalogue.
 *
 * Two catalogues live in fixtures/, and both are replayed through Payload's API
 * rather than restored as rows: the API advances the sequences, runs the hooks
 * and validates, which a copy of raw rows does not — a restore leaves every
 * sequence behind its table and the next insert collides on id.
 *
 *   real (default)   The 13 products the production catalogue holds, extracted
 *                    from a Neon dump. Only the catalogue: no users, no
 *                    sessions, no admission events, and validationNotes is
 *                    dropped because it carries internal team notes.
 *
 *   fiction          Four invented products. They exist for the shapes real data
 *                    does not have — a discontinued presentation and a product
 *                    with no presentation at all — which is exactly what breaks
 *                    code that assumes every product is orderable. Reach for it
 *                    when touching that code.
 *
 * Run with:  pnpm db:local:seed          (real)
 *            pnpm db:local:seed:fiction  (invented)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '@payload-config'

const LOCAL_DATABASE_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal']

function assertLocalDatabase() {
  const connectionString = process.env.DATABASE_URL || ''
  const authority = connectionString.replace(/^[^:]+:\/\//, '').split('@').pop() ?? ''
  const host = authority.split('/')[0]?.split('?')[0]?.replace(/:\d+$/, '') ?? ''

  if (!LOCAL_DATABASE_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at "${host}". This script deletes every row ` +
        `in the catalogue before writing, so it only ever runs against a local database.`,
    )
  }
}

// This runs before getPayload, so a misconfigured URL never opens a connection.
assertLocalDatabase()

const payload = await getPayload({ config })

// A reset drops the users table with everything else, and Payload then blocks the
// admin panel behind the first-user wizard. Recreating that account by hand after
// every reset is friction with no upside, so the seed owns it.
//
// Real credentials belong in .env, which is gitignored. The fallback below is
// deliberately generic: this file is committed, so anything hardcoded here is
// published to everyone who clones the repository.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'dev@local.test'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'localdev'

async function seedAdminUser() {
  // db:local:seed also runs without a reset, so the account usually already exists.
  // Recreating it would collide on the unique email, and overwriting the password
  // of an account someone is logged into is worse than leaving it alone.
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
  })

  if (totalDocs > 0) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists; left untouched.`)
    return
  }

  await payload.create({
    collection: 'users',
    // Explicit, because the field's own default is 'user' — new accounts start
    // at the lower privilege, but the seed's own admin account should not.
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' },
  })
  console.log(`Admin user created: ${ADMIN_EMAIL}`)
}

await seedAdminUser()

// --- the catalogue -----------------------------------------------------------

type Contraindication = { description: string; type?: string | null }
type Protocol = Record<string, unknown> & {
  name: string
  zones?: string[]
  routes?: string[]
  techniques?: string[]
}
type Presentation = Record<string, unknown> & { canonicalName: string }
type Product = Record<string, unknown> & {
  canonicalName: string
  laboratory: string
  activeIngredients?: string[]
  presentations?: Presentation[]
}

type ProductType = { name: string; slug: string }
type Fixture = {
  laboratories: string[]
  productTypes: ProductType[]
  activeIngredients: string[]
  applicationZones: string[]
  administrationRoutes: string[]
  applicationTechniques: string[]
  contraindications: Contraindication[]
  adverseEffects: string[]
  clinicalIndications: string[]
  postCareNotes: string[]
  safetyWarnings: string[]
  protocols: Protocol[]
  products: Product[]
}

const DATASETS = { real: 'real-catalogue.json', fiction: 'invented-catalogue.json' } as const
type DatasetName = keyof typeof DATASETS

const requested = (process.env.SEED_DATASET || 'real') as DatasetName
if (!(requested in DATASETS)) {
  throw new Error(
    `Unknown SEED_DATASET "${requested}". Expected one of: ${Object.keys(DATASETS).join(', ')}.`,
  )
}

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const fixture: Fixture = JSON.parse(
  readFileSync(path.join(fixturesDir, DATASETS[requested]), 'utf8'),
)

console.log(`\nDataset: ${requested} (${DATASETS[requested]})`)

// Deleted parents first: products point at everything else, so removing them
// last would trip foreign keys that are perfectly correct.
const COLLECTIONS_IN_DELETE_ORDER = [
  'products',
  'product-types',
  'protocols',
  'active-ingredients',
  'contraindications',
  'adverse-effects',
  'clinical-indications',
  'post-care-notes',
  'safety-warnings',
  'application-zones',
  'administration-routes',
  'application-techniques',
  'laboratories',
] as const

console.log('\nClearing the existing catalogue…')
for (const collection of COLLECTIONS_IN_DELETE_ORDER) {
  const { docs } = await payload.delete({
    collection,
    where: { id: { exists: true } },
  })
  console.log(`  ${collection.padEnd(24)} ${docs.length} removed`)
}

console.log('\nSeeding…')

/**
 * Create the rows of one collection and index them by the text the fixture uses
 * to refer to them, so a product can name "Embarazo y lactancia" and get an id.
 */
async function createIndexed<T>(
  collection: Parameters<typeof payload.create>[0]['collection'],
  rows: readonly T[],
  toData: (row: T) => Record<string, unknown>,
  toKey: (row: T) => string,
): Promise<Map<string, number>> {
  const index = new Map<string, number>()
  for (const row of rows) {
    const created = await payload.create({ collection, data: toData(row) as never })
    index.set(toKey(row), created.id as number)
  }
  console.log(`  ${String(collection).padEnd(24)} ${index.size}`)
  return index
}

const named = (collection: Parameters<typeof payload.create>[0]['collection'], rows: string[]) =>
  createIndexed(
    collection,
    rows,
    (name) => ({ name }),
    (name) => name,
  )

const described = (
  collection: Parameters<typeof payload.create>[0]['collection'],
  rows: string[],
) =>
  createIndexed(
    collection,
    rows,
    (description) => ({ description }),
    (description) => description,
  )

const laboratories = await named('laboratories', fixture.laboratories)
// Keyed by slug, not name: fixtures and the ingest script refer to a type by
// its stable slug.
const productTypes = await createIndexed(
  'product-types',
  fixture.productTypes ?? [],
  (row) => ({ name: row.name, slug: row.slug }),
  (row) => row.slug,
)
const ingredients = await named('active-ingredients', fixture.activeIngredients)
const zones = await named('application-zones', fixture.applicationZones)
const routes = await named('administration-routes', fixture.administrationRoutes)
const techniques = await named('application-techniques', fixture.applicationTechniques)
const indications = await named('clinical-indications', fixture.clinicalIndications)
const adverseEffects = await described('adverse-effects', fixture.adverseEffects)
const postCare = await described('post-care-notes', fixture.postCareNotes)
const warnings = await described('safety-warnings', fixture.safetyWarnings)
const contraindications = await createIndexed(
  'contraindications',
  fixture.contraindications,
  (row) => ({ description: row.description, type: row.type ?? undefined }),
  (row) => row.description,
)

/**
 * Resolve the names a fixture uses into the ids Payload just handed out. A name
 * that resolves to nothing is a broken fixture, not a row to skip quietly.
 */
function idsFor(labels: string[] | undefined, index: Map<string, number>, field: string): number[] {
  return (labels ?? []).map((label) => {
    const id = index.get(label)
    if (id === undefined) {
      throw new Error(`Fixture refers to "${label}" in ${field}, which the catalogue does not hold.`)
    }
    return id
  })
}

const protocols = await createIndexed(
  'protocols',
  fixture.protocols,
  ({ zones: z, routes: r, techniques: t, ...rest }) => ({
    ...rest,
    zones: idsFor(z, zones, 'protocol zones'),
    routes: idsFor(r, routes, 'protocol routes'),
    techniques: idsFor(t, techniques, 'protocol techniques'),
  }),
  (row) => row.name,
)

console.log('')
for (const product of fixture.products) {
  const {
    laboratory,
    productType,
    activeIngredients: productIngredients,
    presentations,
    ...rest
  } = product as Product & { productType?: string }

  const created = await payload.create({
    collection: 'products',
    data: {
      ...rest,
      laboratory: idsFor([laboratory], laboratories, 'product laboratory')[0],
      productType: productType ? idsFor([productType], productTypes, 'product productType')[0] : undefined,
      activeIngredients: idsFor(productIngredients, ingredients, 'product activeIngredients'),
      presentations: (presentations ?? []).map((presentation) => {
        const {
          contraindications: c,
          adverseEffects: a,
          clinicalIndications: i,
          postCareNotes: pc,
          safetyWarnings: sw,
          protocols: pr,
          ...presentationRest
        } = presentation as Presentation & Record<string, string[] | undefined>

        return {
          ...presentationRest,
          contraindications: idsFor(c, contraindications, 'presentation contraindications'),
          adverseEffects: idsFor(a, adverseEffects, 'presentation adverseEffects'),
          clinicalIndications: idsFor(i, indications, 'presentation clinicalIndications'),
          postCareNotes: idsFor(pc, postCare, 'presentation postCareNotes'),
          safetyWarnings: idsFor(sw, warnings, 'presentation safetyWarnings'),
          protocols: idsFor(pr, protocols, 'presentation protocols'),
        }
      }),
    } as never,
  })

  const count = presentations?.length ?? 0
  console.log(`  producto  ${String(created.canonicalName).padEnd(20)} ${count} presentación(es)`)
}

console.log(`\nDone. ${fixture.products.length} products seeded from the ${requested} catalogue.`)
process.exit(0)
