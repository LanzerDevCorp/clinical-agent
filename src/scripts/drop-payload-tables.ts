import { getPayload } from 'payload'
import configPromise from '../payload.config'
import { sql } from '@payloadcms/db-postgres'

async function run() {
  console.log('Initializing payload to drop tables...')
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as any
  if (!adapter) {
    throw new Error('No database adapter found')
  }

  // Dynamically discover all public tables and drop them all (dev DB clean slate)
  console.log('\nDiscovering all public schema tables...')
  const tablesResult = await adapter.drizzle.execute(
    sql.raw(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
  )
  const discovered: string[] = tablesResult.rows.map((r: any) => r.tablename)
  console.log(`Found ${discovered.length} table(s): ${discovered.join(', ') || '(none)'}`)

  if (discovered.length === 0) {
    console.log('No tables to drop.')
  } else {
    // Drop all public tables in one shot with CASCADE to avoid FK ordering issues
    const tableList = discovered.map((t) => `"${t}"`).join(', ')
    console.log('\nDropping all public tables with CASCADE...')
    await adapter.drizzle.execute(sql.raw(`DROP TABLE IF EXISTS ${tableList} CASCADE`))
    console.log('All tables dropped.')
  }

  // Also drop all enum types
  const enumResult = await adapter.drizzle.execute(
    sql.raw(`
      SELECT typname
      FROM pg_type
      WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `)
  )
  const enums: string[] = enumResult.rows.map((r: any) => r.typname)
  if (enums.length > 0) {
    console.log(`\nDropping ${enums.length} enum type(s)...`)
    for (const enumName of enums) {
      try {
        await adapter.drizzle.execute(sql.raw(`DROP TYPE IF EXISTS "${enumName}" CASCADE`))
        console.log(`  Dropped enum: ${enumName}`)
      } catch (err) {
        console.warn(`  Failed to drop enum ${enumName}:`, err)
      }
    }
  }

  console.log('\nDatabase cleaned successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Error dropping tables:', err)
  process.exit(1)
})
