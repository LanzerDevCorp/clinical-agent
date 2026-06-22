import { getPayload } from 'payload'
import configPromise from '../payload.config'

async function run() {
  console.log('Initializing payload for migration creation...')
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as any
  if (!adapter) {
    throw new Error('No database adapter found')
  }

  console.log('Generating migration file...')
  await adapter.createMigration({
    migrationName: 'init_payload',
    payload,
    forceAcceptWarning: true,
  })
  console.log('Migration generated successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Error during migration creation:', err)
  process.exit(1)
})
