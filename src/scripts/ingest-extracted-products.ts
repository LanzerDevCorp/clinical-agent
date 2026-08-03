import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { readdirSync, readFileSync } from 'fs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

interface ProtocolInput {
  name: string
  zone?: string | string[]
  zones?: string[] | string
  route?: string | string[]
  routes?: string[] | string
  technique?: string | string[]
  techniques?: string[] | string
  visibleEffectsOnset?: string | null
  effectDuration?: string | null
  recommendedDose?: string | null
  injectionDepth?: string | null
  sessionsMin?: number | null
  sessionsMax?: number | null
  frequency?: string | null
}

interface ExtractedProduct {
  canonicalName: string
  description?: string | null
  productType: string
  laboratory: string
  activeIngredients?: string[]
  aliases?: { term: string }[]
  validationStatus: 'PENDING' | 'APPROVED'
  validationNotes?: string | null
  certifications?: string | null
  contraindications?: string[]
  adverseEffects?: string[]
  presentations?: Array<{
    canonicalName: string
    status: 'activa' | 'descontinuada'
    aliases?: { term: string }[]
    protocols?: ProtocolInput[]
    reconstitution?: {
      diluentType?: string
      volumeMl?: number
      instructions?: string
    } | null
  }>
}

async function getOrCreateEntity(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'laboratories' | 'active-ingredients' | 'contraindications' | 'adverse-effects' | 'application-zones' | 'administration-routes' | 'application-techniques',
  value: string
): Promise<number> {
  const normalizedValue = value.trim()
  const fieldName = (collection === 'contraindications' || collection === 'adverse-effects') ? 'description' : 'name'

  const existing = await payload.find({
    collection,
    where: { [fieldName]: { equals: normalizedValue } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id as number
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
  return created.id as number
}

async function getOrCreateProtocol(
  payload: Awaited<ReturnType<typeof getPayload>>,
  protoData: ProtocolInput
): Promise<number> {
  function parseStringOrArray(input?: string | string[]): string[] {
    if (Array.isArray(input)) {
      return input.map((s) => s.trim()).filter(Boolean)
    }
    if (typeof input === 'string') {
      return input
        .split(/[,/]| y | e /i)
        .map((s) => s.trim().replace(/^[\s(]+|[\s)]+$/g, ''))
        .filter(Boolean)
    }
    return []
  }

  const rawZones = protoData.zones || protoData.zone
  let zoneNames = parseStringOrArray(rawZones)
  if (zoneNames.length === 0) zoneNames = ['Sin zona especificada']

  const zoneIds: number[] = []
  for (const zName of zoneNames) {
    const zId = await getOrCreateEntity(payload, 'application-zones', zName)
    if (!zoneIds.includes(zId)) zoneIds.push(zId)
  }

  const rawRoutes = protoData.routes || protoData.route
  let routeNames = parseStringOrArray(rawRoutes)
  if (routeNames.length === 0) routeNames = ['Sin vía especificada']

  const routeIds: number[] = []
  for (const rName of routeNames) {
    const rId = await getOrCreateEntity(payload, 'administration-routes', rName)
    if (!routeIds.includes(rId)) routeIds.push(rId)
  }

  const rawTechs = protoData.techniques || protoData.technique
  let techNames = parseStringOrArray(rawTechs)
  if (techNames.length === 0) techNames = ['Sin técnica especificada']

  const techIds: number[] = []
  for (const tName of techNames) {
    const tId = await getOrCreateEntity(payload, 'application-techniques', tName)
    if (!techIds.includes(tId)) techIds.push(tId)
  }

  const existing = await payload.find({
    collection: 'protocols',
    where: { name: { equals: protoData.name.trim() } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const updated = await payload.update({
      collection: 'protocols',
      id: existing.docs[0].id,
      data: {
        zones: zoneIds,
        routes: routeIds,
        techniques: techIds,
        visibleEffectsOnset: protoData.visibleEffectsOnset || null,
        effectDuration: protoData.effectDuration || null,
        recommendedDose: protoData.recommendedDose || null,
        injectionDepth: protoData.injectionDepth || null,
        sessionsMin: protoData.sessionsMin || null,
        sessionsMax: protoData.sessionsMax || null,
        frequency: protoData.frequency || null,
      },
    })
    console.log(`  [UPDATE] Actualizado protocolo de aplicación: '${protoData.name}' (Zonas: ${zoneNames.join(', ')} | Vías: ${routeNames.join(', ')} | Técnicas: ${techNames.join(', ')}) (ID: ${updated.id})`)
    return updated.id as number
  }

  const created = await payload.create({
    collection: 'protocols',
    data: {
      name: protoData.name.trim(),
      zones: zoneIds,
      routes: routeIds,
      techniques: techIds,
      visibleEffectsOnset: protoData.visibleEffectsOnset || null,
      effectDuration: protoData.effectDuration || null,
      recommendedDose: protoData.recommendedDose || null,
      injectionDepth: protoData.injectionDepth || null,
      sessionsMin: protoData.sessionsMin || null,
      sessionsMax: protoData.sessionsMax || null,
      frequency: protoData.frequency || null,
    },
  })
  console.log(`  [+] Creado protocolo de aplicación: '${protoData.name}' (Zonas: ${zoneNames.join(', ')} | Vías: ${routeNames.join(', ')} | Técnicas: ${techNames.join(', ')}) (ID: ${created.id})`)
  return created.id as number
}

async function run() {
  console.log('Inicializando Payload CMS...')
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
      const ingredientIds: number[] = []
      if (productData.activeIngredients && productData.activeIngredients.length > 0) {
        for (const ing of productData.activeIngredients) {
          const ingId = await getOrCreateEntity(payload, 'active-ingredients', ing)
          ingredientIds.push(ingId)
        }
      }

      // 3. Resolver Contraindicaciones
      const contraIds: number[] = []
      if (productData.contraindications && productData.contraindications.length > 0) {
        for (const contra of productData.contraindications) {
          const cId = await getOrCreateEntity(payload, 'contraindications', contra)
          contraIds.push(cId)
        }
      }

      // 4. Resolver Efectos Adversos
      const adverseIds: number[] = []
      if (productData.adverseEffects && productData.adverseEffects.length > 0) {
        for (const adv of productData.adverseEffects) {
          const aId = await getOrCreateEntity(payload, 'adverse-effects', adv)
          adverseIds.push(aId)
        }
      }

      // 5. Mapear presentaciones y resolver protocolos
      const cleanedPresentations = []
      for (const pres of productData.presentations || []) {
        const copy: any = {
          ...pres,
          certifications: (productData as any).certifications || null,
          contraindications: contraIds,
          adverseEffects: adverseIds,
        }

        if (pres.protocols && pres.protocols.length > 0) {
          const protocolIds: number[] = []
          for (const p of pres.protocols) {
            const pId = await getOrCreateProtocol(payload, p)
            protocolIds.push(pId)
          }
          copy.protocols = protocolIds
        } else {
          delete copy.protocols
        }

        if (!copy.reconstitution || Object.keys(copy.reconstitution).length === 0) {
          copy.reconstitution = {
            diluentType: 'No requiere',
            instructions: 'Solución líquida lista para usar. No requiere reconstitución ni dilución previa.',
          }
        }
        cleanedPresentations.push(copy)
      }

      const payloadData: any = {
        canonicalName: productData.canonicalName.toUpperCase(),
        description: productData.description || null,
        productType: productData.productType || 'otro',
        laboratory: labId,
        activeIngredients: ingredientIds,
        aliases: productData.aliases || [],
        validationStatus: productData.validationStatus || 'PENDING',
        validationNotes: productData.validationNotes || null,
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

