import { getPayload } from 'payload'
import configPromise from '../payload.config'

async function run() {
  console.log('Initializing payload for migration execution...')
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as any
  if (!adapter) {
    throw new Error('No database adapter found')
  }

  console.log('Running migrations...')
  await adapter.migrate()
  console.log('Migrations executed successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Error executing migrations:', err)
  process.exit(1)
})
