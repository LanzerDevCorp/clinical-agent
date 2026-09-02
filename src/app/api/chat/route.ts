import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { createPayloadRequest, type PayloadRequest } from 'payload'

import config from '@/payload.config'
import { createPostgresAdmission, type AdmissionResult, type ReleaseResult } from '@/lib/clinical-agent/agent/admission'
import type { ClinicalAgentEvent } from '@/lib/clinical-agent/agent/contracts'
import { createAiSdkClinicalGateway, type ClinicalGateway, type ClinicalUserMessage } from '@/lib/clinical-agent/agent/gateway'
import { createClinicalOrchestrator } from '@/lib/clinical-agent/agent/orchestrator'
import { createClinicalTools } from '@/lib/clinical-agent/agent/tools'

export const runtime = 'nodejs'
export const maxDuration = 180

const MAX_BODY_BYTES = 256 * 1024
const MAX_MESSAGES = 40

type AdmissionService = {
  acquire(subjectId: string): Promise<AdmissionResult>
  release(leaseId: string): Promise<ReleaseResult>
}

type RouteOrchestrator = {
  run(options: {
    onEvent(event: ClinicalAgentEvent): void
    abortSignal?: AbortSignal
    messages: readonly ClinicalUserMessage[]
  }): Promise<unknown>
}

type RouteDependencies = {
  authenticate?(request: Request): Promise<PayloadRequest | null>
  admission?: AdmissionService
  createGateway?(): ClinicalGateway
  createTools?(options: { req: PayloadRequest }): ReturnType<typeof createClinicalTools>
  createOrchestrator?(options: {
    gateway: ClinicalGateway
    tools: ReturnType<typeof createClinicalTools>
  }): RouteOrchestrator
}

type RouteUIMessage = UIMessage<never, { clinical: ClinicalAgentEvent }>

class InputError extends Error {
  constructor(readonly status: 400 | 413 | 415) {
    super('Invalid request')
  }
}

function denied(status: number): Response {
  return Response.json({ error: 'Request unavailable.' }, { status })
}

function isInternalRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  return origin === new URL(request.url).origin
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key))
}

function isClinicalUserMessage(value: unknown): value is ClinicalUserMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return hasExactKeys(message, ['id', 'role', 'parts'])
    && typeof message.id === 'string'
    && message.id.length > 0
    && message.role === 'user'
    && Array.isArray(message.parts)
    && message.parts.length > 0
    && message.parts.every((part) => (
      Boolean(part)
      && typeof part === 'object'
      && hasExactKeys(part as Record<string, unknown>, ['type', 'text'])
      && (part as Record<string, unknown>).type === 'text'
      && typeof (part as Record<string, unknown>).text === 'string'
      && (part as { text: string }).text.length > 0
    ))
}

async function readMessages(request: Request): Promise<ClinicalUserMessage[]> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new InputError(415)
  if (!request.body) throw new InputError(400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new InputError(413)
      }
      chunks.push(next.value)
    }
  } catch (error) {
    if (error instanceof InputError) throw error
    throw new InputError(400)
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new InputError(400)
  }
  if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || !Array.isArray((body as { messages?: unknown }).messages)) throw new InputError(400)
  const messages = (body as { messages: unknown[] }).messages
  if (messages.length > MAX_MESSAGES || !messages.every(isClinicalUserMessage)) throw new InputError(400)
  return messages
}

async function authenticate(request: Request): Promise<PayloadRequest | null> {
  const payloadRequest = await createPayloadRequest({ config, request })
  return payloadRequest.user?.collection === 'users' ? payloadRequest : null
}

function admissionForRequest(req: PayloadRequest): AdmissionService | undefined {
  const pool = (req.payload.db as typeof req.payload.db & { pool?: Parameters<typeof createPostgresAdmission>[0]['pool'] }).pool
  if (!pool) return undefined
  return createPostgresAdmission({ pool, secret: process.env.ADMISSION_HASH_SECRET })
}

export function createClinicalAgentRoute(dependencies: RouteDependencies = {}) {
  const authenticateRequest = dependencies.authenticate ?? authenticate
  const createGateway = dependencies.createGateway ?? createAiSdkClinicalGateway
  const createTools = dependencies.createTools ?? createClinicalTools
  const createOrchestrator = dependencies.createOrchestrator ?? createClinicalOrchestrator

  return {
    async POST(request: Request): Promise<Response> {
      if (!isInternalRequest(request)) return denied(403)
      let req: PayloadRequest | null
      try {
        req = await authenticateRequest(request)
      } catch {
        return denied(401)
      }
      if (!req?.user?.id) return denied(401)
      // AgentPage already redirects a temporary-password session away from the
      // chat; this is the same rule enforced again for a direct call to the route.
      if (req.user.collection === 'users' && req.user.mustChangePassword) return denied(403)
      const admission = dependencies.admission ?? admissionForRequest(req)
      if (!admission) return denied(503)
      let admitted: AdmissionResult
      try {
        admitted = await admission.acquire(String(req.user.id))
      } catch {
        return denied(503)
      }
      if (!admitted.ok) return denied(admitted.code === 'UNAVAILABLE' ? 503 : 429)

      let released = false
      const release = async () => {
        if (released) return
        released = true
        await admission.release(admitted.leaseId).catch(() => undefined)
      }
      let messages: ClinicalUserMessage[]
      try {
        messages = await readMessages(request)
      } catch (error) {
        await release()
        return denied(error instanceof InputError ? error.status : 400)
      }
      let orchestrator: RouteOrchestrator
      try {
        const gateway = createGateway()
        const tools = createTools({ req })
        orchestrator = createOrchestrator({ gateway, tools })
      } catch {
        await release()
        return denied(503)
      }
      const stream = createUIMessageStream<RouteUIMessage>({
        execute: async ({ writer }) => {
          try {
            await orchestrator.run({
              messages,
              abortSignal: request.signal,
              onEvent: (event) => writer.write({ type: 'data-clinical', data: event }),
            })
          } catch {
            writer.write({
              type: 'data-clinical',
              data: { type: 'error', message: `Unable to complete the clinical response. Reference: ${crypto.randomUUID()}` },
            })
          } finally {
            await release()
          }
        },
      })
      return createUIMessageStreamResponse({ stream })
    },
  }
}

export const POST = createClinicalAgentRoute().POST
