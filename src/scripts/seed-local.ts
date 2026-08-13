/**
 * Fill an empty local database with an admin user and an invented catalogue.
 *
 * The data here is fiction. Production holds real clinical records about real
 * products, and a developer machine is the wrong place for them: it runs an
 * unauthenticated Postgres bound to 0.0.0.0, it gets carried around, and it gets
 * lost. A seed that lives in the repository is also reproducible — anyone who
 * clones this gets the same catalogue from one command, which a copy of
 * production never gives you.
 *
 * The shapes matter more than the values. This exercises every relationship the
 * admin panel renders, plus the cases that break naive code: a product awaiting
 * validation, a product with two presentations, a discontinued presentation, and
 * a product with no presentation at all.
 *
 * Run with:  pnpm payload run src/scripts/seed-local.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const LOCAL_DATABASE_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal']

function assertLocalDatabase() {
  const connectionString = process.env.DATABASE_URL || ''
  const authority = connectionString.replace(/^[^:]+:\/\//, '').split('@').pop() ?? ''
  const host = authority.split('/')[0]?.split('?')[0]?.replace(/:\d+$/, '') ?? ''

  if (!LOCAL_DATABASE_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at "${host}". This script deletes every row ` +
        `in the catalogue before writing, so it only ever runs against a local database.`,
    )
  }
}

// This runs before getPayload, so a misconfigured URL never opens a connection.
assertLocalDatabase()

const payload = await getPayload({ config })

// A reset drops the users table with everything else, and Payload then blocks the
// admin panel behind the first-user wizard. Recreating that account by hand after
// every reset is friction with no upside, so the seed owns it.
//
// Real credentials belong in .env, which is gitignored. The fallback below is
// deliberately generic: this file is committed, so anything hardcoded here is
// published to everyone who clones the repository.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'dev@local.test'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'localdev'

async function seedAdminUser() {
  // db:local:seed also runs without a reset, so the account usually already exists.
  // Recreating it would collide on the unique email, and overwriting the password
  // of an account someone is logged into is worse than leaving it alone.
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
  })

  if (totalDocs > 0) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists; left untouched.`)
    return
  }

  await payload.create({
    collection: 'users',
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  console.log(`Admin user created: ${ADMIN_EMAIL}`)
}

await seedAdminUser()

/** Create many documents and index them by a key, so relationships stay readable below. */
async function createMany<T extends Record<string, unknown>>(
  collection: Parameters<typeof payload.create>[0]['collection'],
  rows: readonly T[],
  key: (row: T) => string,
): Promise<Record<string, number>> {
  const index: Record<string, number> = {}
  for (const data of rows) {
    const created = await payload.create({ collection, data: data as never })
    index[key(data)] = created.id as number
  }
  return index
}

// Deleted parents first: products point at everything else, so removing them
// last would trip foreign keys that are perfectly correct.
const COLLECTIONS_IN_DELETE_ORDER = [
  'products',
  'protocols',
  'active-ingredients',
  'contraindications',
  'adverse-effects',
  'clinical-indications',
  'post-care-notes',
  'safety-warnings',
  'application-zones',
  'administration-routes',
  'application-techniques',
  'laboratories',
] as const

console.log('Clearing the existing catalogue…')
for (const collection of COLLECTIONS_IN_DELETE_ORDER) {
  const { docs } = await payload.delete({
    collection,
    where: { id: { exists: true } },
  })
  console.log(`  ${collection.padEnd(24)} ${docs.length} removed`)
}

console.log('\nSeeding…')

const laboratories = await createMany(
  'laboratories',
  [{ name: 'Laboratorio Vértice' }, { name: 'Biotecna Andina' }, { name: 'Dermalux Ibérica' }],
  (row) => row.name,
)

const ingredients = await createMany(
  'active-ingredients',
  [
    { name: 'Ácido hialurónico reticulado' },
    { name: 'Policaprolactona' },
    { name: 'Complejo peptídico VX-9' },
    { name: 'Cafeína anhidra' },
    { name: 'Toxina botulínica tipo A (ficticia)' },
    { name: 'L-carnitina' },
  ],
  (row) => row.name,
)

const zones = await createMany(
  'application-zones',
  [{ name: 'Tercio superior facial' }, { name: 'Región submentoniana' }, { name: 'Abdomen' }],
  (row) => row.name,
)

const routes = await createMany(
  'administration-routes',
  [{ name: 'Intradérmica' }, { name: 'Subcutánea' }, { name: 'Intramuscular' }],
  (row) => row.name,
)

