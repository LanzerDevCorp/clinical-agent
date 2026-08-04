import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

function getOrExtractDescription(productData: ExtractedProduct, jsonFile: string): string | null {
  if (productData.description && productData.description.trim()) {
    return productData.description.trim()
  }

  const realProductsDir = path.resolve(dirname, '../../real-products')
  const possibleMdFiles = [
    jsonFile.replace('.json', '.md'),
    jsonFile.replace(/_/g, ' ').replace('.json', '.md'),
    `${productData.canonicalName}.md`,
  ]

  for (const mdName of possibleMdFiles) {
    const mdPath = path.join(realProductsDir, mdName)
    if (existsSync(mdPath)) {
      const mdContent = readFileSync(mdPath, 'utf-8')
      const lines = mdContent.split('\n')
      const paragraphs: string[] = []
      for (const line of lines) {
        const trimmed = line.trim()
        if (
          !trimmed ||
          trimmed.startsWith('#') ||
          trimmed.toUpperCase() === 'FICHA TÉCNICA' ||
          trimmed.toUpperCase().startsWith('FICHA TÉCNICA') ||
          trimmed.startsWith('**ACTIVOS') ||
          trimmed.startsWith('**PRESENTACIÓN') ||
          trimmed.startsWith('**INDICACIONES') ||
          trimmed.startsWith('**LABORATORIO') ||
          trimmed.startsWith('**RECOMENDACIONES') ||
          trimmed.startsWith('**REACCIONES') ||
          trimmed.startsWith('## ') ||
          trimmed.startsWith('### ')
        ) {
          if (paragraphs.length > 0) break
          continue
        }
        paragraphs.push(trimmed.replace(/\*\*/g, '').trim())
      }
      if (paragraphs.length > 0) {
        return paragraphs.join(' ')
      }
    }
  }
  return null
}

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

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function normalizeCanonicalText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(y|o|e|u)\b/gi, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = Array.from(new Set(normalizeCanonicalText(str1).split(' ').filter((w) => w.length > 2)))
  const tokens2 = Array.from(new Set(normalizeCanonicalText(str2).split(' ').filter((w) => w.length > 2)))
  if (tokens1.length === 0 || tokens2.length === 0) return 0

  let matches = 0
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2 || (t1.length >= 4 && t2.length >= 4 && levenshteinDistance(t1, t2) <= 2)) {
        matches++
        break
      }
    }
  }
  const maxTokens = Math.max(tokens1.length, tokens2.length)
  return matches / maxTokens
}

async function getOrCreateEntity(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'laboratories' | 'active-ingredients' | 'contraindications' | 'adverse-effects' | 'application-zones' | 'administration-routes' | 'application-techniques',
  value: string
): Promise<number> {
  const normalizedValue = value.trim()
  const fieldName = (collection === 'contraindications' || collection === 'adverse-effects') ? 'description' : 'name'

  // 1. Exact match
  const existingExact = await payload.find({
    collection,
    where: { [fieldName]: { equals: normalizedValue } },
    limit: 1,
  })

  if (existingExact.docs.length > 0) {
    return existingExact.docs[0].id as number
  }

  // 2. Fuzzy match against existing entities in collection
  const allDocs = await payload.find({
    collection,
    limit: 500,
  })

  for (const doc of allDocs.docs) {
    const docText = (doc as any)[fieldName]
    if (typeof docText === 'string' && tokenSimilarity(normalizedValue, docText) >= 0.8) {
      console.log(`  [DEDUP FUZZY] Coincidencia difusa en '${collection}': "${normalizedValue}" ➔ "${docText}" (ID: ${doc.id})`)
      return doc.id as number
    }
  }

  // 3. Create if no exact or fuzzy match
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

      const description = getOrExtractDescription(productData, file)
      if (description && productData.description !== description) {
        productData.description = description
        writeFileSync(filePath, JSON.stringify(productData, null, 2), 'utf-8')
      }

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
        const existingDoc = existingProduct.docs[0] as any
        const prodId = existingDoc.id

        // 1. Preservar aliases existentes combinando con los nuevos
        const existingAliases = existingDoc.aliases || []
        const aliasMap = new Map<string, { term: string }>()
        existingAliases.forEach((a: any) => aliasMap.set(a.term.toLowerCase(), a))
        payloadData.aliases.forEach((a: any) => aliasMap.set(a.term.toLowerCase(), a))
        payloadData.aliases = Array.from(aliasMap.values())

        // 2. Preservación incondicional de datos y progreso existente en DB (PENDING o APPROVED)
        if (existingDoc.validationStatus) {
          payloadData.validationStatus = existingDoc.validationStatus
        }
        if (existingDoc.description) {
          payloadData.description = existingDoc.description
        }
        if (existingDoc.validationNotes) {
          payloadData.validationNotes = existingDoc.validationNotes
        }
        if (existingDoc.productType) {
          payloadData.productType = existingDoc.productType
        }
        if (existingDoc.laboratory) {
          payloadData.laboratory = typeof existingDoc.laboratory === 'object' ? existingDoc.laboratory.id : existingDoc.laboratory
        }
        if (existingDoc.activeIngredients && existingDoc.activeIngredients.length > 0) {
          payloadData.activeIngredients = existingDoc.activeIngredients.map((i: any) => (typeof i === 'object' ? i.id : i))
        }
        if (existingDoc.presentations && existingDoc.presentations.length > 0) {
          payloadData.presentations = existingDoc.presentations
        }

        await payload.update({
          collection: 'products',
          id: prodId,
          data: payloadData,
        })
        summary.updated++
        console.log(`  [UPDATE] Producto '${payloadData.canonicalName}' actualizado con éxito (ID: ${prodId}) [Estado: ${payloadData.validationStatus}].`)
        summary.details.push(`UPDATED: ${payloadData.canonicalName} [${payloadData.validationStatus}]`)
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

