export const GATEWAY_MODEL_CATALOG_URL = 'https://ai-gateway.vercel.sh/v1/models'
export const GATEWAY_MODEL_ID = 'openai/gpt-4o-mini'

type PreflightTimers = {
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(timer: unknown): void
}

type PreflightOptions = {
  fetch?: typeof globalThis.fetch
  timers?: PreflightTimers
  timeoutMs?: number
}

function isVerifiedCatalog(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { data?: unknown }).data)) return false
  return (value as { data: unknown[] }).data.some((entry) => (
    Boolean(entry) && typeof entry === 'object' && (entry as { id?: unknown }).id === GATEWAY_MODEL_ID
  ))
}

export async function runGatewayModelPreflight({
  fetch: fetchCatalog = globalThis.fetch,
  timers = { setTimeout, clearTimeout },
  timeoutMs = 5_000,
}: PreflightOptions = {}): Promise<boolean> {
  const controller = new AbortController()
  const timeout = timers.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchCatalog(GATEWAY_MODEL_CATALOG_URL, { signal: controller.signal })
    if (!response.ok) return false
    return isVerifiedCatalog(await response.json())
  } catch {
    return false
  } finally {
    timers.clearTimeout(timeout)
  }
}

async function main(): Promise<void> {
  if (!await runGatewayModelPreflight()) process.exitCode = 1
}

if (process.argv[1]?.endsWith('check-gateway-model.ts')) void main()
