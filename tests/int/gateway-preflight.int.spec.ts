import { describe, expect, it } from 'vitest'

import { createAiSdkClinicalGateway, SUBMIT_ARTIFACT_TOOL } from '@/lib/clinical-agent/agent/gateway'
import { GATEWAY_MODEL_CATALOG_URL, runGatewayModelPreflight } from '@/scripts/check-gateway-model'

describe('AI Gateway adapter', () => {
  it('uses only the fixed model with zero provider retries, forwarding cancellation, tools, and only the completed structured artifact', async () => {
    const calls: Array<Record<string, unknown>> = []
    const adapter = createAiSdkClinicalGateway({
      model: (id) => ({ id }),
      streamText: (options) => {
        calls.push(options as Record<string, unknown>)
        const submit = (options.tools as Record<string, { execute(input: unknown): Promise<unknown> }>)[SUBMIT_ARTIFACT_TOOL]
        return {
          // The model streams text, then delivers its answer through the tool.
          fullStream: (async function* () {
            yield { type: 'text-delta', text: 'unvalidated content' }
            await submit.execute({ internalFactIds: ['search:0'], clientFactIds: [] })
          })(),
          steps: Promise.resolve([{}]),
          totalUsage: Promise.resolve({ outputTokens: 1 }),
        }
      },
    })
    const abortController = new AbortController()
    const gatewayStream = adapter.stream({
      model: 'deepseek/deepseek-v4-flash',
      prompt: 'safe system prompt',
      messages: [{ id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'Question' }] }],
      tools: {
        searchProducts: async () => ({ ok: true, data: { factId: 'search:0', search: { kind: 'empty' } } }),
        getProductDetails: async () => ({ ok: false, code: 'UNAVAILABLE' }),
      },
      limits: { maxOutputTokens: 4096, maxSteps: 12, maxToolCalls: 8, maxDetailCalls: 4 },
      abortSignal: abortController.signal,
    })[Symbol.asyncIterator]()

    expect(await gatewayStream.next()).toEqual({ done: false, value: { type: 'part' } })
    // The artifact is only what the submit tool received, never streamed text.
    await expect(gatewayStream.next()).resolves.toEqual({
      done: false,
      value: {
        type: 'final',
        artifact: { internalFactIds: ['search:0'], clientFactIds: [] },
        steps: 1,
        outputTokens: 1,
      },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].output).toBeUndefined()
    expect(calls[0]).toMatchObject({
      model: { id: 'deepseek/deepseek-v4-flash' },
      system: 'safe system prompt',
      maxOutputTokens: 4096,
      maxRetries: 0,
      abortSignal: abortController.signal,
    })
    expect(calls[0].tools).toEqual(expect.objectContaining({
      searchProducts: expect.any(Object),
      getProductDetails: expect.any(Object),
      [SUBMIT_ARTIFACT_TOOL]: expect.any(Object),
    }))
    expect(calls[0].messages).toEqual([{ role: 'user', content: 'Question' }])
  })
})

describe('gateway catalog preflight', () => {
  it('accepts only a verified exact catalog entry and makes no fallback request', async () => {
    const requests: string[] = []
    const result = await runGatewayModelPreflight({
      fetch: async (input) => {
        requests.push(String(input))
        return new Response(JSON.stringify({ data: [{ id: 'deepseek/deepseek-v4-flash' }] }), { status: 200 })
      },
    })

    expect(result).toBe(true)
    expect(requests).toEqual([GATEWAY_MODEL_CATALOG_URL])
  })

  it.each([
    ['absent', async () => new Response(JSON.stringify({ data: [{ id: 'deepseek/other' }] }), { status: 200 })],
    ['malformed', async () => new Response(JSON.stringify({ models: [] }), { status: 200 })],
    ['unauthorized', async () => new Response('denied', { status: 401 })],
    ['network failure', async () => { throw new Error('network failure') }],
  ])('fails closed when the catalog is %s', async (_case, fetch) => {
    await expect(runGatewayModelPreflight({ fetch })).resolves.toBe(false)
  })

  it('fails closed on a deterministic timeout without logging raw catalog responses or credentials', async () => {
    let timeout: (() => void) | undefined
    const result = runGatewayModelPreflight({
      fetch: async (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('timed out')))),
      timers: {
        setTimeout: (callback) => {
          timeout = callback
          return 1
        },
        clearTimeout: () => undefined,
      },
    })
    timeout?.()
    await expect(result).resolves.toBe(false)
  })
})
