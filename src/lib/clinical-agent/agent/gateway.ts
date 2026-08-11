import { Output, gateway, stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'

import type { ClinicalArtifact, ClinicalToolset } from './contracts'

// Requires native JSON-schema structured output: `Output.object` below constrains
// the artifact, and a model without it satisfies the schema only intermittently.
export const clinicalAgentModel = 'deepseek/deepseek-v4-flash' as const

export type GatewayRequest = {
  model: typeof clinicalAgentModel
  prompt: string
  messages: readonly ClinicalUserMessage[]
  tools: ClinicalToolset
  limits: {
    maxOutputTokens: number
    maxSteps: number
    maxToolCalls: number
    maxDetailCalls: number
  }
  abortSignal: AbortSignal
}

export type ClinicalUserMessage = {
  id: string
  role: 'user'
  parts: readonly { type: 'text'; text: string }[]
}

export type GatewayPart =
  | { type: 'part' }
  | { type: 'final'; artifact: ClinicalArtifact | unknown; steps: number; outputTokens: number }

export type ClinicalGateway = {
  stream(request: GatewayRequest): AsyncIterable<GatewayPart>
}

type AiSdkStreamResult = {
  fullStream: AsyncIterable<unknown>
  output: PromiseLike<unknown>
  steps: PromiseLike<unknown[]>
  totalUsage: PromiseLike<{ outputTokens?: number }>
}

type AiSdkGatewayDependencies = {
  model(modelId: string): unknown
  streamText(options: Record<string, unknown>): AiSdkStreamResult
}

const artifactSchema = z.object({
  internalFactIds: z.array(z.string()),
  clientFactIds: z.array(z.string()),
})

const productIdSchema = z.union([z.string().min(1), z.number()])

function createAiSdkTools(tools: ClinicalToolset) {
  return {
    searchProducts: tool({
      description: 'Search the approved clinical product registry.',
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: ({ query }) => tools.searchProducts({ query }),
    }),
    getProductDetails: tool({
      description:
        'Load approved details for one explicit product presentation. Returns `factId` for the details, and'
        + ' `clientShareableProtocols` listing every protocol authorized for sharing with its own `factId`.',
      inputSchema: z.object({ productId: productIdSchema, presentationId: z.string().min(1) }),
      execute: ({ productId, presentationId }) => tools.getProductDetails({ productId, presentationId }),
    }),
  }
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { isRetryable?: unknown; retryable?: unknown }
  return candidate.isRetryable === true || candidate.retryable === true
}

function defaultAiSdkGatewayDependencies(): AiSdkGatewayDependencies {
  return {
    model: gateway,
    streamText: (options) => streamText(options as never) as unknown as AiSdkStreamResult,
  }
}

export function createAiSdkClinicalGateway(dependencies = defaultAiSdkGatewayDependencies()): ClinicalGateway {
  return {
    async *stream(request) {
      try {
        const result = dependencies.streamText({
          model: dependencies.model(request.model),
          system: request.prompt,
          messages: request.messages.map((message) => ({
            role: 'user',
            content: message.parts.map((part) => part.text).join('\n'),
          })),
          tools: createAiSdkTools(request.tools),
          output: Output.object({ schema: artifactSchema }),
          stopWhen: stepCountIs(request.limits.maxSteps),
          maxOutputTokens: request.limits.maxOutputTokens,
          maxRetries: 0,
          abortSignal: request.abortSignal,
        })
        let receivedProviderPart = false
        for await (const _part of result.fullStream) {
          if (!receivedProviderPart) {
            receivedProviderPart = true
            yield { type: 'part' }
          }
        }
        const [artifact, steps, usage] = await Promise.all([result.output, result.steps, result.totalUsage])
        yield {
          type: 'final',
          artifact,
          steps: steps.length,
          outputTokens: usage.outputTokens ?? 0,
        }
      } catch (error) {
        throw { retryable: isRetryableProviderFailure(error) }
      }
    },
  }
}

export function isRetryableGatewayFailure(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && error.retryable === true)
}
