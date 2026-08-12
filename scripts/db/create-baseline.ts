/**
 * Generate the Payload baseline migration WITHOUT the `payload migrate:create` CLI.
 *
 * Why this exists: on Node 24 + tsx, `pnpm payload migrate:create` dies with
 *   ENOENT ... open '<cwd>\node:crypto?tsx-namespace=<timestamp>'
 * The payload bin loads Payload from its TypeScript source under tsx, and tsx
 * appends a cache-busting query to the `node:crypto` specifier, so Node stops
 * treating it as a builtin and tries to open it as a file. Driving
 * `db.createMigration` directly skips the bin and produces identical output:
 * the migration .ts, the drizzle snapshot .json, and a regenerated index.ts.
 *
 * ALWAYS point DATABASE_URL at a scratch database. Never at Neon.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:probe@127.0.0.1:55432/baseline \
 *     node node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs scripts/db/create-baseline.ts
 */

import { getPayload } from 'payload'
import config from '../../src/payload.config'

const url = process.env.DATABASE_URL ?? ''
if (!url) {
  throw new Error('DATABASE_URL is required.')
}
if (url.includes('neon.tech')) {
  throw new Error('Refusing to run against Neon. Point DATABASE_URL at a scratch database.')
}

const payload = await getPayload({ config })

await (payload.db as unknown as {
  createMigration: (args: {
    forceAcceptWarning: boolean
    migrationName: string
    payload: unknown
  }) => Promise<void>
}).createMigration({
  forceAcceptWarning: true,
  migrationName: 'baseline',
  payload,
})

process.exit(0)
