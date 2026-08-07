## Exploration: payload-backed-clinical-agent

### Current State

`faq-agent/apps/agent` is a complete AI chat application: its client uses AI SDK `useChat` against `app/api/chat/route.ts`; the route runs an auditor/prompt/tool pipeline and streams `streamText` responses. Its four product-facing tools are `searchProducts`, `getProductDetails`, `canShareProtocol`, and `validateProductData`. Product discovery and detail retrieval currently depend on a cached JSON registry plus Markdown files. Catalog loading and cross-validation are currently disabled, so `validateProductData` is not part of the effective prompt flow.

`clinical-agent` is a Payload 3 application, not yet an AI agent. The frontend is the Payload starter page and there is no chat route, AI SDK dependency, system prompt, or agent-tool layer. Its `products` collection already holds canonical names, aliases, presentations, validation state, clinical relationships, reconstitution, and protocols. The product-PDF endpoint demonstrates an authorized Local API read (`overrideAccess: false`, `depth: 5`) and stable error mapping. Existing integration tests cover PDF projection and endpoint behavior; the generic Payload API test only fetches users.

### Affected Areas

- `src/collections/Products.ts` — product, presentation, safety, and protocol schema; it currently has no agent-specific publication or client-protocol field.
- `src/payload-types.ts` — generated typed Product and nested relationship shapes that the query boundary must consume.
- `src/payload.config.ts` — Payload initialization, Postgres adapter, and existing MCP exposure.
- `src/lib/product-pdf/endpoint.ts` — reference implementation for request-bound Local API access control and error normalization.
- `src/app/(frontend)/page.tsx` — starter homepage to replace with the chat experience.
- `tests/int/api.int.spec.ts` and `tests/int/product-pdf.int.spec.ts` — existing Payload initialization and Local API test patterns to extend.
- `faq-agent/apps/agent/app/api/chat/route.ts` — reusable streaming route shape, but not its provider configuration verbatim.
- `faq-agent/apps/agent/lib/agent/pipeline.ts` and `lib/prompts/main_agent/prompt.md` — reusable tool-first policy and safety intent that must be translated to Payload fields and contracts.
- `faq-agent/apps/agent/lib/product-utils.ts` — behavioral reference for discovery, ambiguity, detail, and protocol tool contracts; its JSON/Markdown implementation must not be copied.
- `faq-agent/apps/agent/components/` and `app/page.tsx` — source of the advanced chat UI, tool cards, thinking state, sources, feedback, metrics, and session UX.

### Porting Assessment

| Area | Decision |
| --- | --- |
| Streaming chat route and AI SDK message protocol | Port the architecture, adapting dependencies, provider configuration, environment validation, and the target App Router paths. |
| Main-agent clinical safety policy and dual-message format | Port the intent, then rewrite field-specific instructions against Payload data. The current prompt assumes Markdown headings and a JSON protocol allowlist. |
| `searchProducts` and `getProductDetails` tool names and interaction sequence | Preserve names and the discover-then-detail behavior to retain the proven UI/tool vocabulary. Change inputs to stable Payload identifiers after discovery and return typed Payload-derived DTOs. |
| `canShareProtocol` | Adapt only after a policy decision. Target schema stores protocols but has no client-shareability flag; a Markdown allowlist must not become an undocumented second source of truth. |
| Advanced UI visuals, streaming message rendering, tool cards, thinking panel, source badges | Port selectively in the UI flow. Replace Markdown/PDF-map source assumptions with Payload product metadata and the authenticated PDF endpoint contract. |
| JSON registry, Markdown reading, filename maps, catalog extraction, and static PDF mapping | Do not port. Payload is the v1 product-data source of truth. |
| Source Prisma session, feedback, metrics, and users API routes | Do not copy. They require a deliberate Payload conversation data model; local-only/stateful UI or durable history must be decided separately. |
| `validateProductData` reviewer sub-agent | Do not include in v1 by default. Its source data pair is disabled and its failure result reports no discrepancy, which is unsafe as a clinical validation signal. |
| RAG/vector retrieval | Explicitly out of scope for v1. Current product records and relationship graph support bounded Local API reads; no evidence requires semantic retrieval now. |

