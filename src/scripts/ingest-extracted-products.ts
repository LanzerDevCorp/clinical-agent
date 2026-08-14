import 'dotenv/config'
import { getPayload } from 'payload'
import configPromise from '../payload.config'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'

import {
  readContraindication,
  type ContraindicationInput,
} from './lib/contraindication-input'
import {
  emptyPlan,
  renderReport,
  reportFileName,
  type FileResult,
  type Plan,
} from './lib/ingest-report'
import { mergePresentations } from './lib/merge-presentations'
import {
  describeProtocolDifference,
  type ProtocolShape,
} from './lib/protocol-difference'
import { createVocabularyIndex, type VocabularyIndex } from './lib/vocabulary-index'

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
  clinicalIndications?: string[]
  /** Objects carrying the type, per docs/agente-extractor.md; bare strings still parse. */
  contraindications?: ContraindicationInput[]
  adverseEffects?: string[]
  postCareNotes?: string[]
  safetyWarnings?: string[]
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

/** Collections whose records are shared between products. */
const ENTITY_COLLECTIONS = [
  'laboratories',
  'active-ingredients',
  'contraindications',
  'adverse-effects',
  'application-zones',
  'administration-routes',
  'application-techniques',
  'post-care-notes',
  'safety-warnings',
  'clinical-indications',
] as const

type EntityCollection = (typeof ENTITY_COLLECTIONS)[number]

/** Four collections describe their record; the rest name it. */
const TEXT_FIELD: Record<EntityCollection, 'name' | 'description'> = {
  laboratories: 'name',
  'active-ingredients': 'name',
  contraindications: 'description',
  'adverse-effects': 'description',
  'application-zones': 'name',
  'administration-routes': 'name',
  'application-techniques': 'name',
  'post-care-notes': 'description',
  'safety-warnings': 'description',
  'clinical-indications': 'name',
}

interface IngestContext {
  payload: Awaited<ReturnType<typeof getPayload>>
  dryRun: boolean
  vocab: Record<EntityCollection, VocabularyIndex>
  /** Type of each contraindication already in the base, to detect a disagreement. */
  existingContraindicationTypes: Map<number, string>
  plan: Plan
  /** Stand-in ids for records a dry run only pretends to create. Always negative. */
  nextPlannedId: () => number
}

/**
 * Read every shared collection once, up front.
 *
 * The previous shape asked the database per term and per product: an exact
 * lookup plus a 500-document scan, repeated a few hundred times for a batch of
 * ten. The vocabulary does not change while a batch runs, so it is a snapshot,
 * not a live question. `limit: 0` means no limit — the old 500 cap silently
 * stopped matching once a collection outgrew it.
 */
