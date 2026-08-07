# Design: Streaming Clinical-Agent Backend

## Technical Approach

Add an authenticated Node.js App Router route with Postgres-coordinated admission and injected AI SDK 6 orchestration. It uses fixed Gateway model `deepseek/deepseek-v4-flash`, request-bound Flow-1 tools, deterministic dual-audience safety, and no FAQ Agent filesystem/Prisma reads, auditor, `validateProductData`, logs, persistence, or UI.

## Architecture Decisions

| Concern | Alternatives / tradeoff | Decision and rationale |
|---|---|---|
| Identity | Header auth vs Payload request | `createPayloadRequest` resolves `req.user`/`req.payload` before body reads; every Flow-1 read retains `req`, `user`, `overrideAccess: false`. |
| Admission | Process memory/Redis/Postgres | Use private Postgres tables. Compute `HMAC-SHA256(ADMISSION_HASH_SECRET, "users:<id>")`; never store raw IDs. Under a digest-derived transaction advisory lock, delete expired rows, count the rolling one-hour events and active leases, then atomically insert one event plus 180-second lease only when counts are `<60` and `<2`. DB failure fails closed before provider/tools. |
| Model | Fallback vs fixed model | Explicit Gateway model, `maxRetries: 0`, no fallback. Exact-ID deployment preflight fails closed; the public catalog contained it on 2026-08-07, but every deployment rechecks. |
| Typed safety | Free text/auditor vs facts | `Output.object` returns DTO fact references/template IDs. Independent internal/client validators check the request ledger, audience allowlists, and per-protocol authorization before deterministic rendering. |
| UI stream | Unvalidated partials vs delayed artifact | `createUIMessageStream` emits safe status after the first provider part, then one validated artifact or redacted error. Clinical content is atomic because AI SDK partial objects are unvalidated. |
| Runtime | Netlify/Docker/Vercel | Select **Vercel Pro Node.js Functions with Fluid Compute**, `runtime='nodejs'`, platform `maxDuration=180`, and application timeout 150 seconds. Current Vercel docs give Fluid Functions 300 seconds by default (up to 800 on Pro), leaving 30 seconds for safe termination. Netlify documents a 10-second streamed-function limit; this repository has no live platform config, its Netlify skill link is missing, and Docker standalone output is not enabled. |
| Limits/privacy | SDK defaults vs scoped ports | Enforce 4096 tokens, 12 steps, 8 tools, 4 details, 30-second tools, 45-second first part, one transient pre-start retry, cancellation, and 150 seconds total. Inject provider, request, repository, admission, clock/IDs, timers; persist no content, telemetry, tokens, errors, or request IDs. |

## Data Flow

```text
Request → Payload auth → HMAC key → atomic Postgres admit/lease
 → bounded 256 KiB/40 messages → Flow-1 tools → Gateway structured stream
 → fact ledger → two validators → UI-message artifact → lease release
```

Cancellation/error/finish deletes the lease in `finally`; crashes recover through expiry. The 61st rolling-hour request and third concurrent request receive redacted `429`; database/cleanup failure returns redacted `503` without provider work.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/api/chat/route.ts` | Create | Auth, bounds, Node/180-second route contract. |
| `src/lib/clinical-agent/agent/contracts.ts`, `prompt.ts`, `tools.ts`, `orchestrator.ts`, `gateway.ts`, `admission.ts` | Create | Safety, DI, limits, Postgres admission. |
| `src/lib/clinical-agent/contracts.ts`, `repository.ts` | Modify | Bounded `ProductDetails` extension. |
| `src/migrations/<timestamp>_clinical_agent_admission.ts`, `src/migrations/index.ts` | Create/Modify | Private ephemeral tables and reversible registration. |
| `src/scripts/check-gateway-model.ts`, `package.json`, `pnpm-lock.yaml` | Create/Modify | Preflight and AI dependencies. |
| `tests/int/clinical-agent-route.int.spec.ts`, `clinical-agent-orchestrator.int.spec.ts`, `gateway-preflight.int.spec.ts` | Create | Strict RED backend tests. |
| `tests/int/clinical-product-repository.int.spec.ts`, `clinical-product-query-postgres.int.spec.ts` | Modify | DTO and real-Payload coverage. |

## Interfaces / Contracts

Private tables contain only `(event_id, subject_hash, admitted_at)` and `(lease_id, subject_hash, expires_at)`, indexed by hash/time and unavailable through Payload collections/APIs. Approved DTO additions are product laboratory/active ingredients; presentation contraindications, adverse effects, indications, post-care, warnings, reconstitution; and protocol onset, duration, dose, depth, sessions, frequency. Missing/ID-only fields are omitted or `UNAVAILABLE`; pH, storage, composition quantities, and FAQ dilution are never inferred.

## Testing Strategy

| Layer | RED coverage |
|---|---|
| Unit/Vitest | HMAC isolation, schemas, limits, retry, redaction, fake clocks. |
| Integration/Postgres | Atomic 60/2 boundaries, races, rolling expiry, crash lease expiry, cleanup/fail-closed, auth-before-body/provider, cancellation, DTO access. |
| Deployment smoke | Fluid enabled; exact model present; authenticated stream reaches safe 150-second timeout and closes before 180 seconds. UI E2E is N/A. |

## Threat Matrix

All five reference rows are N/A: no executable-file classification, Git selection, commit, push, or PR-command boundary.

## Migration / Rollout

Create the two admission tables without Payload exposure; opportunistically delete events older than one hour and expired leases on admission. Deploy disabled to Vercel Pro, enable Fluid, configure Postgres/Gateway/HMAC secrets, migrate, preflight, and run the real-duration canary before internal enablement. Roll back by disabling and draining the route, waiting 180 seconds, reverting consumers/DTOs, then dropping both tables. Secret rotation intentionally resets pseudonymous limits and occurs only during a disabled/drained rollout.

## Open Questions

None.
