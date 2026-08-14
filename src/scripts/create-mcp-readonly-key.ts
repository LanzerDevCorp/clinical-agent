/**
 * Issue a read-only MCP API key against the local database.
 *
 * The Payload MCP server is meant for one job in this project: answering
 * questions about the catalogue while a loaded batch is being reviewed — "is
 * there anything like this contraindication already?", "which products use this
 * ingredient?". Reading is all that job needs, so the key it uses should not be
 * able to write.
 *
 * That is enforceable per key, not only per config. The permission matrix in
 * payload.config.ts is the ceiling; every checkbox on an individual key defaults
 * to false (plugin-mcp's createApiKeyFields sets defaultValue: false), so a key
 * grants nothing until something is ticked. This script ticks `find` on the
 * catalogue collections and nothing else — no create, no update, and no access
 * to `users` at all.
 *
 *   pnpm db:local:mcp-key            print the key, creating it if absent
 *   pnpm db:local:mcp-key --rotate   replace it with a fresh one
 *
 * Local only. payload.config.ts refuses to start against a non-local
 * DATABASE_URL, so this cannot be pointed at production by accident — and it
 * should not be: production keys are issued from the production admin.
 */
import { randomUUID } from 'crypto'
import { getPayload } from 'payload'
import configPromise from '../payload.config'

/** Collections the reviewer may read. `users` is deliberately absent. */
const READABLE = [
  'media',
  'laboratories',
  'activeIngredients',
  'applicationZones',
  'administrationRoutes',
  'applicationTechniques',
  'contraindications',
  'adverseEffects',
  'clinicalIndications',
  'postCareNotes',
  'safetyWarnings',
  'protocols',
  'products',
] as const

const LABEL = 'Revisión de lote (solo lectura)'

const DESCRIPTION =
  'Read-only key for reviewing a loaded batch through the MCP server. ' +
  'Grants find on the catalogue collections; no create, no update, no users.'

/** `{ contraindications: { find: true }, … }` — every other operation stays false. */
const findOnlyGrants = () =>
  Object.fromEntries(READABLE.map((slug) => [slug, { find: true }]))

async function run() {
  const rotate = process.argv.includes('--rotate')
  const payload = await getPayload({ config: configPromise })

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'dev@local.test'
  const owner = await payload.find({
    collection: 'users',
    where: { email: { equals: adminEmail } },
    limit: 1,
  })

  const user = owner.docs[0]
  if (!user) {
    throw new Error(
      `No user with email "${adminEmail}" exists, and an MCP key must belong to one.\n` +
        'Run `pnpm db:local:seed` first, or set SEED_ADMIN_EMAIL to an account that exists.',
    )
  }

  const existing = await payload.find({
    collection: 'payload-mcp-api-keys',
    where: { label: { equals: LABEL } },
    limit: 1,
  })

  const current = existing.docs[0]

  // Payload stores the key encrypted and hands it back on read, so an existing
  // key can be reported rather than silently replaced. Replacing it would break
  // whatever is already configured with it, which is not a thing to do by default.
  if (current && !rotate) {
    report(String(current.apiKey), 'ya existía')
    return
  }

  const apiKey = randomUUID()
  const data = {
    user: user.id,
    label: LABEL,
    description: DESCRIPTION,
    enableAPIKey: true,
    apiKey,
    ...findOnlyGrants(),
  }

  if (current) {
    await payload.update({ collection: 'payload-mcp-api-keys', id: current.id, data })
    report(apiKey, 'rotada')
    return
  }

  await payload.create({ collection: 'payload-mcp-api-keys', data })
  report(apiKey, 'creada')
}

function report(apiKey: string, what: string) {
  const readable = READABLE.length
  process.stdout.write(
    `\nKey ${what}: ${LABEL}\n` +
      `  find en ${readable} colecciones · sin create · sin update · sin users\n\n` +
      `  ${apiKey}\n\n` +
      'Pegala en .claude/settings.local.json (que está gitignoreado):\n\n' +
      `  { "env": { "PAYLOAD_MCP_KEY": "${apiKey}" } }\n\n` +
      'El servidor queda en .mcp.json y necesita `pnpm dev` corriendo.\n\n',
  )
}

await run()
process.exit(0)
