import { describe, expect, it } from 'vitest'

import type { ProductDetails, SafeResult } from '@/lib/clinical-agent/contracts'
import {
  clinicalAgentLimits,
  createClinicalOrchestrator,
  type ClinicalAgentEvent,
} from '@/lib/clinical-agent/agent/orchestrator'
import type { ClinicalGateway, GatewayRequest } from '@/lib/clinical-agent/agent/gateway'
import type { ClinicalFailureReport } from '@/lib/clinical-agent/agent/diagnostics'
import { createClinicalTools } from '@/lib/clinical-agent/agent/tools'

const details: ProductDetails = {
  product: {
    id: 'product-1', canonicalName: 'Clinical Product', description: 'Approved description',
    productType: 'other', laboratory: 'Laboratory',
  },
  presentation: {
    id: 'presentation-1', canonicalName: 'Presentation', characteristics: null, certifications: null,
    protocols: [
      { id: 'protocol-shareable', name: 'Shareable protocol', zones: ['Face'], routes: ['Topical'], techniques: ['Approved'] },
      { id: 'protocol-private', name: 'Private protocol', zones: ['Body'], routes: ['Injected'], techniques: ['Restricted'] },
    ],
  },
}

function fakeTimers() {
  let nextId = 0
  let nowMs = 0
  const callbacks = new Map<number, { callback: () => void; delayMs: number; dueAt: number }>()
  return {
    now: () => nowMs,
    timers: {
      setTimeout(callback: () => void, delayMs: number) {
        const id = ++nextId
        callbacks.set(id, { callback, delayMs, dueAt: nowMs + delayMs })
        return id
      },
      clearTimeout(id: number) {
        callbacks.delete(id)
      },
    },
    fire(delayMs: number) {
      for (const [id, timer] of [...callbacks]) {
        if (timer.delayMs === delayMs) {
          timer.callback()
          callbacks.delete(id)
        }
      }
    },
    advanceTo(nextMs: number) {
      nowMs = nextMs
      for (const [id, timer] of [...callbacks]) {
        if (timer.dueAt <= nowMs) {
          timer.callback()
          callbacks.delete(id)
        }
      }
    },
  }
}

function reader(results: {
  detail?: SafeResult<ProductDetails>
  share?: Record<string, SafeResult<{ shareable: boolean }>>
} = {}) {
  const calls: Array<Record<string, unknown>> = []
  return {
    calls,
    find: async (input: Record<string, unknown>) => {
      calls.push(input)
      return { docs: [], hasNextPage: false }
    },
    findByID: async (input: Record<string, unknown>) => {
      calls.push(input)
      if (!results.detail?.ok) return null
      const detail = results.detail.data
      return {
        id: detail.product.id,
        validationStatus: 'APPROVED',
        canonicalName: detail.product.canonicalName,
        description: detail.product.description,
        productType: detail.product.productType === null
          ? null
          : { id: 1, name: detail.product.productType },
        laboratory: { id: 1, name: detail.product.laboratory },
        presentations: [{
          id: detail.presentation.id,
          canonicalName: detail.presentation.canonicalName,
          status: 'activa',
          characteristics: detail.presentation.characteristics,
          certifications: detail.presentation.certifications,
          protocols: detail.presentation.protocols.map((protocol) => ({
            ...protocol,
            clientShareable: (() => {
              const decision = results.share?.[protocol.id]
              return decision?.ok ? decision.data.shareable : false
            })(),
            zones: protocol.zones.map((name) => ({ id: 1, name })),
            routes: protocol.routes.map((name) => ({ id: 1, name })),
            techniques: protocol.techniques.map((name) => ({ id: 1, name })),
          })),
        }],
      } as never
    },
  }
}

function gateway(run: (request: GatewayRequest) => AsyncIterable<unknown>): ClinicalGateway & { requests: GatewayRequest[] } {
  const requests: GatewayRequest[] = []
  return {
    requests,
    stream(request) {
      requests.push(request)
      return run(request) as ReturnType<ClinicalGateway['stream']>
    },
  }
}

async function* events(...values: unknown[]) {
  for (const value of values) yield value
}

