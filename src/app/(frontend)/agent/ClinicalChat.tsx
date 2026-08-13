'use client'

import { useCallback, useRef, useState } from 'react'

import type { ClinicalAgentEvent, ClinicalFact } from '@/lib/clinical-agent/agent/contracts'

import { ClinicalFacts, factsToText } from './ClinicalFacts'
import styles from './clinical-chat.module.css'

export type Turn = {
  id: string
  question: string
  state: 'processing' | 'done' | 'failed'
  artifact?: { internal: readonly ClinicalFact[]; client: readonly ClinicalFact[] }
  error?: string
}

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

/**
 * Builds the exact body the route accepts. `hasExactKeys` in
 * src/app/api/chat/route.ts rejects any extra key at the body, message, or part
 * level, so nothing beyond these fields may be sent.
 *
 * Only the current question travels. The route accepts `role: 'user'` and
 * nothing else (`isClinicalUserMessage`), so sending the session's history put a
 * list of questions with no answers between them in front of the model, which
 * read them as all still open and answered every one again: the internal panel
 * filled with products nobody had just asked about, and the tool budget ran out
 * before reaching the current question.
 *
 * The cost is that a follow-up cannot lean on what came before — "¿y su dosis?"
 * has no antecedent here. That is the honest shape while the contract carries no
 * assistant turns: a conversation the model cannot see is worse than one it is
 * never offered.
 */
export function requestBody(question: Turn) {
  return JSON.stringify({
    messages: [
      {
        id: question.id,
        role: 'user',
        parts: [{ type: 'text', text: question.question }],
      },
    ],
  })
}

/**
 * Reads the AI SDK UI message stream. Every frame is `data: <json>` separated by
 * a blank line, and the stream closes with a literal `data: [DONE]`.
 */
async function* readClinicalEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ClinicalAgentEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const line = frame.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice('data:'.length).trim()
        if (payload === '[DONE]') continue

        let chunk: unknown
        try {
          chunk = JSON.parse(payload)
        } catch {
          continue
        }
        // The stream also carries lifecycle chunks we do not render.
        if (
          chunk
          && typeof chunk === 'object'
          && (chunk as { type?: unknown }).type === 'data-clinical'
        ) {
          yield (chunk as { data: ClinicalAgentEvent }).data
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function ClinicalChat({ userEmail }: { userEmail: string }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const updateTurn = useCallback((id: string, patch: Partial<Turn>) => {
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)))
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      const question = draft.trim()
      if (!question || busy) return

      const pending: Turn = { id: crypto.randomUUID(), question, state: 'processing' }
      const history = turns
      setTurns([...history, pending])
      setDraft('')
      setBusy(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: requestBody(pending),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          updateTurn(pending.id, { state: 'failed', error: messageForStatus(response.status) })
          return
        }

        let answered = false
        for await (const clinical of readClinicalEvents(response.body)) {
          if (clinical.type === 'artifact') {
            answered = true
            updateTurn(pending.id, {
              state: 'done',
              artifact: { internal: clinical.internal, client: clinical.client },
            })
          } else if (clinical.type === 'error') {
            answered = true
            updateTurn(pending.id, { state: 'failed', error: clinical.message })
          }
        }

        // A stream that closes without an artifact or an error is still a failure.
        if (!answered) {
          updateTurn(pending.id, { state: 'failed', error: 'La consulta terminó sin respuesta.' })
        }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError'
        updateTurn(pending.id, {
          state: 'failed',
          error: aborted ? 'Consulta cancelada.' : 'No se pudo conectar con el servicio.',
        })
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    },
    [busy, draft, turns, updateTurn],
  )

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Consulta clínica</h1>
        <span className={styles.user}>{userEmail}</span>
      </header>

      <div className={styles.thread}>
        {turns.length === 0 && (
          <p className={styles.empty}>
            Escribe una consulta sobre un producto, una presentación o un protocolo.
          </p>
        )}

        {turns.map((turn) => (
          <article key={turn.id} className={styles.turn}>
            <p className={styles.question}>{turn.question}</p>

            {turn.state === 'processing' && (
              <p className={styles.status} role="status">
                Procesando…
              </p>
            )}

            {turn.state === 'failed' && (
              <p className={styles.error} role="alert">
                {turn.error}
              </p>
            )}

            {turn.state === 'done' && turn.artifact && (
              <div className={styles.panels}>
                <section className={styles.panel} aria-label="Datos clínicos internos">
                  <h2 className={styles.panelTitle}>Datos internos</h2>
                  <ClinicalFacts facts={turn.artifact.internal} emptyLabel="Sin datos internos." />
                </section>

                <section className={`${styles.panel} ${styles.clientPanel}`} aria-label="Versión para el paciente">
                  <h2 className={styles.panelTitle}>Para el paciente</h2>
                  <ClinicalFacts
                    facts={turn.artifact.client}
                    emptyLabel="Ningún protocolo está autorizado para compartir con el paciente."
                  />
                  {turn.artifact.client.length > 0 && (
                    <button
                      type="button"
                      className={styles.share}
                      onClick={() => navigator.clipboard?.writeText(factsToText(turn.artifact!.client))}
                    >
                      Copiar
                    </button>
                  )}
                </section>
              </div>
            )}
          </article>
        ))}
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <input
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escribe tu consulta…"
          disabled={busy}
          aria-label="Consulta"
        />
        {busy ? (
          <button type="button" className={styles.cancel} onClick={cancel}>
            Cancelar
          </button>
        ) : (
          <button type="submit" className={styles.send} disabled={!draft.trim()}>
            Enviar
          </button>
        )}
      </form>
    </div>
  )
}
