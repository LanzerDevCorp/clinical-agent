import { getPayload } from 'payload'
import configPromise from '../payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

interface CatalogFile {
  slug: string
  data: { name: string }[]
}

async function deleteAllInCollection(payload: Awaited<ReturnType<typeof getPayload>>, collection: string): Promise<number> {
  const result = await payload.find({
    collection: collection as any,
    pagination: false,
    limit: 10000,
  })

  let deleted = 0
  for (const doc of result.docs) {
    try {
      await payload.delete({ collection: collection as any, id: doc.id })
      deleted++
    } catch (err) {
      console.warn(`  Warning: failed to delete ${collection}#${doc.id}:`, (err as Error).message)
    }
  }
  return deleted
}

async function run() {
  console.log('Initializing Payload...')
  const payload = await getPayload({ config: configPromise })

  // ─── PHASE 1: CASCADE DELETE ──────────────────────────────────────────────
  console.log('\n=== PHASE 1: CASCADE DELETE ===\n')

  const deleteOrder: string[] = [
    'products',
    'protocols',
    'clinical-notes',
    'adverse-effects',
    'contraindications',
    'media',
    'laboratories',
    'active-ingredients',
    'application-zones',
    'application-techniques',
    'administration-routes',
  ]

  const deleteReport: Record<string, number> = {}

  for (const collection of deleteOrder) {
    process.stdout.write(`  Deleting [${collection}]... `)
    const count = await deleteAllInCollection(payload, collection)
    deleteReport[collection] = count
    console.log(`${count} deleted.`)
  }

  // ─── PHASE 2: LOAD CATALOGS ───────────────────────────────────────────────
  console.log('\n=== PHASE 2: LOAD CATALOGS ===\n')

  const catalogFiles = [
    '../../.openspec/changes/catalog-extraction-laboratories-llm/laboratories.json',
    '../../.openspec/changes/catalog-extraction-active-ingredients-llm/active-ingredients.json',
    '../../.openspec/changes/catalog-extraction-application-zones-llm/application-zones.json',
    '../../.openspec/changes/catalog-extraction-application-techniques-llm/application-techniques.json',
    '../../.openspec/changes/catalog-extraction-administration-routes-llm/administration-routes.json',
  ].map((rel) => path.resolve(dirname, rel))

  const createReport: Record<string, { created: number; skipped: number; errors: number }> = {}

  for (const filePath of catalogFiles) {
    const catalog: CatalogFile = JSON.parse(readFileSync(filePath, 'utf-8'))
    const { slug, data } = catalog

    createReport[slug] = { created: 0, skipped: 0, errors: 0 }
    console.log(`  Loading [${slug}] — ${data.length} records...`)

    for (const item of data) {
      const existing = await payload.find({
        collection: slug as any,
        where: { name: { equals: item.name } },
        limit: 1,
      })

      if (existing.totalDocs > 0) {
        createReport[slug].skipped++
        continue
      }

      try {
        await payload.create({ collection: slug as any, data: item })
        createReport[slug].created++
      } catch (err) {
        createReport[slug].errors++
        console.warn(`  Warning: failed to create "${item.name}" in ${slug}:`, (err as Error).message)
      }
    }

    console.log(
      `    created: ${createReport[slug].created} | skipped: ${createReport[slug].skipped} | errors: ${createReport[slug].errors}`,
    )
  }

  // ─── FINAL REPORT ─────────────────────────────────────────────────────────
  console.log('\n=== FINAL REPORT ===\n')
  console.log('Phase 1 — Deleted:')
  for (const [col, count] of Object.entries(deleteReport)) {
    console.log(`  ${col}: ${count}`)
  }
  console.log('\nPhase 2 — Created:')
  for (const [col, { created, skipped, errors }] of Object.entries(createReport)) {
    console.log(`  ${col}: ${created} created, ${skipped} skipped, ${errors} errors`)
  }
  console.log('\nDone.')

  process.exit(0)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