async function loadVocabularies(
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<Record<EntityCollection, VocabularyIndex>> {
  const vocab = {} as Record<EntityCollection, VocabularyIndex>

  for (const collection of ENTITY_COLLECTIONS) {
    const field = TEXT_FIELD[collection]
    const { docs } = await payload.find({ collection, limit: 0, depth: 0 })

    const records = docs
      .map((doc) => ({ id: doc.id as number, text: (doc as any)[field] }))
      .filter((r): r is { id: number; text: string } => typeof r.text === 'string')

    vocab[collection] = createVocabularyIndex(records)
    console.log(`  ${String(records.length).padStart(4)}  ${collection}`)
  }

  return vocab
}

/**
 * Resolve one term to an id.
 *
 * Only exact equality links to an existing record. Anything short of that
 * creates a new one — a near miss is reported so a human can merge it later, but
 * it is never merged here. Merging by resemblance is what quietly erases a
 * clinical distinction, and undoing that means finding which links moved.
 */
async function resolveEntity(
  ctx: IngestContext,
  collection: EntityCollection,
  value: string,
  extraData: Record<string, unknown> = {},
): Promise<number> {
  const term = value.trim()
  const index = ctx.vocab[collection]
  const resolution = index.resolve(term)

  if (resolution.kind === 'exact') {
    ctx.plan.reused.push({ collection, term, id: resolution.id })
    return resolution.id
  }

  if (resolution.kind === 'near') {
    ctx.plan.nearDuplicates.push({
      collection,
      term,
      matched: resolution.matched,
      matchedId: resolution.matchedId,
    })
    console.log(`  [PARECIDO] ${collection}: "${term}" se parece a "${resolution.matched}" (ID: ${resolution.matchedId}) — se crea aparte`)
  }

  ctx.plan.createdEntities.push({ collection, term })

  const data: Record<string, unknown> = { [TEXT_FIELD[collection]]: term, ...extraData }

  if (ctx.dryRun) {
    const plannedId = ctx.nextPlannedId()
    index.register(term, plannedId)
    console.log(`  [CREARÍA] ${collection}: "${term}"`)
    return plannedId
  }

  const created = await ctx.payload.create({ collection, data } as any)
  // Registered so a second product in the same batch reuses it instead of
  // creating a duplicate: the preloaded index is a snapshot and would not know.
  index.register(term, created.id as number)
  console.log(`  [+] ${collection}: "${term}" (ID: ${created.id})`)
  return created.id as number
}

/**
 * Resolve one contraindication, carrying the type the extractor decided.
 *
 * Two things separate this from any other shared record. The type is a clinical
 * judgement that arrives in the JSON, and when the sheet did not allow deciding
 * it, the safe side is assumed and flagged. And when the base already holds that
 * description under a different type, the existing record is left exactly as it
 * is: it hangs off products the doctor already approved, so the disagreement is
 * reported and a human resolves it from the admin.
 */
async function resolveContraindication(
  ctx: IngestContext,
  input: ContraindicationInput,
): Promise<number> {
  const { description, type, assumed } = readContraindication(input)
  const index = ctx.vocab.contraindications
  const resolution = index.resolve(description)

  if (resolution.kind === 'exact') {
    const existing = ctx.existingContraindicationTypes.get(resolution.id)
    if (existing && existing !== type) {
      ctx.plan.typeConflicts.push({ term: description, existing, incoming: type, id: resolution.id })
      console.log(`  [CONFLICTO] contraindicación "${description}": en base es ${existing}, la ficha dice ${type} — no se toca`)
    }
    ctx.plan.reused.push({ collection: 'contraindications', term: description, id: resolution.id })
    return resolution.id
  }

  if (assumed) {
    ctx.plan.assumedTypes.push({ term: description })
    console.log(`  [SIN TIPO] contraindicación "${description}" — se crea absoluta, confirmar con la doctora`)
  }

  return resolveEntity(ctx, 'contraindications', description, { type })
}

/**
 * Resolve one protocol by name, without ever rewriting one that exists.
 *
 * `protocols.name` is the identity key here and carries no unique index, so two
 * different protocols under one name collapse into a single record. Updating
 * whatever was found — which is what this used to do — meant the second product
 * to use a name silently took over the first one's zones, depth and dose, on
 * presentations the doctor had already approved.
 */
async function getOrCreateProtocol(
  ctx: IngestContext,
  protoData: ProtocolInput
): Promise<number> {
  const name = typeof protoData.name === 'string' ? protoData.name.trim() : ''
  if (!name) {
    // Said plainly, because the fix is in the extractor's output, not here.
    throw new Error(
      'Un protocolo llegó sin `name`. Es obligatorio: el cargador identifica los ' +
        'protocolos por nombre y `Protocols.ts` lo exige. Ver docs/agente-extractor.md.',
    )
  }

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
    const zId = await resolveEntity(ctx, 'application-zones', zName)
    if (!zoneIds.includes(zId)) zoneIds.push(zId)
  }

  const rawRoutes = protoData.routes || protoData.route
  let routeNames = parseStringOrArray(rawRoutes)
  if (routeNames.length === 0) routeNames = ['Sin vía especificada']

  const routeIds: number[] = []
  for (const rName of routeNames) {
    const rId = await resolveEntity(ctx, 'administration-routes', rName)
    if (!routeIds.includes(rId)) routeIds.push(rId)
  }

  const rawTechs = protoData.techniques || protoData.technique
  let techNames = parseStringOrArray(rawTechs)
  if (techNames.length === 0) techNames = ['Sin técnica especificada']

  const techIds: number[] = []
  for (const tName of techNames) {
    const tId = await resolveEntity(ctx, 'application-techniques', tName)
    if (!techIds.includes(tId)) techIds.push(tId)
  }

  const content = {
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
  }

  const existing = await ctx.payload.find({
    collection: 'protocols',
    where: { name: { equals: name } },
    limit: 1,
    depth: 0,
  })

  const detail = `(Zonas: ${zoneNames.join(', ')} | Vías: ${routeNames.join(', ')} | Técnicas: ${techNames.join(', ')})`

  if (existing.docs.length > 0) {
    const found = existing.docs[0]
    const differences = describeProtocolDifference(found as ProtocolShape, content)

    if (differences.length > 0) {
      // Two different protocols under one name. The stored one stays exactly as
      // it is; a human decides whether they are really the same protocol or the
      // new one needs a name that tells them apart.
      ctx.plan.protocolConflicts.push({ name, id: found.id as number, differences })
      console.log(`  [CONFLICTO] protocolo '${name}' ya existe con otro contenido — no se toca`)
      for (const d of differences) {
        console.log(`      ${d.field}: en base ${d.existing} · la ficha dice ${d.incoming}`)
      }
    }

    ctx.plan.protocols.push({ name, action: 'reuse' })
    console.log(`  [ENLAZA] protocolo '${name}' (ID: ${found.id})`)
    return found.id as number
  }

  ctx.plan.protocols.push({ name, action: 'create' })

  if (ctx.dryRun) {
    console.log(`  [CREARÍA] protocolo '${name}' ${detail}`)
    return ctx.nextPlannedId()
  }

  const created = await ctx.payload.create({
    collection: 'protocols',
    data: { clientShareable: false, name, ...content },
  })
  console.log(`  [+] Creado protocolo de aplicación: '${name}' ${detail} (ID: ${created.id})`)
  return created.id as number
}

