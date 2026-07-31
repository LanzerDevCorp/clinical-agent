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
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
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
