import type { ClinicalArtifact, ClinicalToolset } from './contracts'

export const clinicalAgentModel = 'deepseek/deepseek-v4-flash' as const

export type GatewayRequest = {
  model: typeof clinicalAgentModel
  prompt: string
  tools: ClinicalToolset
  limits: {
    maxOutputTokens: number
    maxSteps: number
    maxToolCalls: number
    maxDetailCalls: number
  }
  abortSignal: AbortSignal
}

export type GatewayPart =
  | { type: 'part' }
  | { type: 'final'; artifact: ClinicalArtifact | unknown; steps: number; outputTokens: number }

export type ClinicalGateway = {
  stream(request: GatewayRequest): AsyncIterable<GatewayPart>
}

export function isRetryableGatewayFailure(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && error.retryable === true)
}