### Payload Local API v1 Boundary

Implement a server-only `ClinicalProductRepository` as the sole caller of `getPayload`/Payload Local API. AI tools call this repository, never `payload` directly. Define input/output DTOs with Zod at the tool boundary and derive Payload document types from `payload-types.ts`; map selected documents into small, stable tool responses rather than exposing CMS records.

| Concern | v1 boundary |
| --- | --- |
| Discovery query | Use `payload.find({ collection: 'products', where, limit, depth: 0, select })` with a strict result limit. Search canonical names and the approved alias/presentation fields only after validating supported dot-notation queries against the actual Postgres schema. Return product ID, canonical name, matching presentations, validation/publication state, and ambiguity metadata; do not return clinical detail. |
| Detail query | Accept the stable product ID from discovery plus an explicit presentation identifier/name when necessary. Use `findByID` with the minimum `select`, controlled relationship `depth`, and `populate` needed for laboratory, active ingredients, safety data, protocols, zones, routes, and techniques. The current PDF needs depth 5; the agent should prove a lower, selected depth before adopting it. |
| Type safety | Run `pnpm generate:types` for schema changes, import generated `Product`/select types, avoid `any`, and isolate normalization for populated-versus-ID relationship unions. |
| Access control | Local API defaults `overrideAccess` to `true`. A request on behalf of a logged-in employee MUST pass the real user, request, and `overrideAccess: false`; this only protects data after explicit collection read rules exist. A trusted internal service MAY use `overrideAccess: true` only behind an authenticated server route and an explicit data-publication policy. Current `Products` has no declared read policy, so the proposal must define one rather than treating the default as secure. |
| Failure behavior | Tool results must distinguish malformed input, ambiguous product/presentation, absent/inaccessible data, unapproved data, and transient CMS failures without leaking database exceptions. The HTTP route must reject invalid requests before streaming and return stable 4xx/5xx responses; the model receives a structured, safe tool error. |
| Test seams | Inject a minimal Local-API reader/repository dependency into pure mappers and tool executors. Unit/integration tests can fake it for exact query options and result mapping; a Payload integration test verifies real `where`, `select`, `depth`, access options, and error normalization. |

### Approaches

1. **Three-flow Payload-first delivery** — establish the clinical query/policy boundary, then the agent backend, then the advanced chat experience.
   - Pros: keeps clinical data safety reviewable; avoids importing Markdown and Prisma assumptions; each acceptance boundary is testable; fits the 800-line review budget through PR slices.
   - Cons: UI parity arrives after the repository and agent route.
   - Effort: High.

2. **One large source-port** — copy UI, prompt, route, and tools first, then replace filesystem reads with Payload calls.
   - Pros: earliest visual demonstration.
   - Cons: exceeds the review budget, couples unverified clinical semantics to UI work, risks copying broken/disabled source behavior, and makes rollback difficult.
   - Effort: High.

### Recommendation

Use the three-flow Payload-first delivery. Keep the source tool names and user-facing interaction model where they remain valid, but make Payload the only v1 clinical-data source through a typed repository. Do not make RAG part of this change: introduce it later only if measured recall, latency, or corpus-size evidence shows the bounded Local API approach is insufficient.

### Recommended SDD Flows

These are product/architecture flows, not a count of files or PRs. The 800-line figure is an upper review budget; individual PR slices should target roughly 400–650 changed lines.

