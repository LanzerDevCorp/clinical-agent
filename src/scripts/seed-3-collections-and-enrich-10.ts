import { getPayload } from 'payload'
import configPromise from '../payload.config.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const TARGET_10_PRODUCTS = [
  { canonicalName: 'AEC', file: 'AEC.md' },
  { canonicalName: 'ANTIAGING', file: 'ANTIAGING.md' },
  { canonicalName: 'ARGIRELINE', file: 'ARGIRELINE.md' },
  { canonicalName: 'ARTICHOKE', file: 'ARTICHOKE.md' },
  { canonicalName: 'ASIAN CENTELLA', file: 'ASIAN CENTELLA.md' },
  { canonicalName: 'B-COMPLEX', file: 'B-COMPLEX.md' },
  { canonicalName: 'BELLATOXEL', file: 'BELLATOXEL.md' },
  { canonicalName: 'BIOTIN HIDRIXIN', file: 'BIOTIN HIDRIXIN.md' },
  { canonicalName: 'BOTULAX', file: 'BOTULAX.md' },
  { canonicalName: 'BTSA9', file: 'BTSA9.md' },
]

function parseMarkdownNotes(content: string) {
  const lines = content.split('\n')

  const indicaciones: string[] = []
  const cuidados: string[] = []
  const advertencias: string[] = []

  let currentSection: 'INDICACIONES' | 'CUIDADOS' | 'ADVERTENCIAS' | 'OTHER' = 'OTHER'

  for (let line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('#') || trimmed.startsWith('**') || trimmed.startsWith('*')) {
      const headerText = trimmed.replace(/^[#*\s]+|[*\s:]+$/g, '').toUpperCase()

      if (
        headerText.includes('INDICACIONES') ||
        headerText.includes('INDICADO PARA') ||
        headerText.includes('RECOMENDADO PARA') ||
        headerText.includes('ACCIONES')
      ) {
        currentSection = 'INDICACIONES'
        continue
      } else if (
        headerText.includes('RECOMENDACIONES POST') ||
        headerText.includes('INDICACIONES POST') ||
        headerText.includes('RECOMENDACIONES') ||
        headerText.includes('CUIDADOS')
      ) {
        currentSection = 'CUIDADOS'
        continue
      } else if (
        headerText.includes('CARACTERÍSTICAS') ||
        headerText.includes('ADVERTENCIAS Y PRECAUCIONES') ||
        headerText.includes('CONSIDERACIONES') ||
        headerText.includes('INTERACCIÓN MEDICAMENTOSA')
      ) {
        currentSection = 'ADVERTENCIAS'
        continue
      } else if (
        headerText.includes('CONTRAINDICACIONES') ||
        headerText.includes('EFECTOS ADVERSOS') ||
        headerText.includes('REACCIONES') ||
        headerText.includes('PRESENTACIÓN') ||
        headerText.includes('CONTENIDO') ||
        headerText.includes('DURACIÓN') ||
        headerText.includes('LABORATORIO') ||
        headerText.includes('APLICACIÓN Y DOSIS')
      ) {
        currentSection = 'OTHER'
        continue
      }
    }

    if (currentSection !== 'OTHER') {
      const itemText = trimmed.replace(/^[*•-]\s*/, '').trim()
      if (itemText.length > 3 && !itemText.startsWith('#')) {
        const cleanText = itemText.replace(/\*\*/g, '').trim()
        if (currentSection === 'INDICACIONES') {
          indicaciones.push(cleanText)
        } else if (currentSection === 'CUIDADOS') {
          cuidados.push(cleanText)
        } else if (currentSection === 'ADVERTENCIAS') {
          advertencias.push(cleanText)
        }
      }
    }
  }

  return { indicaciones, cuidados, advertencias }
}

async function getOrCreateIndication(payload: any, name: string): Promise<number> {
  const norm = name.trim()
  const existing = await payload.find({
    collection: 'clinical-indications',
    where: { name: { equals: norm } },
    limit: 1,
  })
  if (existing.docs.length > 0) return existing.docs[0].id
  const created = await payload.create({
    collection: 'clinical-indications',
    data: { name: norm },
  })
  console.log(`  [+] Creada Indicación Clínica: "${norm}"`)
  return created.id
}

async function getOrCreatePostCareNote(payload: any, description: string): Promise<number> {
  const norm = description.trim()
  const existing = await payload.find({
    collection: 'post-care-notes',
    where: { description: { equals: norm } },
    limit: 1,
  })
  if (existing.docs.length > 0) return existing.docs[0].id
  const created = await payload.create({
    collection: 'post-care-notes',
    data: { description: norm },
  })
  console.log(`  [+] Creado Cuidado Post-Aplicación: "${norm.substring(0, 50)}..."`)
  return created.id
}

async function getOrCreateSafetyWarning(payload: any, description: string): Promise<number> {
  const norm = description.trim()
  const existing = await payload.find({
    collection: 'safety-warnings',
    where: { description: { equals: norm } },
    limit: 1,
  })
  if (existing.docs.length > 0) return existing.docs[0].id
  const created = await payload.create({
    collection: 'safety-warnings',
    data: { description: norm },
  })
  console.log(`  [+] Creada Advertencia de Seguridad: "${norm.substring(0, 50)}..."`)
  return created.id
}

async function main() {
  console.log('🚀 Inicializando carga desduplicada para las 3 nuevas colecciones clínicas...\n')
  const payload = await getPayload({ config: configPromise })

  const realProductsDir = path.resolve(dirname, '../../real-products')

  let totalIndications = 0
  let totalCuidados = 0
  let totalAdvertencias = 0

  for (const item of TARGET_10_PRODUCTS) {
    const filePath = path.join(realProductsDir, item.file)
    const content = readFileSync(filePath, 'utf-8')
    const { indicaciones, cuidados, advertencias } = parseMarkdownNotes(content)

    // Find product in DB
    const found = await payload.find({
      collection: 'products',
      where: {
        or: [
          { canonicalName: { equals: item.canonicalName } },
          { 'aliases.term': { equals: item.canonicalName } },
        ],
      },
      limit: 1,
      depth: 2,
    })

    if (found.docs.length === 0) {
      console.log(`⚠️ Producto no encontrado en DB: '${item.canonicalName}'`)
      continue
    }

    const prod = found.docs[0] as any
    console.log(`📌 Procesando en 3 colecciones para '${prod.canonicalName}' (ID: ${prod.id})...`)

    // Existing fields for deduplication
    const existingContraTexts = (prod.contraindications || []).map((c: any) => (typeof c === 'object' ? c.description?.toLowerCase() : ''))
    const existingAdverseTexts = (prod.adverseEffects || []).map((a: any) => (typeof a === 'object' ? a.description?.toLowerCase() : ''))
    const existingActiveTexts = (prod.activeIngredients || []).map((act: any) => (typeof act === 'object' ? act.name?.toLowerCase() : ''))

    const isDuplicate = (text: string) => {
      const lower = text.toLowerCase()
      return existingContraTexts.some((c: string) => c && lower.includes(c)) ||
             existingAdverseTexts.some((a: string) => a && lower.includes(a)) ||
             existingActiveTexts.some((act: string) => act && lower.includes(act))
    }

    // 1. Process Indicaciones Clínicas (deduplicated)
    const indicationIds: number[] = []
    for (const ind of indicaciones) {
      if (isDuplicate(ind)) {
        console.log(`  [DEDUP SKIP] Omite indicación duplicada: "${ind}"`)
        continue
      }
      const id = await getOrCreateIndication(payload, ind)
      if (!indicationIds.includes(id)) indicationIds.push(id)
    }

    // 2. Process Cuidados Post-Aplicación (deduplicated)
    const postCareIds: number[] = []
    for (const cuid of cuidados) {
      if (isDuplicate(cuid)) {
        console.log(`  [DEDUP SKIP] Omite cuidado duplicado: "${cuid}"`)
        continue
      }
      const id = await getOrCreatePostCareNote(payload, cuid)
      if (!postCareIds.includes(id)) postCareIds.push(id)
    }

    // 3. Process Advertencias de Seguridad (deduplicated)
    const warningIds: number[] = []
    for (const adv of advertencias) {
      if (isDuplicate(adv)) {
        console.log(`  [DEDUP SKIP] Omite advertencia duplicada: "${adv}"`)
        continue
      }
      const id = await getOrCreateSafetyWarning(payload, adv)
      if (!warningIds.includes(id)) warningIds.push(id)
    }

    // Move product-level contraindications and adverseEffects to presentation level
    const contraIds = (prod.contraindications || []).map((c: any) => (typeof c === 'object' ? c.id : c))
    const adverseIds = (prod.adverseEffects || []).map((a: any) => (typeof a === 'object' ? a.id : a))

    const presentations = prod.presentations || []
    if (presentations.length > 0) {
      const updatedPresentations = presentations.map((pres: any) => ({
        ...pres,
        contraindications: Array.from(new Set([...((pres.contraindications || []).map((c: any) => (typeof c === 'object' ? c.id : c))), ...contraIds])),
        adverseEffects: Array.from(new Set([...((pres.adverseEffects || []).map((a: any) => (typeof a === 'object' ? a.id : a))), ...adverseIds])),
        clinicalIndications: indicationIds,
        postCareNotes: postCareIds,
        safetyWarnings: warningIds,
      }))

      await payload.update({
        collection: 'products',
        id: prod.id,
        data: {
          presentations: updatedPresentations,
        },
      })

      console.log(`  ✅ Vinculadas: ${indicationIds.length} Indicaciones | ${postCareIds.length} Cuidados | ${warningIds.length} Advertencias a '${prod.canonicalName}'.`)
      totalIndications += indicationIds.length
      totalCuidados += postCareIds.length
      totalAdvertencias += warningIds.length
    }
  }

  console.log('\n========================================')
  console.log('🎉 PROCESO COMPLETADO')
  console.log('========================================')
  console.log(`Total Indicaciones Clínicas vinculadas: ${totalIndications}`)
  console.log(`Total Cuidados Post-Aplicación vinculados: ${totalCuidados}`)
  console.log(`Total Advertencias de Seguridad vinculadas: ${totalAdvertencias}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
