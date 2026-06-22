import { getPayload } from 'payload'
import configPromise from '../payload.config'
import { sql } from '@payloadcms/db-postgres'

async function run() {
  console.log('Initializing payload to list tables...')
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as any
  if (!adapter) {
    throw new Error('No database adapter found')
  }

  console.log('\nListing all tables in public schema:')
  const result = await adapter.drizzle.execute(
    sql.raw(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
  )

  const tables: string[] = result.rows.map((r: any) => r.tablename)
  if (tables.length === 0) {
    console.log('  (no tables found)')
  } else {
    tables.forEach((t) => console.log(`  - ${t}`))
    console.log(`\nTotal: ${tables.length} table(s)`)
  }

  // Also list enum types
  const enumResult = await adapter.drizzle.execute(
    sql.raw(`
      SELECT typname
      FROM pg_type
      WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY typname
    `)
  )
  const enums: string[] = enumResult.rows.map((r: any) => r.typname)
  if (enums.length > 0) {
    console.log('\nEnum types:')
    enums.forEach((e) => console.log(`  - ${e}`))
  }

  process.exit(0)
}

run().catch((err) => {
  console.error('Error listing tables:', err)
  process.exit(1)
})
