import { gateway, stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'

import type { ClinicalArtifact, ClinicalToolset } from './contracts'

// This model has tool calling but no native JSON-schema response format, so the
// artifact is collected through a dedicated tool rather than `Output.object`:
// tool inputs are schema-validated by the provider, response formats are not.
export const clinicalAgentModel = 'deepseek/deepseek-v4-flash' as const

/** The tool the model must call to deliver its answer. */
export const SUBMIT_ARTIFACT_TOOL = 'submitClinicalArtifact' as const

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
  steps: PromiseLike<unknown[]>
  totalUsage: PromiseLike<{ outputTokens?: number }>
}

type AiSdkGatewayDependencies = {
  model(modelId: string): unknown
  streamText(options: Record<string, unknown>): AiSdkStreamResult
}

const artifactSchema = z.object({
  clientFactIds: z.array(z.string()),
  internalFactIds: z.array(z.string()).optional(),
})

const productIdSchema = z.union([z.string().min(1), z.number()])

function createAiSdkTools(tools: ClinicalToolset) {
  return {
    searchProducts: tool({
      description:
        'Search the approved clinical product registry. `query` is matched as a literal'
        + ' substring against product and presentation names and their aliases, so pass a'
        + ' product name or a single distinctive term — not a sentence.',
      inputSchema: z.object({ query: z.string().min(1) }),
      execute: ({ query }) => tools.searchProducts({ query }),
    }),
    getProductDetails: tool({
      description:
        'Load approved details for one explicit product presentation. Returns `fields`: one entry per'
        + ' field group actually present on the sheet (identity, clinicalIndications, presentationInfo,'
        + ' contraindications, adverseEffects, postCareNotes, safetyWarnings, reconstitution, protocols),'
        + ' each with its own `factId` and `clientEligible`. Also returns `clientShareableProtocols` listing'
        + ' every protocol authorized for sharing with its own `factId`.',
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
        // Only the last submission counts, and an absent one leaves this undefined so
        // artifact validation rejects the run instead of reporting an empty success.
        let submitted: unknown
        const result = dependencies.streamText({
          model: dependencies.model(request.model),
          system: request.prompt,
          messages: request.messages.map((message) => ({
            role: 'user',
            content: message.parts.map((part) => part.text).join('\n'),
          })),
          tools: {
            ...createAiSdkTools(request.tools),
            [SUBMIT_ARTIFACT_TOOL]: tool({
              description:
                'Deliver the final answer. Call this exactly once, last.'
                + ' clientFactIds: factId values that are safe to show the patient — from'
                + ' clientShareableProtocols, or from any `fields` entry with clientEligible: true,'
                + ' or a listing-question search factId. Empty array if none apply. Copy ids verbatim,'
                + ' never invent one.'
                + ' internalFactIds: leave unset for a broad/generic question — everything you looked up'
                + ' is then shown automatically. Set it only when the question named one or a few specific'
                + ' fields, to exactly those factId values, so the vendor sees only what was asked.',
              inputSchema: artifactSchema,
              execute: async (input) => {
                submitted = input
                return { received: true }
              },
            }),
          },
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
        const [steps, usage] = await Promise.all([result.steps, result.totalUsage])
        yield {
          type: 'final',
          artifact: submitted,
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