async function run() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('Inicializando Payload CMS...')
  const payload = await getPayload({ config: configPromise })

  const extractedDir = path.resolve(dirname, '../../tmp/migration/extracted')
  const files = readdirSync(extractedDir).filter((f) => f.endsWith('.json'))

  if (dryRun) {
    console.log('\n=== ENSAYO — no se escribe nada ===')
  }

  console.log('\nVocabulario precargado:')
  let plannedId = 0
  const contraindicationDocs = await payload.find({
    collection: 'contraindications',
    limit: 0,
    depth: 0,
  })

  const ctx: IngestContext = {
    payload,
    dryRun,
    vocab: await loadVocabularies(payload),
    existingContraindicationTypes: new Map(
      contraindicationDocs.docs.map((doc) => [doc.id as number, (doc as any).type]),
    ),
    plan: emptyPlan(),
    nextPlannedId: () => --plannedId,
  }

  console.log(`\n📦 Encontrados ${files.length} archivos JSON en ${extractedDir}:\n`)

  const results: FileResult[] = []

  for (const file of files) {
    const filePath = path.join(extractedDir, file)
    console.log(`--- Procesando ${file} ---`)

    try {
      const content = readFileSync(filePath, 'utf-8')
      const productData: ExtractedProduct = JSON.parse(content)

      const description = getOrExtractDescription(productData, file)
      if (description && !productData.description) {
        productData.description = description
      }

      // 1. Resolver Laboratorio
      const labId = await resolveEntity(ctx, 'laboratories', productData.laboratory)

      // 2. Resolver Ingredientes Activos
      const ingredientIds: number[] = []
      if (productData.activeIngredients && productData.activeIngredients.length > 0) {
        for (const ing of productData.activeIngredients) {
          const ingId = await resolveEntity(ctx, 'active-ingredients', ing)
          ingredientIds.push(ingId)
        }
      }

      // 3. Resolver Contraindicaciones
      const contraIds: number[] = []
      if (productData.contraindications && productData.contraindications.length > 0) {
        for (const contra of productData.contraindications) {
          const cId = await resolveContraindication(ctx, contra)
          contraIds.push(cId)
        }
      }

      // 4. Resolver Efectos Adversos
      const adverseIds: number[] = []
      if (productData.adverseEffects && productData.adverseEffects.length > 0) {
        for (const adv of productData.adverseEffects) {
          const aId = await resolveEntity(ctx, 'adverse-effects', adv)
          adverseIds.push(aId)
        }
      }

      // 5. Resolver Indicaciones Clínicas
      const indicationIds: number[] = []
      if (productData.clinicalIndications && productData.clinicalIndications.length > 0) {
        for (const ind of productData.clinicalIndications) {
          const iId = await resolveEntity(ctx, 'clinical-indications', ind)
          indicationIds.push(iId)
        }
      }

      // 6. Resolver Cuidados Post-Aplicación
      const postCareIds: number[] = []
      if (productData.postCareNotes && productData.postCareNotes.length > 0) {
        for (const note of productData.postCareNotes) {
          const pId = await resolveEntity(ctx, 'post-care-notes', note)
          postCareIds.push(pId)
        }
      }

      // 7. Resolver Advertencias de Seguridad
      const safetyIds: number[] = []
      if (productData.safetyWarnings && productData.safetyWarnings.length > 0) {
        for (const warn of productData.safetyWarnings) {
          const sId = await resolveEntity(ctx, 'safety-warnings', warn)
          safetyIds.push(sId)
        }
      }

      // 8. Mapear presentaciones y resolver protocolos
      const cleanedPresentations: any[] = []
      for (const pres of productData.presentations || []) {
        const copy: any = {
          ...pres,
          certifications: (productData as any).certifications || null,
          contraindications: contraIds,
          adverseEffects: adverseIds,
          clinicalIndications: indicationIds,
          postCareNotes: postCareIds,
          safetyWarnings: safetyIds,
        }

        if (pres.protocols && pres.protocols.length > 0) {
          const protocolIds: number[] = []
          for (const p of pres.protocols) {
            const pId = await getOrCreateProtocol(ctx, p)
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
          const getIds = (arr: any) => (!arr || !Array.isArray(arr) ? [] : arr.map((i) => (typeof i === 'object' ? i.id : i)))
          payloadData.activeIngredients = Array.from(new Set([...getIds(existingDoc.activeIngredients), ...ingredientIds]))
        }
        if (existingDoc.presentations && existingDoc.presentations.length > 0) {
          payloadData.presentations = mergePresentations(
            existingDoc.presentations,
            cleanedPresentations,
          )
        }

        ctx.plan.products.push({ name: payloadData.canonicalName, action: 'update' })

        if (!dryRun) {
          await payload.update({
            collection: 'products',
            id: prodId,
            data: payloadData,
          })
        }
        results.push({ file, outcome: 'updated', name: payloadData.canonicalName })
        const verb = dryRun ? 'ACTUALIZARÍA' : 'UPDATE'
        console.log(`  [${verb}] Producto '${payloadData.canonicalName}' (ID: ${prodId}) [Estado: ${payloadData.validationStatus}].`)
      } else {
        ctx.plan.products.push({ name: payloadData.canonicalName, action: 'create' })

        const created = dryRun
          ? { id: ctx.nextPlannedId() }
          : await payload.create({ collection: 'products', data: payloadData })
        results.push({ file, outcome: 'created', name: payloadData.canonicalName })
        const verb = dryRun ? 'CREARÍA' : 'CREATE'
        console.log(`  [${verb}] Producto '${payloadData.canonicalName}' (ID: ${created.id}).`)
      }
    } catch (err: any) {
      // One bad file does not stop the batch: the remaining nine are still worth
      // processing, and stopping halfway leaves a partial load nobody asked for.
      results.push({ file, outcome: 'error', message: err.message })
      console.error(`  ❌ Error procesando ${file}:`, err.message)
    }
  }

  reportPlan(ctx, results)

  const reportPath = writeReport(ctx, results)
  console.log(`\nReporte escrito en ${path.relative(process.cwd(), reportPath)}`)

  // Exit 1 when anything failed, so a caller — a shell, the agent, CI — learns it
  // from the exit code instead of having to read the log to find out.
  const failed = results.filter((r) => r.outcome === 'error').length
  process.exit(failed > 0 ? 1 : 0)
}

