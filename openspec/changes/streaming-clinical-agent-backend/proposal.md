# Proposal: Streaming Clinical-Agent Backend

## Intent

Provide internal personnel streamed, clinically bounded product guidance while preserving request-bound Payload access and producing separately validated internal/executive and client-shareable sections.

## Scope

### In Scope
- Add an authenticated internal-only streaming route using Vercel AI Gateway model `deepseek/deepseek-v4-flash`; deployment preflight MUST verify the catalog ID and fail closed without fallback.
- Resolve the real Payload session/request user and run Flow-1 tools with that identity; validate typed dual-audience output without an LLM auditor.
- Extend Flow-1 `ProductDetails` only for available approved source fields; never infer absent clinical data.
- Enforce 256 KiB/40-message input, 4096 output tokens, 12 steps, 8 tools (4 details), 150 s total, 45 s first chunk, 30 s/tool, 60 requests/hour/user, 2 concurrent/user, and one pre-stream provider retry.
- Add strict TDD coverage for authorization, bounds, tools, DTOs, preflight, and safe failures. Deliver one PR within 1,200 changed lines.

### Out of Scope
- Flow 3 persistence, telemetry/usage/prompt/response retention, and Flow 4 UI.
- External-client route access, Prisma/filesystem sources, and `validateProductData`.

## Capabilities

### New Capabilities
- `streaming-clinical-agent-backend`: Internal authenticated streaming orchestration, bounded Flow-1 tool access, and typed dual-audience output.

### Modified Capabilities
- `clinical-product-query`: Extend the Flow-1 `Stable bounded details`/`ProductDetails` contract only with available approved clinical source fields, preserving no-inference and safe-outcome rules. Its active baseline is `openspec/changes/payload-backed-clinical-agent/specs/clinical-product-query/spec.md`, **not** `openspec/specs/`; the later spec phase MUST create an explicit coordinated cross-change delta rather than omit this extension.

## Approach

Authenticate before parsing or provider work, construct Flow-1 access from the actual Payload request/user with `overrideAccess: false`, and retain its structured outcomes at the tool boundary. Stream through a gateway adapter, validate the final typed artifact, and emit only redacted operational errors with opaque request IDs. Persist no product telemetry, prompts, responses, or token usage.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/app/api/chat/route.ts` | New | Authenticated bounded stream boundary. |
| `src/lib/clinical-agent/agent/*` | New | Gateway, tools, policies, typed validation. |
| `src/lib/clinical-agent/contracts.ts`, `repository.ts` | Modified | Bounded Flow-1 detail DTO extension. |
| Deployment/CI configuration | Modified | Gateway catalog preflight. |
| `tests/int/*` | New/Modified | Strict TDD contract coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Access bypass | Med | Real request identity; deny before provider work. |
| Unsupported guidance | Med | DTO-only fields; safe unavailable/clarification outcomes. |
| Gateway/privacy failure | Med | Catalog fail-closed, hard limits, redacted errors only. |

## Rollback Plan

Remove the route/gateway adapter and revert the coordinated DTO delta and dependencies; Flow-1 retains its prior contract. No persisted data requires migration.

## Dependencies

- Gateway catalog availability of `deepseek/deepseek-v4-flash` at deployment.
- Cross-change contract dependency: coordinate the explicit `clinical-product-query` delta against its active Flow-1 spec above; do not treat it as archived main-spec coverage.
- Flow 1 is technically usable; its unresolved verify/archive native-gate defect remains an audit dependency, not an implementation blocker.

## Success Criteria

- [ ] Only authenticated internal users start provider work; all limits and retry boundary are enforced.
- [ ] Gateway preflight rejects an unavailable model ID without fallback.
- [ ] Typed output and extended details contain only authorized available DTO data; tests cover the cross-change contract.
