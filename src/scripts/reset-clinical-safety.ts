import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config.js'

async function main() {
  console.log('🚀 Inicializando reset de colecciones de Seguridad Clínica...')
  const payload = await getPayload({ config: configPromise })

  const collections = [
    'contraindications',
    'adverse-effects',
    'clinical-indications',
    'post-care-notes',
    'safety-warnings',
  ] as const

  for (const coll of collections) {
    console.log(`🧹 Eliminando todos los registros de '${coll}'...`)
    const docs = await payload.find({
      collection: coll,
      limit: 1000,
    })
    for (const d of docs.docs) {
      await payload.delete({
        collection: coll,
        id: d.id,
      })
    }
    console.log(`  ✅ ${docs.docs.length} registros eliminados de '${coll}'.`)
  }

  console.log('🧹 Limpiando referencias de Seguridad Clínica en la colección Products...')
  const products = await payload.find({
    collection: 'products',
    limit: 1000,
  })

  for (const prod of products.docs) {
    const presentations = (prod as any).presentations || []
    const cleanedPresentations = presentations.map((pres: any) => {
      const { contraindications, adverseEffects, clinicalIndications, postCareNotes, safetyWarnings, ...rest } = pres
      return rest
    })

    await payload.update({
      collection: 'products',
      id: prod.id,
      data: {
        contraindications: [],
        adverseEffects: [],
        clinicalIndications: [],
        postCareNotes: [],
        safetyWarnings: [],
        presentations: cleanedPresentations,
      },
    })
  }
  console.log('  ✅ Referencias de productos limpiadas.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error en reset-clinical-safety:', err)
  process.exit(1)
})
