/**
 * Read one contraindication as the extractor emits it.
 *
 * The type is a clinical judgement made against the product sheet — "contraindicado
 * en" prohibits, "usar con precaución" warns — so it is decided by whoever reads
 * the sheet, not by the loader. It arrives in the JSON.
 *
 * When the sheet does not allow deciding, the extractor omits it, and that
 * omission is a signal rather than a gap: it means a human has to look. So the
 * absent case resolves to the safe side and is flagged, never assumed quietly.
 */

export type ContraindicationType = 'absoluta' | 'relativa'

/** What the extractor may put in the array: the full shape, or a bare string. */
export type ContraindicationInput = string | { description: string; type?: ContraindicationType }

export interface Contraindication {
  description: string
  type: ContraindicationType
  /** True when the type was not stated and had to be assumed. Goes in the report. */
  assumed: boolean
}

const VALID_TYPES: readonly string[] = ['absoluta', 'relativa']

export function readContraindication(input: ContraindicationInput): Contraindication {
  const description = (typeof input === 'string' ? input : input?.description ?? '').trim()

  if (!description) {
    throw new Error('Una contraindicación llegó sin descripción utilizable.')
  }

  const declared = typeof input === 'string' ? undefined : input.type

  // An unknown value is not information, it is broken data, so it resolves the
  // way absence does: safe side, and reported.
  if (typeof declared === 'string' && VALID_TYPES.includes(declared)) {
    return { description, type: declared as ContraindicationType, assumed: false }
  }

  return { description, type: 'absoluta', assumed: true }
}
