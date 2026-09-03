import type { ClinicalFact } from '@/lib/clinical-agent/agent/contracts'

export const NO_SHAREABLE_PROTOCOL_LABEL = 'Ningún protocolo está autorizado para compartir con el paciente.'
export const PROFESSIONAL_ONLY_LABEL = 'Esa información la maneja el profesional a cargo — consultala con él/ella.'

/**
 * The client panel has no free-text fallback — it is either populated facts or one of
 * two fixed labels. Which one depends on *why* it's empty: a plain "nothing shareable"
 * (today's only case) reads differently from "you asked about something that's always
 * internal" (contraindications, adverse effects, etc.) — the second one points the
 * patient at the professional instead of implying no protocol exists at all.
 */
export function clientEmptyLabel(internal: readonly ClinicalFact[]): string {
  const askedAlwaysInternalField = internal.some((fact) => fact.kind === 'details' && !fact.clientEligible)
  return askedAlwaysInternalField ? PROFESSIONAL_ONLY_LABEL : NO_SHAREABLE_PROTOCOL_LABEL
}