| Flow | Scope and acceptance boundary | Dependencies | Likely affected areas | Rough change range / delivery notes |
| --- | --- | --- | --- | --- |
| 1. Payload clinical-query contract | Add the server-only typed repository and deterministic `searchProducts`/`getProductDetails`/protocol-eligibility contracts. Define approved-data, ambiguity, access, and error rules. Acceptance: Local API queries use bounded `select`/`depth`, never read Markdown, and tests prove query options plus safe result/error mapping. | Resolve publication and protocol policy questions. | `src/lib/clinical-agent/*` (new), `src/collections/Products.ts` and possibly `Protocols.ts`, generated types/migration if a policy field is added, integration tests. | ~400–650. Usually one PR; schema/access migration may be a preceding small PR slice. |
| 2. Streaming clinical-agent backend | Add AI SDK/provider dependencies, environment validation, chat route, translated prompt, audit/safety decisions, and tool registration backed only by Flow 1. Acceptance: a valid chat request streams tool-backed answers; invalid/ambiguous/unapproved/error cases have stable behavior and route/tool tests pass. | Flow 1; chosen model/provider; authenticated request model. | `src/app/api/chat/route.ts` (new), `src/lib/clinical-agent/agent/*` (new), prompt files, `package.json`, route/tool tests. | ~500–750. Split provider/bootstrap from policy/tools if forecast rises above 650. |
| 3. Advanced chat experience | Port the visual chat shell, streaming messages, tool/thinking feedback, Markdown rendering, and Payload-compatible sources. Acceptance: the target homepage drives the real chat route accessibly and renders streaming/tool states. Durable session, feedback, and metric persistence are excluded unless separately approved. | Flow 2; decision on authenticated PDF/source links. | `src/app/(frontend)/page.tsx`, new `src/components/chat/*`, styles/Tailwind and UI dependencies, component/E2E tests. | ~650–1,050. Require two PR slices: core chat/rendering first, then nonessential visual/tool/source refinements. |

If full durable history/feedback/metrics parity with `faq-agent` is required, make it a fourth, separate flow rather than hiding it in Flow 3: it needs Payload collections, retention/access rules, migrations, and its own ~500–900 changed-line forecast. A future semantic RAG retrieval experiment remains a separate later flow, with no v1 dependency.

### Proposal Questions

1. May the agent return only `APPROVED` products/presentations, or may it expose `PENDING` records with a visible internal warning? The PDF currently supports both states, but that is not an agent-publication rule.
2. Who can invoke the chat route in v1, and how will their Payload user identity/role reach the Local API? The current `Users` collection has authentication but no roles, while the frontend is unauthenticated.
3. Is the dual executive/client response still required, and does a client ever access the agent directly? This determines both authorization and prompt/tool contracts.
4. What authoritative field determines whether a protocol can be shared with a client: product, presentation, or individual protocol? No such field currently exists in Payload.
5. Should search match product aliases, presentation aliases, and partial names, and must it always stop for multiple presentations? Confirm the category-level exception used by the source prompt.
6. Is durable chat history, feedback, and usage metrics required for v1, or should the first UI release be stateless? The source implementation persists these through Prisma, which the target does not have.
7. Which AI provider/model, environment variables, rate limits, and cost/telemetry requirements are approved for the target?
8. Should source badges link to the authenticated Payload PDF endpoint, show only CMS provenance, or be omitted for v1?

### Risks

- Copying the source prompt without translating Markdown-specific instructions and the external protocol allowlist can authorize or expose clinical information incorrectly.
- Local API calls silently bypass access control unless `overrideAccess: false` is deliberately used with a real user; the target has no current chat-auth or product-read policy.
- Full source UI parity includes Prisma-backed persistence not present in the target and will exceed one reviewable PR.
- The imported clinical data may be incomplete or `PENDING`; the agent needs an explicit publication policy before it becomes a source of clinical guidance.
- The source reviewer tool is not suitable as a v1 clinical-safety control because its source pair is disabled and a runtime failure reports no discrepancy.

### Ready for Proposal

No — the architecture is ready, but the proposal must first record decisions for publication status, chat authorization, client protocol sharing, and durable conversation persistence. After those answers, start with Flow 1; do not add RAG to the proposal unless new evidence establishes a v1 requirement.
