import type { ClinicalFact } from '@/lib/clinical-agent/agent/contracts'
import type { ProductDetails, ProtocolSummary, SearchData } from '@/lib/clinical-agent/contracts'

import styles from './clinical-chat.module.css'

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className={styles.field}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{value}</dd>
    </div>
  )
}

function ListField({ label, items }: { label: string; items: readonly string[] | undefined }) {
  if (!items?.length) return null
  return (
    <div className={styles.field}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>
        <ul className={styles.list}>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </dd>
    </div>
  )
}

function Contraindications({ items }: { items: ProductDetails['presentation']['contraindications'] }) {
  if (!items?.length) return null
  return (
    <div className={styles.field}>
      <dt className={styles.fieldLabel}>Contraindicaciones</dt>
      <dd className={styles.fieldValue}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.description}>
              <span className={item.type === 'absoluta' ? styles.badgeAbsolute : styles.badgeRelative}>
                {item.type}
              </span>
              {item.description}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  )
}

function Protocol({ protocol }: { protocol: ProtocolSummary }) {
  const sessions = protocol.sessionsMin && protocol.sessionsMax
    ? `${protocol.sessionsMin} a ${protocol.sessionsMax}`
    : protocol.sessionsMin ?? protocol.sessionsMax
  return (
    <section className={styles.protocol}>
      <h4 className={styles.protocolName}>{protocol.name}</h4>
      <dl className={styles.fields}>
        <ListField label="Zonas" items={protocol.zones} />
        <ListField label="Vías" items={protocol.routes} />
        <ListField label="Técnicas" items={protocol.techniques} />
        <Field label="Dosis recomendada" value={protocol.recommendedDose} />
        <Field label="Profundidad" value={protocol.injectionDepth} />
        <Field label="Sesiones" value={sessions} />
        <Field label="Frecuencia" value={protocol.frequency} />
        <Field label="Inicio de efectos" value={protocol.visibleEffectsOnset} />
        <Field label="Duración del efecto" value={protocol.effectDuration} />
      </dl>
    </section>
  )
}

function Details({ details }: { details: ProductDetails }) {
  const { product, presentation } = details
  const reconstitution = presentation.reconstitution
  return (
    <div className={styles.factBody}>
      <h3 className={styles.factTitle}>
        {product.canonicalName}
        <span className={styles.factSubtitle}>{presentation.canonicalName}</span>
      </h3>
      <dl className={styles.fields}>
        <Field label="Laboratorio" value={product.laboratory} />
        <Field label="Tipo" value={product.productType} />
        <Field label="Descripción" value={product.description} />
        <ListField label="Ingredientes activos" items={product.activeIngredients} />
        <Field label="Características" value={presentation.characteristics} />
        <Field label="Certificaciones" value={presentation.certifications} />
        <Contraindications items={presentation.contraindications} />
        <ListField label="Efectos adversos" items={presentation.adverseEffects} />
        <ListField label="Indicaciones clínicas" items={presentation.clinicalIndications} />
        <ListField label="Cuidados posteriores" items={presentation.postCareNotes} />
        <ListField label="Advertencias" items={presentation.safetyWarnings} />
        {reconstitution && (
          <>
            <Field label="Diluyente" value={reconstitution.diluentType} />
            <Field label="Volumen (mL)" value={reconstitution.volumeMl} />
            <Field label="Reconstitución" value={reconstitution.instructions} />
          </>
        )}
      </dl>
      {presentation.protocols.length > 0 && (
        <>
          <h4 className={styles.sectionHeading}>Protocolos</h4>
          {presentation.protocols.map((protocol) => <Protocol key={protocol.id} protocol={protocol} />)}
        </>
      )}
    </div>
  )
}

function Search({ search }: { search: SearchData }) {
  if (search.kind === 'empty') {
    return <p className={styles.note}>No se encontraron productos para esa consulta.</p>
  }
  if (search.kind === 'match') {
    return (
      <p className={styles.note}>
        Coincidencia: <strong>{search.product.canonicalName}</strong> — {search.presentation.canonicalName}
      </p>
    )
  }
  return (
    <div className={styles.factBody}>
      <p className={styles.note}>
        Varios productos coinciden. Precisá cuál te interesa y volvé a preguntar
        {search.truncated ? ' (la lista está recortada)' : ''}:
      </p>
      <ul className={styles.list}>
        {search.choices.map((choice) => (
          <li key={`${choice.product.id}:${choice.presentation?.id ?? ''}`}>
            <strong>{choice.product.canonicalName}</strong>
            {choice.presentation ? ` — ${choice.presentation.canonicalName}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * `kind` and `value` are independent fields on ClinicalFact, so narrowing one does
 * not narrow the other. Each branch asserts the payload its kind guarantees.
 */
function Fact({ fact }: { fact: ClinicalFact }) {
  if (fact.kind === 'details') return <Details details={fact.value as ProductDetails} />
  if (fact.kind === 'protocol') return <Protocol protocol={fact.value as ProtocolSummary} />
  return <Search search={fact.value as SearchData} />
}

export function ClinicalFacts({ facts, emptyLabel }: { facts: readonly ClinicalFact[]; emptyLabel: string }) {
  if (facts.length === 0) return <p className={styles.note}>{emptyLabel}</p>
  return (
    <div className={styles.facts}>
      {facts.map((fact) => <Fact key={fact.id} fact={fact} />)}
    </div>
  )
}

/** Plain-text projection used by the copy action, so the clipboard is readable. */
export function factsToText(facts: readonly ClinicalFact[]): string {
  const lines: string[] = []
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return
    lines.push(`${label}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
  }
  const pushProtocol = (protocol: ProtocolSummary) => {
    lines.push(protocol.name)
    push('  Zonas', protocol.zones)
    push('  Vías', protocol.routes)
    push('  Técnicas', protocol.techniques)
    push('  Dosis recomendada', protocol.recommendedDose)
    push('  Profundidad', protocol.injectionDepth)
    push('  Sesiones', protocol.sessionsMin && protocol.sessionsMax ? `${protocol.sessionsMin} a ${protocol.sessionsMax}` : undefined)
    push('  Frecuencia', protocol.frequency)
    push('  Inicio de efectos', protocol.visibleEffectsOnset)
    push('  Duración del efecto', protocol.effectDuration)
  }

  for (const fact of facts) {
    if (fact.kind === 'protocol') pushProtocol(fact.value as ProtocolSummary)
    else if (fact.kind === 'details') {
      const { product, presentation } = fact.value as ProductDetails
      lines.push(`${product.canonicalName} — ${presentation.canonicalName}`)
      push('Laboratorio', product.laboratory)
      push('Descripción', product.description)
      presentation.protocols.forEach(pushProtocol)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}
