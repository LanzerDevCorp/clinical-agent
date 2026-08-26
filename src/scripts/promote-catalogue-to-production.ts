/**
 * Wipe the catalogue in a remote (production) database and replace it with a
 * fixture extracted from the local one — the "promote" half of the local-is-the-
 * antesala flow. See extract-real-catalogue.mjs for the extraction half.
 *
 * Defaults to a dry run: prints what would be deleted and created, touches
 * nothing. Only writes when PROMOTE_CONFIRM=yes is set explicitly, on top of
 * the ALLOW_REMOTE_DATABASE=1 that DATABASE_URL already needs to point at a
 * remote host at all (see payload.config.ts and assertRemoteDatabase below).
 *
 * Never touches `users` or `media` — this fixture doesn't carry them, and
 * production's real accounts and uploads are not this script's business.
 *
 * Run with (never hardcode DATABASE_URL/ALLOW_REMOTE_DATABASE in package.json):
 *
 *   DATABASE_URL=<production> ALLOW_REMOTE_DATABASE=1 \
 *     pnpm run db:promotion:dry-run
 *
 *   DATABASE_URL=<production> ALLOW_REMOTE_DATABASE=1 PROMOTE_CONFIRM=yes \
 *     pnpm run db:promotion:apply
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { assertRemoteDatabase } from '@/scripts/lib/database-target'
import { idsFor } from '@/scripts/lib/fixture-ids'

// This runs before getPayload, so a misconfigured or local URL never opens a connection.
assertRemoteDatabase(process.env.DATABASE_URL || '', process.env.ALLOW_REMOTE_DATABASE)

const { getPayload } = await import('payload')
const config = (await import('@payload-config')).default
const payload = await getPayload({ config })

const DRY_RUN = process.env.PROMOTE_CONFIRM !== 'yes'

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
type Fixture = {
  laboratories: string[]
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

const fixturePath = path.resolve(
  process.env.PROMOTION_FIXTURE_PATH || 'tmp/migration/promotion/local-catalogue.json',
)
const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

console.log(`\nFixture: ${fixturePath}`)
console.log(DRY_RUN ? 'Mode: DRY RUN (no writes) — set PROMOTE_CONFIRM=yes to apply\n' : 'Mode: APPLY\n')

// Deleted parents first: products point at everything else, so removing them
// last would trip foreign keys that are perfectly correct.
const COLLECTIONS_IN_DELETE_ORDER = [
  'products',
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

const FIXTURE_COUNTS: Record<(typeof COLLECTIONS_IN_DELETE_ORDER)[number], number> = {
  products: fixture.products.length,
  protocols: fixture.protocols.length,
  'active-ingredients': fixture.activeIngredients.length,
  contraindications: fixture.contraindications.length,
  'adverse-effects': fixture.adverseEffects.length,
  'clinical-indications': fixture.clinicalIndications.length,
  'post-care-notes': fixture.postCareNotes.length,
  'safety-warnings': fixture.safetyWarnings.length,
  'application-zones': fixture.applicationZones.length,
  'administration-routes': fixture.administrationRoutes.length,
  'application-techniques': fixture.applicationTechniques.length,
  laboratories: fixture.laboratories.length,
}

console.log('Collection                will delete      will create')
for (const collection of COLLECTIONS_IN_DELETE_ORDER) {
  const { totalDocs } = await payload.count({ collection })
  console.log(
    `  ${collection.padEnd(24)} ${String(totalDocs).padEnd(16)} ${FIXTURE_COUNTS[collection]}`,
  )
}

if (DRY_RUN) {
  console.log('\nDry run only. Nothing was deleted or created.')
  process.exit(0)
}

console.log('\nClearing the existing catalogue…')
for (const collection of COLLECTIONS_IN_DELETE_ORDER) {
  const { docs } = await payload.delete({
    collection,
    where: { id: { exists: true } },
  })
  console.log(`  ${collection.padEnd(24)} ${docs.length} removed`)
}

console.log('\nSeeding…')

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
    activeIngredients: productIngredients,
    presentations,
    ...rest
  } = product

  const created = await payload.create({
    collection: 'products',
    data: {
      ...rest,
      laboratory: idsFor([laboratory], laboratories, 'product laboratory')[0],
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

console.log(`\nDone. ${fixture.products.length} products promoted to production.`)
process.exit(0)
