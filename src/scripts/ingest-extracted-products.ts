import { getPayload } from 'payload'
import configPromise from '../payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { readdirSync, readFileSync } from 'fs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

interface ExtractedProduct {
  canonicalName: string
  productType: string
  laboratory: string
  activeIngredients?: string[]
  aliases?: { term: string }[]
  validationStatus: 'PENDING' | 'APPROVED'
  validationNotes?: string | null
  contraindications?: string[]
  adverseEffects?: string[]
  presentations?: Array<{
    canonicalName: string
    status: 'activa' | 'descontinuada'
    aliases?: { term: string }[]
    reconstitution?: {
      diluentType?: string
      volumeMl?: number
      instructions?: string
    } | null
  }>
}

async function getOrCreateEntity(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'laboratories' | 'active-ingredients' | 'contraindications' | 'adverse-effects',
  value: string
): Promise<number | string> {
  const normalizedValue = value.trim()
  const fieldName = (collection === 'contraindications' || collection === 'adverse-effects') ? 'description' : 'name'

  const existing = await payload.find({
    collection,
    where: { [fieldName]: { equals: normalizedValue } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id
  }

  const dataToCreate: any = { [fieldName]: normalizedValue }
  if (collection === 'contraindications') {
    dataToCreate.type = 'relativa'
  }

  const created = await payload.create({
    collection,
    data: dataToCreate,
  })
  console.log(`  [+] Creada entidad relacional en '${collection}': ${normalizedValue} (ID: ${created.id})`)
  return created.id
}

async function run() {
  console.log('🚀 Inicializando Payload CMS...')
  const payload = await getPayload({ config: configPromise })

  const extractedDir = path.resolve(dirname, '../../tmp/migration/extracted')
  const files = readdirSync(extractedDir).filter((f) => f.endsWith('.json'))

  console.log(`\n📦 Encontrados ${files.length} archivos JSON en ${extractedDir}:\n`)

  const summary = {
    total: files.length,
    created: 0,
    updated: 0,
    errors: 0,
    details: [] as string[],
  }

  for (const file of files) {
    const filePath = path.join(extractedDir, file)
    console.log(`--- Procesando ${file} ---`)

    try {
      const content = readFileSync(filePath, 'utf-8')
      const productData: ExtractedProduct = JSON.parse(content)

      // 1. Resolver Laboratorio
      const labId = await getOrCreateEntity(payload, 'laboratories', productData.laboratory)

      // 2. Resolver Ingredientes Activos
      const ingredientIds: (number | string)[] = []
      if (productData.activeIngredients && productData.activeIngredients.length > 0) {
        for (const ing of productData.activeIngredients) {
          const ingId = await getOrCreateEntity(payload, 'active-ingredients', ing)
          ingredientIds.push(ingId)
        }
      }

      // 3. Resolver Contraindicaciones
      const contraIds: (number | string)[] = []
      if (productData.contraindications && productData.contraindications.length > 0) {
        for (const contra of productData.contraindications) {
          const cId = await getOrCreateEntity(payload, 'contraindications', contra)
          contraIds.push(cId)
        }
      }

      // 4. Resolver Efectos Adversos
      const adverseIds: (number | string)[] = []
      if (productData.adverseEffects && productData.adverseEffects.length > 0) {
        for (const adv of productData.adverseEffects) {
          const aId = await getOrCreateEntity(payload, 'adverse-effects', adv)
          adverseIds.push(aId)
        }
      }

      // 5. Mapear objeto final para Payload
      const cleanedPresentations = (productData.presentations || []).map((pres) => {
        const copy: any = { ...pres }
        if (!copy.reconstitution || Object.keys(copy.reconstitution).length === 0) {
          delete copy.reconstitution
        }
        return copy
      })

      const payloadData: any = {
        canonicalName: productData.canonicalName.toUpperCase(),
        productType: productData.productType || 'otro',
        laboratory: labId,
        activeIngredients: ingredientIds,
        aliases: productData.aliases || [],
        validationStatus: productData.validationStatus || 'PENDING',
        validationNotes: productData.validationNotes || null,
        contraindications: contraIds,
        adverseEffects: adverseIds,
        presentations: cleanedPresentations,
      }

      // 6. Upsert por canonicalName
      const existingProduct = await payload.find({
        collection: 'products',
        where: { canonicalName: { equals: payloadData.canonicalName } },
        limit: 1,
      })

      if (existingProduct.docs.length > 0) {
        const prodId = existingProduct.docs[0].id
        // Preservar aliases humanos existentes si los hay
        const existingAliases = (existingProduct.docs[0] as any).aliases || []
        const aliasMap = new Map<string, { term: string }>()
        existingAliases.forEach((a: any) => aliasMap.set(a.term.toLowerCase(), a))
        payloadData.aliases.forEach((a: any) => aliasMap.set(a.term.toLowerCase(), a))
        payloadData.aliases = Array.from(aliasMap.values())

        await payload.update({
          collection: 'products',
          id: prodId,
          data: payloadData,
        })
        summary.updated++
        console.log(`  [UPDATE] Producto '${payloadData.canonicalName}' actualizado con éxito (ID: ${prodId}).`)
        summary.details.push(`UPDATED: ${payloadData.canonicalName}`)
      } else {
        const created = await payload.create({
          collection: 'products',
          data: payloadData,
        })
        summary.created++
        console.log(`  [CREATE] Producto '${payloadData.canonicalName}' creado con éxito (ID: ${created.id}).`)
        summary.details.push(`CREATED: ${payloadData.canonicalName}`)
      }
    } catch (err: any) {
      summary.errors++
      console.error(`  ❌ Error procesando ${file}:`, err.message)
      summary.details.push(`ERROR: ${file} - ${err.message}`)
    }
  }

  console.log('\n========================================')
  console.log('📊 RESUMEN DE INGESTA')
  console.log('========================================')
  console.log(`Total archivos: ${summary.total}`)
  console.log(`Creados: ${summary.created}`)
  console.log(`Actualizados: ${summary.updated}`)
  console.log(`Errores: ${summary.errors}`)
  console.log('----------------------------------------')
  process.exit(0)
}

run().catch((err) => {
  console.error('Fatal error in ingester:', err)
  process.exit(1)
})