const techniques = await createMany(
  'application-techniques',
  [{ name: 'Microbolos' }, { name: 'Retroinyección lineal' }, { name: 'Abanico' }],
  (row) => row.name,
)

const contraindications = await createMany(
  'contraindications',
  [
    { description: 'Embarazo o lactancia', type: 'absoluta' },
    { description: 'Infección activa en la zona de aplicación', type: 'absoluta' },
    { description: 'Tratamiento anticoagulante en curso', type: 'relativa' },
    { description: 'Antecedente de queloides', type: 'relativa' },
  ],
  (row) => row.description,
)

const adverseEffects = await createMany(
  'adverse-effects',
  [
    { description: 'Eritema transitorio en el sitio de punción' },
    { description: 'Edema leve durante las primeras 48 horas' },
    { description: 'Hematoma localizado' },
    { description: 'Nódulos palpables de resolución espontánea' },
  ],
  (row) => row.description,
)

const indications = await createMany(
  'clinical-indications',
  [
    { name: 'Líneas de expresión periorbitarias' },
    { name: 'Flacidez leve del tercio inferior' },
    { name: 'Adiposidad localizada' },
    { name: 'Hidratación profunda' },
  ],
  (row) => row.name,
)

const postCare = await createMany(
  'post-care-notes',
  [
    { description: 'Evitar exposición solar directa durante 72 horas' },
    { description: 'No realizar ejercicio intenso por 24 horas' },
    { description: 'Aplicar frío local 10 minutos cada 2 horas el primer día' },
    { description: 'No masajear la zona salvo indicación expresa' },
  ],
  (row) => row.description,
)

const warnings = await createMany(
  'safety-warnings',
  [
    { description: 'No combinar con otros inyectables en la misma sesión' },
    { description: 'Requiere prueba de sensibilidad previa' },
    { description: 'Conservar entre 2 °C y 8 °C; no congelar' },
  ],
  (row) => row.description,
)

const protocols = await createMany(
  'protocols',
  [
    {
      name: 'Protocolo facial de hidratación profunda',
      clientShareable: true,
      zones: [zones['Tercio superior facial']],
      routes: [routes['Intradérmica']],
      techniques: [techniques['Microbolos']],
      visibleEffectsOnset: 'Progresivo desde la primera sesión',
      effectDuration: 'De 4 a 6 meses',
      recommendedDose: '2 mL por sesión, distribuidos en microbolos de 0,05 mL.',
      injectionDepth: 'Dermis superficial',
      sessionsMin: 3,
      sessionsMax: 5,
      frequency: 'Cada 21 días',
    },
    {
      name: 'Protocolo de definición submentoniana',
      clientShareable: false,
      zones: [zones['Región submentoniana']],
      routes: [routes['Subcutánea']],
      techniques: [techniques['Retroinyección lineal'], techniques['Abanico']],
      visibleEffectsOnset: 'A partir de la segunda sesión',
      effectDuration: 'Hasta 12 meses',
      recommendedDose: '1 mL por hemicara.',
      injectionDepth: 'Tejido celular subcutáneo',
      sessionsMin: 2,
      sessionsMax: 4,
      frequency: 'Cada 30 días',
    },
    {
      name: 'Protocolo corporal reductor',
      clientShareable: true,
      zones: [zones['Abdomen']],
      routes: [routes['Subcutánea'], routes['Intramuscular']],
      techniques: [techniques['Abanico']],
      visibleEffectsOnset: 'Entre la tercera y la cuarta sesión',
      effectDuration: 'Según mantenimiento',
      recommendedDose: '5 mL por sesión repartidos en cuadrantes.',
      injectionDepth: 'Subcutáneo profundo',
      sessionsMin: 6,
      sessionsMax: 10,
      frequency: 'Semanal',
    },
  ],
  (row) => row.name as string,
)