function setup(options: {
  gateway: ClinicalGateway
  reader?: ReturnType<typeof reader>
  timers?: ReturnType<typeof fakeTimers>['timers']
  now?: () => number
  abortSignal?: AbortSignal
}): { output: ClinicalAgentEvent[]; failures: ClinicalFailureReport[]; run: () => Promise<unknown> } {
  const req = { user: { id: 'internal-user', collection: 'users' } } as never
  const tools = createClinicalTools({
    req,
    reader: options.reader as never,
    timers: options.timers,
  })
  const output: ClinicalAgentEvent[] = []
  const failures: ClinicalFailureReport[] = []
  const orchestrator = createClinicalOrchestrator({
    gateway: options.gateway,
    tools,
    now: options.now ?? (() => 0),
    timers: options.timers,
    createRequestId: () => 'opaque-request-id',
    diagnostics: { recordFailure: (report) => { failures.push(report) } },
  })
  return { output, failures, run: () => orchestrator.run({ onEvent: (event) => output.push(event), abortSignal: options.abortSignal }) }
}

describe('clinical agent typed orchestration', () => {
  it('uses the Flow-1 repository with the original request, user, and access enforcement', async () => {
    const user = { id: 'internal-user', collection: 'users' }
    const req = { user } as never
    const calls: Array<Record<string, unknown>> = []
    const tools = createClinicalTools({
      req,
      reader: {
        find: async (input: Record<string, unknown>) => {
          calls.push(input)
          return { docs: [], hasNextPage: false }
        },
        findByID: async () => null,
      } as never,
    })

    await expect(tools.searchProducts({ query: 'product' })).resolves.toEqual({ ok: true, data: { factId: 'search:0', search: { kind: 'empty' } } })
    expect(calls).toEqual([expect.objectContaining({ overrideAccess: false, req, user })])
  })

  it('does not permit injected operations to override the request-bound Flow-1 repository', async () => {
    const req = { user: { id: 'internal-user', collection: 'users' } } as never
    const bypassCalls: string[] = []
    const tools = createClinicalTools({
      req,
      reader: {
        find: async () => ({ docs: [], hasNextPage: false }),
        findByID: async () => null,
      } as never,
      operations: {
        searchProducts: async () => {
          bypassCalls.push('search')
          return { ok: false, code: 'TEMPORARY_FAILURE' as const }
        },
        getProductDetails: async () => ({ ok: false, code: 'TEMPORARY_FAILURE' as const }),
        canShareProtocol: async () => ({ ok: false, code: 'TEMPORARY_FAILURE' as const }),
      },
    } as never)

    await expect(tools.searchProducts({ query: 'product' })).resolves.toEqual({ ok: true, data: { factId: 'search:0', search: { kind: 'empty' } } })
    expect(bypassCalls).toEqual([])
  })

  it('preserves safe Flow-1 non-success outcomes without facts', async () => {
    const tools = createClinicalTools({ req: { user: { id: 'external-user', collection: 'clients' } } as never })

    await expect(tools.searchProducts({ query: 'product' })).resolves.toEqual({ ok: false, code: 'UNAUTHORIZED' })
    await expect(tools.getProductDetails({ productId: 'product-1', presentationId: 'presentation-1' })).resolves.toEqual({ ok: false, code: 'UNAUTHORIZED' })
    expect(tools.ledger.snapshot()).toEqual([])
  })

  it('renders only validated, independently allowlisted facts and prevents private protocols leaking to clients', async () => {
    const source = reader({
      detail: { ok: true, data: details },
      share: {
        'protocol-shareable': { ok: true, data: { shareable: true } },
        'protocol-private': { ok: true, data: { shareable: false } },
      },
    })
    const fakeGateway = gateway(async function* (request) {
      await request.tools.getProductDetails({ productId: 'product-1', presentationId: 'presentation-1' })
      yield { type: 'part' }
      yield {
        type: 'final', steps: 3, outputTokens: 4096,
        artifact: {
          clientFactIds: ['protocol:product-1:presentation-1:protocol-shareable'],
        },
      }
    })
    const { output, run } = setup({ gateway: fakeGateway, reader: source })

    await expect(run()).resolves.toEqual({ ok: true })
    expect(fakeGateway.requests[0]).toMatchObject({ model: 'deepseek/deepseek-v4-flash', limits: clinicalAgentLimits })
    expect(output[0]).toEqual({ type: 'status', status: 'processing' })
    const artifact = output[1] as Extract<ClinicalAgentEvent, { type: 'artifact' }>
    expect(artifact.type).toBe('artifact')

    // The details fact carries every protocol, private ones included.
    expect(JSON.stringify(artifact.internal)).toContain('Private protocol')

    // The client side is allowlisted: only shareable protocol facts, never the private one.
    expect(artifact.client.map((fact) => fact.id)).toEqual(['protocol:product-1:presentation-1:protocol-shareable'])
    expect(artifact.client.every((fact) => fact.audience === 'client' && fact.kind === 'protocol')).toBe(true)
    expect(JSON.stringify(artifact.client)).not.toContain('Private protocol')
    expect(JSON.stringify(artifact.client)).toContain('Shareable protocol')
  })

  it('rejects partial artifacts and emits no clinical content before final validation', async () => {
    const fakeGateway = gateway(() => events(
      { type: 'part' },
      { type: 'final', steps: 1, outputTokens: 1, artifact: {} },
    ))
    const { output, run, failures } = setup({ gateway: fakeGateway })

    await expect(run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(output).toEqual([
      { type: 'status', status: 'processing' },
      { type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' },
    ])
    // The opaque reference the caller sees is traceable server-side.
    expect(failures).toEqual([{
      requestId: 'opaque-request-id',
      reason: 'INVALID_ARTIFACT',
      attempts: 1,
      toolLimitExceeded: false,
      ledgerFactIds: [],
      requestedClientFactIds: undefined,
    }])
  })

  it('enforces exact execution, detail, and token limits without network waits', async () => {
    const source = reader({ detail: { ok: true, data: details } })
    const fakeGateway = gateway(async function* (request) {
      for (let index = 0; index < 4; index += 1) {
        await request.tools.getProductDetails({ productId: 'product-1', presentationId: 'presentation-1' })
      }
      yield { type: 'part' }
      yield {
        type: 'final', steps: 12, outputTokens: 4096,
        artifact: { clientFactIds: [] },
      }
    })
    const { run } = setup({ gateway: fakeGateway, reader: source })
    await expect(run()).resolves.toEqual({ ok: true })

    const overLimitGateway = gateway(async function* (request) {
      for (let index = 0; index < 5; index += 1) {
        await request.tools.getProductDetails({ productId: 'product-1', presentationId: 'presentation-1' })
      }
      yield { type: 'final', steps: 12, outputTokens: 4096, artifact: { clientFactIds: [] } }
    })
    const rejected = setup({ gateway: overLimitGateway, reader: source })
    await expect(rejected.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(rejected.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])

    const toolLimitGateway = gateway(async function* (request) {
      for (let index = 0; index < 9; index += 1) await request.tools.searchProducts({ query: 'product' })
      yield { type: 'final', steps: 12, outputTokens: 4096, artifact: { clientFactIds: [] } }
    })
    const toolRejected = setup({ gateway: toolLimitGateway, reader: reader() })
    await expect(toolRejected.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    // Asserts the nine-tool-call run itself: exceeding the budget fails the request
    // rather than emitting an artifact. Previously this read an earlier setup's output.
    expect(toolRejected.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])
  })

  it('rejects non-compliant final artifacts that report 13 steps or 4097 output tokens', async () => {
    const tooManySteps = setup({
      gateway: gateway(() => events({
        type: 'final', steps: 13, outputTokens: 1, artifact: { clientFactIds: [] },
      })),
    })
    await expect(tooManySteps.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(tooManySteps.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])

    const tooManyTokens = setup({
      gateway: gateway(() => events({
        type: 'final', steps: 1, outputTokens: 4097, artifact: { clientFactIds: [] },
      })),
    })
    await expect(tooManyTokens.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(tooManyTokens.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])
  })

  it('returns structured temporary failure on tool, first-part, total, and cancellation deadlines', async () => {
    const toolClock = fakeTimers()
    const tools = createClinicalTools({
      req: { user: { id: 'internal-user', collection: 'users' } } as never,
      reader: {
        find: async () => ({ docs: [], hasNextPage: false }),
        findByID: () => new Promise(() => undefined),
      } as never,
      timers: toolClock.timers,
    })
    const pendingTool = tools.getProductDetails({ productId: 'product-1', presentationId: 'presentation-1' })
    toolClock.fire(30_000)
    await expect(pendingTool).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })

    const firstPartClock = fakeTimers()
    const firstPart = setup({
      gateway: gateway(async function* () {
        await new Promise(() => undefined)
      }),
      timers: firstPartClock.timers,
    })
    const pendingFirstPart = firstPart.run()
    firstPartClock.fire(45_000)
    await expect(pendingFirstPart).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(firstPart.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])

    const totalClock = fakeTimers()
    const totalDeadline = setup({
      gateway: gateway(async function* () {
        yield { type: 'part' }
        await new Promise(() => undefined)
      }),
      timers: totalClock.timers,
    })
    const pendingTotal = totalDeadline.run()
    await new Promise<void>((resolve) => setImmediate(resolve))
    totalClock.fire(150_000)
    await expect(pendingTotal).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(totalDeadline.output).toEqual([
      { type: 'status', status: 'processing' },
      { type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' },
    ])

    const abortController = new AbortController()
    abortController.abort()
    const cancelled = setup({ gateway: gateway(() => events({ type: 'part' })), abortSignal: abortController.signal })
    await expect(cancelled.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
  })

  it('terminates an in-flight non-cooperative gateway immediately on external cancellation', async () => {
    let resolveNextStarted: (() => void) | undefined
    const nextStarted = new Promise<void>((resolve) => { resolveNextStarted = resolve })
    let iteratorReturned = false
    const abortController = new AbortController()
    const nonCooperativeGateway = gateway(() => ({
      [Symbol.asyncIterator]() {
        return {
          next: () => {
            resolveNextStarted?.()
            return new Promise<IteratorResult<never>>(() => undefined)
          },
          return: () => {
            iteratorReturned = true
            return Promise.resolve({ done: true, value: undefined })
          },
        }
      },
    }))
    const cancelled = setup({ gateway: nonCooperativeGateway, abortSignal: abortController.signal })

    const pending = cancelled.run()
    await nextStarted
    abortController.abort()
    await expect(pending).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(iteratorReturned).toBe(true)
    expect(cancelled.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])
  })

  it('retries exactly once only for retryable failures before the first provider part', async () => {
    let attempts = 0
    const transientGateway = gateway((request) => (async function* () {
      attempts += 1
      if (attempts === 1) throw { retryable: true }
      await request.tools.searchProducts({ query: 'product' })
      yield { type: 'part' }
      yield { type: 'final', steps: 1, outputTokens: 1, artifact: { clientFactIds: [] } }
    })())
    const transient = setup({ gateway: transientGateway, reader: reader() })
    await expect(transient.run()).resolves.toEqual({ ok: true })
    expect(attempts).toBe(2)

    const permanentGateway = gateway(() => { throw { retryable: false } })
    const permanent = setup({ gateway: permanentGateway })
    await expect(permanent.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(permanentGateway.requests).toHaveLength(1)

    let postStartAttempts = 0
    const postStartGateway = gateway(async function* () {
      postStartAttempts += 1
      yield { type: 'part' }
      throw { retryable: true }
    })
    const postStart = setup({ gateway: postStartGateway })
    await expect(postStart.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(postStartAttempts).toBe(1)
  })

  it('enforces the first-part deadline across the optional retry', async () => {
    const clock = fakeTimers()
    let attempts = 0
    const delayedRetry = gateway(async function* () {
      attempts += 1
      if (attempts === 1) {
        clock.advanceTo(44_000)
        throw { retryable: true }
      }
      clock.advanceTo(80_000)
      yield { type: 'part' }
      yield { type: 'final', steps: 1, outputTokens: 1, artifact: { clientFactIds: [] } }
    })
    const delayed = setup({ gateway: delayedRetry, timers: clock.timers, now: clock.now })

    await expect(delayed.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(attempts).toBe(2)
    expect(delayed.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])
  })

  it('returns a safe structured failure after two retryable pre-stream failures', async () => {
    let attempts = 0
    const exhaustedGateway = gateway(() => {
      attempts += 1
      throw { retryable: true, providerDetail: `private-provider-detail-${attempts}` }
    })
    const exhausted = setup({ gateway: exhaustedGateway })

    await expect(exhausted.run()).resolves.toEqual({ ok: false, code: 'TEMPORARY_FAILURE' })
    expect(attempts).toBe(2)
    expect(exhausted.output).toEqual([{ type: 'error', message: 'Unable to complete the clinical response. Reference: opaque-request-id' }])
    expect(JSON.stringify(exhausted.output)).not.toContain('private-provider-detail')
  })
})
