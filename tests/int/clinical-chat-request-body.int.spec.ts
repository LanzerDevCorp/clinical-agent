import { describe, expect, it } from 'vitest'

import { createClinicalAgentRoute } from '@/app/api/chat/route'
import { requestBody, type Turn } from '@/app/(frontend)/agent/ClinicalChat'

/**
 * The client used to post the whole session. The route accepts `role: 'user'`
 * and nothing else, so the model received a list of questions with no answers
 * between them, read them as all still open, and answered every one again —
 * filling the internal panel with products nobody had just asked about and
 * exhausting the tool budget before reaching the current question.
 *
 * These tests pin the body to a single message. The last one runs it through the
 * real route, because the defect was never in the client alone: it lived in the
 * gap between what the client sent and what the route would keep.
 */

// The exact session from the report: three questions, the first two already
// answered, and BOTULAX asked last.
const previousTurns: readonly Turn[] = [
  { id: 'turn-1', question: 'ASIAN CENTELLA', state: 'done' },
  { id: 'turn-2', question: 'ARTICHOKE', state: 'done' },
]

const currentTurn: Turn = { id: 'turn-3', question: 'BOTULAX', state: 'processing' }

/** Doubles for everything the route reaches: no provider, no database, no credits. */
function routeCapturingMessages() {
  let seen: readonly unknown[] = []

  const handler = createClinicalAgentRoute({
    authenticate: async () =>
      ({ user: { id: 'internal-user', collection: 'users' }, payload: {} }) as never,
    admission: {
      acquire: async () => ({ ok: true, leaseId: 'lease-1' }),
      release: async () => ({ ok: true }),
    },
    createGateway: () => ({}) as never,
    createTools: () => ({}) as never,
    createOrchestrator: () => ({
      run: async ({
        onEvent,
        messages,
      }: {
        onEvent(event: unknown): void
        messages: readonly unknown[]
      }) => {
        seen = messages
        onEvent({ type: 'status', status: 'processing' })
        onEvent({ type: 'artifact', internal: [], client: [] })
        return { ok: true }
      },
    }),
  })

  return { POST: handler.POST, seen: () => seen }
}

describe('the body the clinical chat posts', () => {
  it('carries one message even when the session already has turns behind it', () => {
    const body = JSON.parse(requestBody(currentTurn)) as { messages: unknown[] }

    expect(body.messages).toHaveLength(1)
  })

  it('carries the current question, not an earlier one', () => {
    const body = JSON.parse(requestBody(currentTurn)) as {
      messages: { id: string; role: string; parts: { type: string; text: string }[] }[]
    }
    const [message] = body.messages

    expect(message.id).toBe('turn-3')
    expect(message.role).toBe('user')
    expect(message.parts).toEqual([{ type: 'text', text: 'BOTULAX' }])

    const everyQuestion = JSON.stringify(body)
    for (const earlier of previousTurns) {
      expect(everyQuestion).not.toContain(earlier.question)
    }
  })

  it('survives the route validator and reaches the orchestrator as a single question', async () => {
    const route = routeCapturingMessages()

    const response = await route.POST(
      new Request('https://internal.example/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://internal.example' },
        body: requestBody(currentTurn),
      }),
    )

    // A rejected body would answer 400 and never build the orchestrator, so the
    // status is what proves the shape is the one the route actually accepts.
    expect(response.status).toBe(200)
    expect(route.seen()).toHaveLength(1)
  })
})
