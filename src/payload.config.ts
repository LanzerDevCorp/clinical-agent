import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Laboratories } from './collections/Laboratories'
import { ActiveIngredients } from './collections/ActiveIngredients'
import { ApplicationZones } from './collections/ApplicationZones'
import { AdministrationRoutes } from './collections/AdministrationRoutes'
import { ApplicationTechniques } from './collections/ApplicationTechniques'
import { Contraindications } from './collections/Contraindications'
import { AdverseEffects } from './collections/AdverseEffects'
import { ClinicalIndications } from './collections/ClinicalIndications'
import { PostCareNotes } from './collections/PostCareNotes'
import { SafetyWarnings } from './collections/SafetyWarnings'
import { Protocols } from './collections/Protocols'
import { Products } from './collections/Products'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Supabase signs its Postgres certificate with a private CA, so verifying the
 * server needs that CA. Locally it is a file and `sslrootcert=<path>` in
 * DATABASE_URL is enough. A deploy has no such file, so the certificate travels
 * as SUPABASE_CA_CERT instead and is handed to the driver directly.
 *
 * The two cannot be mixed. pg resolves its options as
 * `Object.assign({}, config, parse(connectionString))`, so any ssl parameter in
 * the URL overrides what is set here — `?sslmode=verify-full` alone parses to an
 * empty `ssl: {}` and would silently discard the CA below, leaving the
 * connection unverifiable. Stripping those parameters keeps a stray one in a
 * deployment variable from quietly weakening the connection.
 */
const SSL_URL_PARAMETERS = ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey']

/**
 * node-postgres defaults to 10 connections per pool, which is a sensible number
 * for one long-lived server and a dangerous one here: every serverless instance
 * builds its own pool, so two concurrent instances alone can exhaust Supabase's
 * session pooler and the admin panel dies with
 * `(EMAXCONNSESSION) max clients reached in session mode`.
 *
 * Five keeps a single page's parallel queries genuinely parallel while leaving
 * room for other instances. Idle connections are returned quickly because a
 * serverless instance that is between requests should not be holding any.
 */
const POOL_MAX_CONNECTIONS = 5
const POOL_IDLE_TIMEOUT_MS = 10_000

function databasePoolOptions() {
  const connectionString = process.env.DATABASE_URL || ''
  const caCertificate = process.env.SUPABASE_CA_CERT
  const limits = {
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
  }

  if (!caCertificate) return { connectionString, ...limits }

  const separator = connectionString.indexOf('?')
  if (separator === -1) {
    return { connectionString, ...limits, ssl: { ca: caCertificate, rejectUnauthorized: true } }
  }

  const parameters = new URLSearchParams(connectionString.slice(separator + 1))
  for (const parameter of SSL_URL_PARAMETERS) parameters.delete(parameter)
  const query = parameters.toString()

  return {
    connectionString: connectionString.slice(0, separator) + (query ? `?${query}` : ''),
    ...limits,
    ssl: { ca: caCertificate, rejectUnauthorized: true },
  }
}

import { es } from 'payload/i18n/es'
import { en } from 'payload/i18n/en'

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  cors: '*',
  csrf: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  ].filter(Boolean),
  i18n: {
    supportedLanguages: { es, en },
    fallbackLanguage: 'es',
  },
  admin: {
    user: Users.slug,
    dateFormat: "d 'de' MMMM 'de' yyyy, h:mm a",
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Users,
    Media,
    Laboratories,
    ActiveIngredients,
    ApplicationZones,
    AdministrationRoutes,
    ApplicationTechniques,
    Contraindications,
    AdverseEffects,
    ClinicalIndications,
    PostCareNotes,
    SafetyWarnings,
    Protocols,
    Products,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: databasePoolOptions(),
    push: false,
  }),
  sharp,
  plugins: [
    mcpPlugin({
      collections: {
        users: { enabled: { find: true, create: false, update: false, delete: false } },
        media: { enabled: { find: true, create: true, update: false, delete: false } },
        laboratories: { enabled: { find: true, create: true, update: true, delete: false } },
        'active-ingredients': { enabled: { find: true, create: true, update: true, delete: false } },
        'application-zones': { enabled: { find: true, create: true, update: true, delete: false } },
        'administration-routes': { enabled: { find: true, create: true, update: true, delete: false } },
        'application-techniques': { enabled: { find: true, create: true, update: true, delete: false } },
        contraindications: { enabled: { find: true, create: true, update: true, delete: false } },
        'adverse-effects': { enabled: { find: true, create: true, update: true, delete: false } },
        'clinical-indications': { enabled: { find: true, create: true, update: true, delete: false } },
        'post-care-notes': { enabled: { find: true, create: true, update: true, delete: false } },
        'safety-warnings': { enabled: { find: true, create: true, update: true, delete: false } },
        protocols: { enabled: { find: true, create: true, update: true, delete: false } },
        products: { enabled: { find: true, create: true, update: true, delete: false } },
      },
    }),
  ],
})