const products = [
  {
    canonicalName: 'HIDRAVÉRTICE 20',
    validationStatus: 'APPROVED',
    description: 'Gel inyectable de ácido hialurónico reticulado para hidratación profunda.',
    productType: 'liquido',
    laboratory: laboratories['Laboratorio Vértice'],
    activeIngredients: [ingredients['Ácido hialurónico reticulado']],
    aliases: [{ term: 'Hidravertice' }, { term: 'HV20' }],
    presentations: [
      {
        canonicalName: 'HIDRAVÉRTICE 20 · jeringa 2 mL',
        status: 'activa',
        characteristics: 'Jeringa prellenada de 2 mL con dos agujas 30G.',
        certifications: 'Registro sanitario ficticio RS-00012',
        contraindications: [
          contraindications['Embarazo o lactancia'],
          contraindications['Infección activa en la zona de aplicación'],
        ],
        adverseEffects: [
          adverseEffects['Eritema transitorio en el sitio de punción'],
          adverseEffects['Edema leve durante las primeras 48 horas'],
        ],
        clinicalIndications: [
          indications['Hidratación profunda'],
          indications['Líneas de expresión periorbitarias'],
        ],
        postCareNotes: [
          postCare['Evitar exposición solar directa durante 72 horas'],
          postCare['No masajear la zona salvo indicación expresa'],
        ],
        safetyWarnings: [warnings['Conservar entre 2 °C y 8 °C; no congelar']],
        protocols: [protocols['Protocolo facial de hidratación profunda']],
      },
      {
        // A discontinued presentation: the admin must still render it, and any
        // code that assumes "every presentation is orderable" gets caught here.
        canonicalName: 'HIDRAVÉRTICE 20 · vial 5 mL',
        status: 'descontinuada',
        characteristics: 'Vial multidosis. Retirado del mercado en 2025.',
        contraindications: [contraindications['Embarazo o lactancia']],
        clinicalIndications: [indications['Hidratación profunda']],
      },
    ],
  },
  {
    canonicalName: 'PCL DEFINE',
    validationStatus: 'APPROVED',
    description: 'Suspensión de policaprolactona para estímulo de colágeno.',
    productType: 'liofilizado',
    laboratory: laboratories['Biotecna Andina'],
    activeIngredients: [ingredients['Policaprolactona'], ingredients['Complejo peptídico VX-9']],
    aliases: [{ term: 'PCL-D' }],
    presentations: [
      {
        canonicalName: 'PCL DEFINE · vial 210 mg',
        status: 'activa',
        characteristics: 'Vial liofilizado. Requiere reconstitución previa.',
        certifications: 'Certificación ficticia CE-0044',
        aliases: [{ term: 'PCL Define 210' }],
        contraindications: [
          contraindications['Antecedente de queloides'],
          contraindications['Tratamiento anticoagulante en curso'],
        ],
        adverseEffects: [
          adverseEffects['Nódulos palpables de resolución espontánea'],
          adverseEffects['Hematoma localizado'],
        ],
        clinicalIndications: [indications['Flacidez leve del tercio inferior']],
        postCareNotes: [
          postCare['No realizar ejercicio intenso por 24 horas'],
          postCare['Aplicar frío local 10 minutos cada 2 horas el primer día'],
        ],
        safetyWarnings: [
          warnings['Requiere prueba de sensibilidad previa'],
          warnings['No combinar con otros inyectables en la misma sesión'],
        ],
        protocols: [protocols['Protocolo de definición submentoniana']],
        reconstitution: {
          diluentType: 'Agua para inyección',
          volumeMl: 7,
          instructions: 'Reconstituir y reposar 20 minutos antes de la aplicación. No agitar.',
        },
      },
    ],
  },
  {
    canonicalName: 'LIPOCAF FORTE',
    // Awaiting validation: the catalogue must not treat it as approved, and the
    // clinical agent must not surface it as if a professional had signed it off.
    validationStatus: 'PENDING',
    validationNotes: 'Ficha cargada por el laboratorio. Falta revisión de la dirección clínica.',
    description: 'Solución lipolítica de cafeína y L-carnitina.',
    productType: 'liquido',
    laboratory: laboratories['Dermalux Ibérica'],
    activeIngredients: [ingredients['Cafeína anhidra'], ingredients['L-carnitina']],
    presentations: [
      {
        canonicalName: 'LIPOCAF FORTE · ampolla 10 mL',
        status: 'activa',
        characteristics: 'Caja de 10 ampollas.',
        contraindications: [contraindications['Embarazo o lactancia']],
        adverseEffects: [adverseEffects['Eritema transitorio en el sitio de punción']],
        clinicalIndications: [indications['Adiposidad localizada']],
        postCareNotes: [postCare['No realizar ejercicio intenso por 24 horas']],
        protocols: [protocols['Protocolo corporal reductor']],
      },
    ],
  },
  {
    // No presentations at all. A product can exist before its commercial
    // packaging is loaded, and every consumer has to survive that.
    canonicalName: 'TENSOR PDO LUX',
    validationStatus: 'PENDING',
    description: 'Hilos de polidioxanona para tensado mecánico.',
    productType: 'hilos_pdo',
    laboratory: laboratories['Dermalux Ibérica'],
  },
] as const

for (const data of products) {
  const created = await payload.create({ collection: 'products', data: data as never })
  console.log(`  producto  ${String(created.canonicalName)}`)
}

console.log('\nDone. Catalogue seeded with invented data.')
process.exit(0)
