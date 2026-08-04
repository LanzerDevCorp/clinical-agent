import type { CollectionAfterChangeHook } from 'payload'
import path from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

export const syncProductToJson: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    if (!doc || !doc.canonicalName) return doc

    const targetDir = path.resolve(process.cwd(), 'tmp/migration/extracted')
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    const canonicalUpper = String(doc.canonicalName).trim().toUpperCase()
    const fileName = `${canonicalUpper.replace(/\s+/g, '_')}.json`
    const filePath = path.join(targetDir, fileName)

    // Helper para mapear entidades relacionales o strings
    const resolveStringOrName = (item: any): string => {
      if (!item) return ''
      if (typeof item === 'string') return item
      return item.name || item.description || String(item)
    }

    const resolveList = (arr: any[]): string[] => {
      if (!Array.isArray(arr)) return []
      return arr.map(resolveStringOrName).filter(Boolean)
    }

    const labName = typeof doc.laboratory === 'object' && doc.laboratory !== null
      ? doc.laboratory.name || ''
      : String(doc.laboratory || '')

    const activeIngs = Array.isArray(doc.activeIngredients)
      ? doc.activeIngredients.map((i: any) => typeof i === 'object' ? i.name : String(i)).filter(Boolean)
      : []

    const presentations = Array.isArray(doc.presentations)
      ? doc.presentations.map((p: any) => ({
          canonicalName: p.canonicalName,
          status: p.status,
          aliases: p.aliases || [],
          reconstitution: p.reconstitution || null,
        }))
      : []

    // Obtener contraindicaciones, postCareNotes, etc. de la primera presentación si están ahí
    const firstPres = (doc.presentations || [])[0] || {}

    const jsonContent = {
      canonicalName: canonicalUpper,
      productType: doc.productType || 'otro',
      laboratory: labName,
      activeIngredients: activeIngs,
      aliases: doc.aliases || [],
      validationStatus: doc.validationStatus || 'PENDING',
      validationNotes: doc.validationNotes || null,
      clinicalIndications: resolveList(firstPres.clinicalIndications || doc.clinicalIndications),
      contraindications: resolveList(firstPres.contraindications || doc.contraindications),
      adverseEffects: resolveList(firstPres.adverseEffects || doc.adverseEffects),
      postCareNotes: resolveList(firstPres.postCareNotes || doc.postCareNotes),
      safetyWarnings: resolveList(firstPres.safetyWarnings || doc.safetyWarnings),
      presentations,
      visibleEffectsOnset: doc.visibleEffectsOnset || null,
      effectDuration: doc.effectDuration || null,
      description: doc.description || null,
    }

    writeFileSync(filePath, JSON.stringify(jsonContent, null, 2), 'utf-8')
    req.payload.logger.info(`[HOOK] Sincronizado producto '${canonicalUpper}' en ${filePath}`)
  } catch (err: any) {
    req.payload.logger.error(`[HOOK ERROR] Error al sincronizar JSON de producto: ${err.message}`)
  }

  return doc
}
