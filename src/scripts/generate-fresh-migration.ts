import { getPayload } from 'payload'
import configPromise from '../payload.config.js'

async function run() {
  console.log('Initializing payload to generate migration...')
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as any
  if (!adapter) {
    throw new Error('No database adapter found')
  }

  console.log('Generating migration file for current schema...')
  await adapter.createMigration({
    migrationName: 'add_3_clinical_collections',
    payload,
    forceAcceptWarning: true,
  })
  console.log('Migration generated successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Error generating migration:', err)
  process.exit(1)
})
