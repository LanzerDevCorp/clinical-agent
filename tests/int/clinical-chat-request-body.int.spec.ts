import { describe, expect, it } from 'vitest'

import { createClinicalAgentRoute } from '@/app/api/chat/route'
import { requestBody, requestBodyFromLastUser, type Turn } from '@/app/(frontend)/agent/request-body'

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

const previousTurns: readonly Turn[] = [
  { id: 'turn-1', question: 'ASIAN CENTELLA', state: 'done' },
  { id: 'turn-2', question: 'ARTICHOKE', state: 'done' },
]

const currentTurn: Turn = { id: 'turn-3', question: 'BOTULAX', state: 'processing' }

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

  it('projects only the last user message from a useChat history', () => {
    const body = JSON.parse(
      requestBodyFromLastUser([
        { id: 'turn-1', role: 'user', parts: [{ type: 'text', text: 'ASIAN CENTELLA' }] },
        { id: 'a-1', role: 'assistant', parts: [{ type: 'data-clinical' }] },
        { id: 'turn-3', role: 'user', parts: [{ type: 'text', text: 'BOTULAX' }] },
      ]),
    ) as { messages: { id: string; parts: { text: string }[] }[] }

    expect(body.messages).toHaveLength(1)
    expect(body.messages[0]?.id).toBe('turn-3')
    expect(body.messages[0]?.parts[0]?.text).toBe('BOTULAX')
    expect(JSON.stringify(body)).not.toContain('ASIAN CENTELLA')
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

    expect(response.status).toBe(200)
    expect(route.seen()).toHaveLength(1)
  })

  it('rejects the default useChat transport body so history cannot leak in', async () => {
    const route = routeCapturingMessages()

    const response = await route.POST(
      new Request('https://internal.example/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://internal.example' },
        body: JSON.stringify({
          id: 'chat-1',
          messages: [
            { id: 'turn-3', role: 'user', parts: [{ type: 'text', text: 'BOTULAX' }] },
          ],
          trigger: 'submit-message',
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(route.seen()).toHaveLength(0)
  })
})
