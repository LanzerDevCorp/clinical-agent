'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ClinicalAgentEvent, ClinicalFact } from '@/lib/clinical-agent/agent/contracts'

import { ClinicalFacts } from './ClinicalFacts'
import { requestBodyFromLastUser } from './request-body'

export type ClinicalUIMessage = UIMessage<never, { clinical: ClinicalAgentEvent }>

const EXAMPLES = [
  'Protocolo para Hyaluronic Acid',
  'Contraindicaciones de Wiztox',
  'Cómo se reconstituye Rejubella',
] as const

/**
 * The route answers with opaque status codes on purpose — it never leaks a
 * provider or database reason — so the copy is chosen here, not received.
 */
const HTTP_MESSAGES: Record<number, string> = {
  400: 'La consulta no tiene un formato válido.',
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'Esta consulta solo puede hacerse desde la aplicación.',
  413: 'La consulta es demasiado larga.',
  415: 'Formato de consulta no soportado.',
  429: 'Alcanzaste el límite de consultas. Espera unos minutos.',
  503: 'El servicio no está disponible en este momento.',
}

function messageForStatus(status: number): string {
  return HTTP_MESSAGES[status] ?? 'No se pudo completar la consulta.'
}

function userText(message: ClinicalUIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

function clinicalEvents(message: ClinicalUIMessage | undefined): ClinicalAgentEvent[] {
  if (!message) return []
  return message.parts.flatMap((part) => (part.type === 'data-clinical' ? [part.data] : []))
}

type TurnView = {
  id: string
  question: string
  state: 'processing' | 'done' | 'failed'
  artifact?: { internal: readonly ClinicalFact[]; client: readonly ClinicalFact[] }
  error?: string
}

function turnsFromMessages(
  messages: ClinicalUIMessage[],
  status: 'submitted' | 'streaming' | 'ready' | 'error',
  chatError: Error | undefined,
): TurnView[] {
  const turns: TurnView[] = []

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role !== 'user') continue

    const next = messages[index + 1]
    const assistant = next?.role === 'assistant' ? next : undefined
    const events = clinicalEvents(assistant)
    const artifact = events.find((event) => event.type === 'artifact')
    const clinicalError = events.find((event) => event.type === 'error')
    const last = !messages.slice(index + 1).some((item) => item.role === 'user')
    const question = userText(message)

    if (artifact && artifact.type === 'artifact') {
      turns.push({
        id: message.id,
        question,
        state: 'done',
        artifact: { internal: artifact.internal, client: artifact.client },
      })
      continue
    }

    if (clinicalError && clinicalError.type === 'error') {
      turns.push({ id: message.id, question, state: 'failed', error: clinicalError.message })
      continue
    }

    if (last && (status === 'submitted' || status === 'streaming')) {
      turns.push({ id: message.id, question, state: 'processing' })
      continue
    }

    if (last && status === 'error') {
      const aborted = chatError?.name === 'AbortError'
      turns.push({
        id: message.id,
        question,
        state: 'failed',
        error: aborted
          ? 'Consulta cancelada.'
          : chatError?.message || 'No se pudo conectar con el servicio.',
      })
      continue
    }

    turns.push({
      id: message.id,
      question,
      state: 'failed',
      error: assistant ? 'La consulta terminó sin respuesta.' : 'Consulta cancelada.',
    })
  }

  return turns
}

function clinicalTransport() {
  return new DefaultChatTransport<ClinicalUIMessage>({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ messages }) => ({
      body: JSON.parse(requestBodyFromLastUser(messages)) as object,
    }),
    fetch: async (input, init) => {
      let response: Response
      try {
        response = await globalThis.fetch(input, init)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        throw new Error('No se pudo conectar con el servicio.')
      }
      if (!response.ok) throw new Error(messageForStatus(response.status))
      if (!response.body) throw new Error('La consulta terminó sin respuesta.')
      return response
    },
  })
}

export function ClinicalChat({
  userEmail,
  canViewCatalog,
}: {
  userEmail: string
  canViewCatalog: boolean
}) {
  const [draft, setDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const transport = useMemo(clinicalTransport, [])

  const { messages, sendMessage, status, stop, error } = useChat<ClinicalUIMessage>({
    transport,
  })

  const busy = status === 'submitted' || status === 'streaming'
  const turns = turnsFromMessages(messages, status, error)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && busy) stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, stop])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const question = draft.trim()
    if (!question || busy) return
    setDraft('')
    void sendMessage({ text: question })
  }

  const fillExample = (text: string) => {
    setDraft(text)
    composerRef.current?.focus()
  }

  return (
    <div className="mx-auto flex h-svh max-w-[1200px] flex-col px-6 text-[15px] leading-snug">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border py-4">
        <h1 className="m-0 text-lg font-semibold tracking-tight">Consulta clínica</h1>
        <div className="flex flex-wrap items-center gap-2">
          <UserMenu email={userEmail} canViewCatalog={canViewCatalog} />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto py-6">
        {turns.length === 0 && (
          <div className="text-muted-foreground flex flex-col gap-3">
            <p className="m-0">Escribe una consulta sobre un producto, una presentación o un protocolo.</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fillExample(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <article key={turn.id} className="flex flex-col gap-3">
            <p className="bg-secondary text-secondary-foreground m-0 max-w-[70%] self-end rounded-lg px-3 py-2">
              {turn.question}
            </p>

            {turn.state === 'processing' && (
              <p className="text-muted-foreground m-0 text-sm" role="status">
                Consultando el catálogo…
              </p>
            )}

            {turn.state === 'failed' && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm" role="alert">
                <span>{turn.error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => void sendMessage({ text: turn.question })}
                  disabled={busy}
                >
                  Reintentar
                </Button>
              </div>
            )}

            {turn.state === 'done' && turn.artifact && (
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <section
                  className="bg-card flex min-w-0 flex-col gap-2 rounded-md border border-border p-3"
                  aria-label="Datos clínicos internos"
                >
                  <h2 className="text-muted-foreground m-0 text-xs font-semibold tracking-wider uppercase">
                    Datos internos
                  </h2>
                  <ClinicalFacts facts={turn.artifact.internal} emptyLabel="Sin datos internos." onPick={fillExample} />
                </section>

                <section
                  className="bg-shareable text-shareable-foreground flex min-w-0 flex-col gap-2 rounded-md border border-l-4 border-l-shareable-rule p-3"
                  aria-label="Versión para el paciente"
                >
                  <h2 className="m-0 text-xs font-semibold tracking-wider uppercase">Para el paciente</h2>
                  <ClinicalFacts
                    facts={turn.artifact.client}
                    emptyLabel="Ningún protocolo está autorizado para compartir con el paciente."
                    copyProtocols
                  />
                </section>
              </div>
            )}
          </article>
        ))}
      </div>

      <form className="flex items-end gap-2 border-t border-border py-4" onSubmit={submit}>
        <Textarea
          ref={composerRef}
          className="max-h-32 min-h-12"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="Escribe tu consulta…"
          disabled={busy}
          aria-label="Consulta"
          rows={2}
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            Cancelar
          </Button>
        ) : (
          <Button type="submit" disabled={!draft.trim()}>
            Enviar
          </Button>
        )}
      </form>
    </div>
  )
}
