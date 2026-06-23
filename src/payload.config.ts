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
import { ClinicalNotes } from './collections/ClinicalNotes'
import { Protocols } from './collections/Protocols'
import { Products } from './collections/Products'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
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
    ClinicalNotes,
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
        'clinical-notes': { enabled: { find: true, create: true, update: true, delete: false } },
        protocols: { enabled: { find: true, create: true, update: true, delete: false } },
        products: { enabled: { find: true, create: true, update: true, delete: false } },
      },
    }),
  ],
})
