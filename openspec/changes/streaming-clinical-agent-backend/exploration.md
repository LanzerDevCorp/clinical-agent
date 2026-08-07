## Exploration: streaming-clinical-agent-backend

### Current State
Flow 1 is implemented: `src/lib/clinical-agent` is a server-only, request-bound Payload boundary with deterministic discovery, bounded details, per-protocol shareability, and `UNAUTHORIZED`, `INVALID_REQUEST`, `UNAVAILABLE`, and `TEMPORARY_FAILURE` outcomes. It requires a real authenticated Payload `users` request and uses `overrideAccess: false`; no chat route currently creates or forwards that identity.

The target has no AI SDK, provider SDK, Zod, prompt/auditor pipeline, chat route, or route tests. Its authoritative package metadata is Next 16.2.6, React 19.2.6, Payload 3.85.1, Vitest 4, and Playwright.

`faq-agent/apps/agent` provides a useful shape, not a direct port: its unauthenticated `POST /api/chat` converts `UIMessage`s, runs an LLM auditor, then calls AI SDK 6 `streamText` through AI Gateway with a 15-step limit. It returns an AI SDK UI-message stream and usage metadata. Its dual executive/client response is prompt-enforced text, not a typed response contract. It has pipeline/product utility tests but no covering chat-route or pipeline tests.

| Concern | Flow 2 reuse decision |
| --- | --- |
| Provider and streaming structure | Recreate with AI SDK 6 after selecting the approved provider/model and explicit limits. |
| Tool vocabulary | Register Flow-1 `searchProducts`, `getProductDetails`, and `canShareProtocol`; use Flow-1 stable input/output contracts rather than source filesystem helpers. |
| Prompt and auditor intent | Translate clinical boundaries, emergency escalation, discovery-first behavior, ambiguity stops, protocol audience controls, and dual answer requirements to Payload DTOs. |
| Error handling | Keep Flow-1 errors structured for the model; map malformed HTTP input, unauthenticated callers, and stream/provider failures to a stable route contract without internal details. |
| Source-only behavior | Do not copy JSON registry/allowlist, Markdown reads or section extraction, disabled catalog cross-validation, raw-PII logging, Prisma sessions/feedback/metrics, or UI code. |

Flow 1's lifecycle closure is **not a hard technical dependency**: its implemented contract and 56 passing integration tests are usable. The unresolved `sdd-verify`/archive native-gate defect remains a governance and audit dependency; it should be recorded but must not force Flow 2 to wait for code that already exists. A separate functional dependency remains: its current `ProductDetails` DTO exposes description, type, characteristics, certifications, and protocol summaries, but not many source-prompt fields (for example contraindications, reconstitution, and safety warnings). Proposal must either limit Flow 2 answers to that contract or explicitly authorize a bounded Flow-1 contract extension.

### Affected Areas
- `package.json`, `pnpm-lock.yaml` — add AI SDK 6, the selected provider package, and runtime validation support; the source's gateway package is not an approved default.
- `src/app/api/chat/route.ts` — new authenticated streaming route with request parsing, identity resolution, safe HTTP failures, and the AI SDK response adapter.
- `src/lib/clinical-agent/agent/*` — new server-only environment schema, request-to-repository adapter, bounded tool registration, auditor/prompt pipeline, response policy, and telemetry seam.
- `src/lib/clinical-agent/contracts.ts`, `repository.ts` — consume unchanged Flow-1 contracts; modify only if a proposal explicitly expands the clinically safe detail DTO.
- `src/access/internalUsersOnly.ts`, `src/collections/Users.ts` — current users-only check and role-less auth model constrain chat authorization and identity propagation.
- `tests/int/clinical-product-repository.int.spec.ts`, `tests/int/clinical-product-query-postgres.int.spec.ts` — retain as Flow-1 contract regression coverage while tools are wired.
- `tests/int/chat-route.int.spec.ts` and `tests/int/clinical-agent-pipeline.int.spec.ts` — new TDD coverage for authentication, parsing, tool wiring, safe failures, prompt policy, and provider seams; add E2E only for the HTTP stream contract, not UI.
- `faq-agent/apps/agent/app/api/chat/route.ts`, `lib/agent/pipeline.ts`, and prompt files — behavioral reference only; its route does not authenticate, validates neither request shape nor limits, and logs raw redacted/original PII.