/**
 * Write the run's report next to the batch it describes.
 *
 * `tmp/migration/` is gitignored, which is what this wants: the report names the
 * clinical terms of a batch under review, and it is evidence for the person doing
 * the reviewing, not a project artefact.
 *
 * One file per run, stamped and never overwritten — comparing the dry run against
 * the real one is the whole point of running the dry one first.
 */
function writeReport(ctx: IngestContext, results: FileResult[]): string {
  const at = new Date()
  const dir = path.resolve(dirname, '../../tmp/migration/reports')
  mkdirSync(dir, { recursive: true })

  const target = path.join(dir, reportFileName(ctx.dryRun, at))
  writeFileSync(target, renderReport({ dryRun: ctx.dryRun, plan: ctx.plan, results, at }), 'utf-8')
  return target
}

/**
 * The shared-record section comes first on purpose.
 *
 * Products enter PENDING and stay invisible to the chat until the doctor
 * approves them, so they are the safe half. The contraindications, post-care
 * notes, warnings and adverse effects are the half that attaches to products
 * already approved — that is what a reviewer needs to look at, so that is what
 * goes at the top.
 */
function reportPlan(ctx: IngestContext, results: FileResult[]) {
  const { plan, dryRun } = ctx
  const count = (outcome: FileResult['outcome']) =>
    results.filter((r) => r.outcome === outcome).length
  const head = dryRun ? 'ENSAYO — NADA SE ESCRIBIÓ' : 'RESUMEN DE INGESTA'

  console.log('\n========================================')
  console.log(head)
  console.log('========================================')

  const byCollection = (rows: Array<{ collection: string }>) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.collection] = (acc[r.collection] || 0) + 1
      return acc
    }, {})

  console.log('\nREGISTROS COMPARTIDOS')
  console.log(`  Reutilizados por igualdad exacta: ${plan.reused.length}`)

  if (plan.createdEntities.length > 0) {
    console.log(`\n  ${dryRun ? 'Se crearían' : 'Creados'} ${plan.createdEntities.length}:`)
    for (const [collection, count] of Object.entries(byCollection(plan.createdEntities))) {
      console.log(`    ${String(count).padStart(3)}  ${collection}`)
    }
    for (const row of plan.createdEntities) {
      console.log(`      + [${row.collection}] ${row.term}`)
    }
  } else {
    console.log(`  ${dryRun ? 'No se crearía' : 'No se creó'} ningún registro compartido.`)
  }

  if (plan.nearDuplicates.length > 0) {
    console.log(`\n  ⚠ CASI-DUPLICADOS: ${plan.nearDuplicates.length} — REVISAR UNA POR UNA`)
    console.log('    Se creó el registro nuevo y no se fusionó nada. Si de verdad')
    console.log('    son el mismo término, se unifican a mano desde el admin.')
    for (const row of plan.nearDuplicates) {
      console.log(`      ? [${row.collection}] "${row.term}"`)
      console.log(`          se parece a "${row.matched}" (ID: ${row.matchedId})`)
    }
  }

  if (plan.assumedTypes.length > 0) {
    console.log(`\n  ⚠ CONTRAINDICACIONES SIN TIPO: ${plan.assumedTypes.length}`)
    console.log('    La ficha no permitía decidir. Se crearon `absoluta`, el lado')
    console.log('    seguro. La doctora confirma o las baja a `relativa`.')
    for (const row of plan.assumedTypes) {
      console.log(`      ? "${row.term}"`)
    }
  }

  if (plan.typeConflicts.length > 0) {
    console.log(`\n  ⚠ TIPOS EN CONFLICTO: ${plan.typeConflicts.length} — NO SE TOCÓ NADA`)
    console.log('    El registro compartido quedó como estaba, porque cuelga de')
    console.log('    productos ya aprobados. Se resuelve a mano desde el admin.')
    for (const row of plan.typeConflicts) {
      console.log(`      ! "${row.term}" (ID: ${row.id})`)
      console.log(`          en base: ${row.existing} · la ficha dice: ${row.incoming}`)
    }
  }

  const protocolsCreated = plan.protocols.filter((p) => p.action === 'create').length
  console.log('\nPROTOCOLOS')
  console.log(`  ${dryRun ? 'Se crearían' : 'Creados'}: ${protocolsCreated}`)
  console.log(`  Enlazados a uno existente: ${plan.protocols.length - protocolsCreated}`)

  if (plan.protocolConflicts.length > 0) {
    console.log(`\n  ⚠ PROTOCOLOS EN CONFLICTO: ${plan.protocolConflicts.length} — NO SE TOCÓ NINGUNO`)
    for (const row of plan.protocolConflicts) {
      console.log(`      ! "${row.name}" (ID: ${row.id})`)
      for (const d of row.differences) {
        console.log(`          ${d.field}: en base ${d.existing} · la ficha dice ${d.incoming}`)
      }
    }
  }

  console.log('\nPRODUCTOS')
  console.log(`  Archivos: ${results.length}`)
  console.log(`  ${dryRun ? 'Se crearían' : 'Creados'}: ${count('created')}`)
  console.log(`  ${dryRun ? 'Se actualizarían' : 'Actualizados'}: ${count('updated')}`)
  console.log(`  Errores: ${count('error')}`)

  if (dryRun) {
    console.log('\nNada de lo anterior se escribió. Para aplicarlo, correr sin --dry-run.')
  }
  console.log('----------------------------------------')
}

run().catch((err) => {
  console.error('Fatal error in ingester:', err)
  process.exit(1)
})

