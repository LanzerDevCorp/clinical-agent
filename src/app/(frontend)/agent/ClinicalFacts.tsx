'use client'

import { useState } from 'react'

import type { ClinicalFact } from '@/lib/clinical-agent/agent/contracts'
import type { ProductDetails, ProtocolSummary, SearchData } from '@/lib/clinical-agent/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="grid grid-cols-1 items-baseline gap-0.5 text-sm sm:grid-cols-[minmax(7rem,8.5rem)_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 font-mono text-[0.8rem] tabular-nums wrap-break-word">{value}</dd>
    </div>
  )
}

function ListField({ label, items }: { label: string; items: readonly string[] | undefined }) {
  if (!items?.length) return null
  return (
    <div className="grid grid-cols-1 items-baseline gap-0.5 text-sm sm:grid-cols-[minmax(7rem,8.5rem)_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0">
        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  )
}

function Contraindications({ items }: { items: ProductDetails['presentation']['contraindications'] }) {
  if (!items?.length) return null
  return (
    <div className="grid grid-cols-1 items-baseline gap-0.5 text-sm sm:grid-cols-[minmax(7rem,8.5rem)_1fr] sm:gap-3">
      <dt className="text-muted-foreground">Contraindicaciones</dt>
      <dd className="m-0">
        <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
          {items.map((item) => (
            <li key={item.description}>
              <Badge
                variant={item.type === 'absoluta' ? 'destructive' : 'outline'}
                className={item.type === 'relativa' ? 'mr-1.5 border-warning text-warning-foreground' : 'mr-1.5'}
              >
                {item.type}
              </Badge>
              {item.description}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={async () => {
        await navigator.clipboard?.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  )
}

function Protocol({
  protocol,
  copyable,
}: {
  protocol: ProtocolSummary
  copyable?: boolean
}) {
  const sessions = protocol.sessionsMin && protocol.sessionsMax
    ? `${protocol.sessionsMin} a ${protocol.sessionsMax}`
    : protocol.sessionsMin ?? protocol.sessionsMax
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-md border border-border/80 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <h4 className="m-0 text-sm font-semibold">{protocol.name}</h4>
        {copyable && <CopyButton text={protocolToText(protocol)} />}
      </div>
      <dl className="m-0 grid gap-1.5">
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

function Details({
  details,
  copyProtocols,
}: {
  details: ProductDetails
  copyProtocols?: boolean
}) {
  const { product, presentation } = details
  const reconstitution = presentation.reconstitution
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 flex flex-wrap items-baseline gap-2 text-base font-semibold">
        {product.canonicalName}
        <span className="text-muted-foreground text-xs font-normal">{presentation.canonicalName}</span>
      </h3>
      <dl className="m-0 grid gap-1.5">
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
          <h4 className="text-muted-foreground mt-1 mb-0 text-xs font-semibold tracking-wider uppercase">
            Protocolos
          </h4>
          {presentation.protocols.map((protocol) => (
            <Protocol
              key={protocol.id}
              protocol={protocol}
              copyable={copyProtocols}
            />
          ))}
        </>
      )}
    </div>
  )
}

function Search({
  search,
  onPick,
}: {
  search: SearchData
  onPick?: (text: string) => void
}) {
  if (search.kind === 'empty') {
    return <p className="text-muted-foreground m-0 text-sm">No se encontraron productos para esa consulta.</p>
  }
  if (search.kind === 'match') {
    return (
      <p className="text-muted-foreground m-0 text-sm">
        Coincidencia: <strong className="text-foreground">{search.product.canonicalName}</strong>
        {' — '}
        {search.presentation.canonicalName}
      </p>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-muted-foreground m-0 text-sm">
        Varios productos coinciden. Precisá cuál te interesa y volvé a preguntar
        {search.truncated ? ' (la lista está recortada)' : ''}:
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {search.choices.map((choice) => {
          const label = choice.presentation
            ? `${choice.product.canonicalName} — ${choice.presentation.canonicalName}`
            : choice.product.canonicalName
          return (
            <li key={`${choice.product.id}:${choice.presentation?.id ?? ''}`}>
              {onPick ? (
                <Button type="button" variant="ghost" size="sm" className="h-auto justify-start px-2 py-1 text-left" onClick={() => onPick(label)}>
                  {label}
                </Button>
              ) : (
                <span>
                  <strong>{choice.product.canonicalName}</strong>
                  {choice.presentation ? ` — ${choice.presentation.canonicalName}` : ''}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Fact({
  fact,
  onPick,
  copyProtocols,
}: {
  fact: ClinicalFact
  onPick?: (text: string) => void
  copyProtocols?: boolean
}) {
  if (fact.kind === 'details') {
    return <Details details={fact.value as ProductDetails} copyProtocols={copyProtocols} />
  }
  if (fact.kind === 'protocol') {
    return <Protocol protocol={fact.value as ProtocolSummary} copyable={copyProtocols} />
  }
  return <Search search={fact.value as SearchData} onPick={onPick} />
}

export function ClinicalFacts({
  facts,
  emptyLabel,
  onPick,
  copyProtocols,
}: {
  facts: readonly ClinicalFact[]
  emptyLabel: string
  onPick?: (text: string) => void
  copyProtocols?: boolean
}) {
  if (facts.length === 0) return <p className="text-muted-foreground m-0 text-sm">{emptyLabel}</p>
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {facts.map((fact) => (
        <Fact key={fact.id} fact={fact} onPick={onPick} copyProtocols={copyProtocols} />
      ))}
    </div>
  )
}

export function protocolToText(protocol: ProtocolSummary): string {
  const lines: string[] = [protocol.name]
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return
    lines.push(`${label}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
  }
  push('  Zonas', protocol.zones)
  push('  Vías', protocol.routes)
  push('  Técnicas', protocol.techniques)
  push('  Dosis recomendada', protocol.recommendedDose)
  push('  Profundidad', protocol.injectionDepth)
  push(
    '  Sesiones',
    protocol.sessionsMin && protocol.sessionsMax ? `${protocol.sessionsMin} a ${protocol.sessionsMax}` : undefined,
  )
  push('  Frecuencia', protocol.frequency)
  push('  Inicio de efectos', protocol.visibleEffectsOnset)
  push('  Duración del efecto', protocol.effectDuration)
  return lines.join('\n')
}

/** Plain-text projection used by the copy action, so the clipboard is readable. */
export function factsToText(facts: readonly ClinicalFact[]): string {
  const lines: string[] = []
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return
    lines.push(`${label}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
  }

  for (const fact of facts) {
    if (fact.kind === 'protocol') lines.push(protocolToText(fact.value as ProtocolSummary))
    else if (fact.kind === 'details') {
      const { product, presentation } = fact.value as ProductDetails
      lines.push(`${product.canonicalName} — ${presentation.canonicalName}`)
      push('Laboratorio', product.laboratory)
      push('Descripción', product.description)
      presentation.protocols.forEach((protocol) => lines.push(protocolToText(protocol)))
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}