### Approaches
1. **Authenticated Payload-first route with a provider adapter** — Authenticate the Next request before parsing/model work, construct the Flow-1 repository from that identity, inject provider/auditor clients, and stream only AI-SDK UI messages.
   - Pros: preserves per-user Payload access; isolates provider/model changes; makes route, tool, and failure tests deterministic; prevents direct external client access by default.
   - Cons: requires explicit provider/model, session-to-Payload-request, auditor, and observability decisions before implementation.
   - Effort: Medium.

2. **Direct source-route port through AI Gateway** — Copy the source pipeline and replace product helper calls.
   - Pros: fastest apparent parity with the source stream shape.
   - Cons: imports unauthenticated access, weak request validation, raw-PII logging, hidden LLM-auditor cost/latency, Markdown assumptions, and untyped dual-response parsing; it also leaves provider policy implicit.
   - Effort: Medium initially, High to make clinically safe.

### Recommendation
Use the authenticated Payload-first route with a provider adapter. Keep all Flow-1 outcomes intact at the tool boundary: malformed tool arguments return `INVALID_REQUEST`, ambiguity remains an explicit clarification result, ineligible/stale data remains `UNAVAILABLE`, and genuine repository failures remain `TEMPORARY_FAILURE`. The route must separately reject invalid HTTP bodies and unauthenticated requests before any provider call, while a tool failure is a safe structured result that lets the model request clarification or provide a bounded fallback.

Before proposal, record these product decisions:

| Decision | Why it is blocking |
| --- | --- |
| Primary provider/model and auditor model (or no LLM auditor) | Determines packages, env schema, latency/cost envelope, model capabilities, and fallback behavior. |
| Authentication identity propagation | The route must reliably obtain a Payload `users` identity and request context; the source has no equivalent control and target users have no roles. |
| Direct client access | Recommend **no direct external-client route access in Flow 2**. An internal executive receives both sections; copying the client section is a business workflow, not a second authenticated audience. |
| Dual-response semantics | Decide whether the response is delimiter-based text for a later UI, or a validated structured artifact. Recommend a typed server-side dual artifact or a single safe internal response until Flow 4 owns rendering. |
| Clinical-detail coverage | Decide whether Flow-1's bounded DTO is sufficient. Do not let the prompt imply safety, dose, contraindication, or reconstitution information that its tool cannot return. |
| Rate, cost, and telemetry limits | Specify per-user/request limits, max messages/input bytes, max tool steps/detail calls, timeout, usage retention, redaction, and which metrics may be emitted without Flow-3 persistence. |
| Auditor policy | Decide whether prompt-injection/PII triage merits a second model call. If retained, auditor failure must fail closed or return a safe denial, and logs must never store raw patient identifiers. |

### Risks
- A source-like unauthenticated route would bypass the Flow-1 guarantee that Payload reads run as the actual internal user.
- The source prompt prescribes fields and Markdown-section selection that the Payload DTO neither exposes nor can safely infer.
- Prompt-only dual sections are fragile for a later UI; accidentally exposing executive-only protocol steps to an external caller is a clinical and business risk.
- Provider, audit, and token telemetry can create unbounded cost and privacy exposure unless budgets, redaction, and retention are specified.
- `validateProductData` must remain excluded: its catalog source is disabled and source failures can be reported as no discrepancy.
- Flow 3 persistence and Flow 4 UI must remain excluded; the source Prisma routes and UI tool/source rendering cannot be used as hidden dependencies.
- Flow 1 verification/archive is still blocked by the native gate defect. This does not block Flow 2 code technically, but its unresolved audit trail should be tracked independently.

### Ready for Proposal
No — the implementation boundary is clear, but the proposal needs the provider/model, authentication propagation, direct-client-access, dual-response, DTO-coverage, auditor, and rate/cost/telemetry decisions above. Once resolved, start a single-PR Flow 2 proposal with a 1,200-line review budget and strict RED-GREEN-REFACTOR route/tool tests; do not include Flow 3 persistence or Flow 4 UI.
