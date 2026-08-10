# Tasks: Streaming Clinical-Agent Backend

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,450–1,850 (19 design files, tests, migration, lockfile, deployment work; no generated source expected) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Four work-unit commits inside one approved size-exception PR |
| Delivery strategy / chain | exception-ok / size-exception (maintainer-approved `size:exception`; Engram #519) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

Each unit is sequenced **RED → GREEN → REFACTOR/check-only**.

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | DTO extension | Commit 1 / exception PR | `pnpm run test:int -- tests/int/clinical-product-repository.int.spec.ts tests/int/clinical-product-query-postgres.int.spec.ts` | Seeded Payload details | `contracts.ts`, `repository.ts`, tests |
| 2 | Admission | Commit 2 / exception PR | `pnpm run test:int -- tests/int/clinical-agent-route.int.spec.ts` | Postgres 60/2 race/expiry | migration, index, `admission.ts`, tests |
| 3 | Safe orchestration | Commit 3 / exception PR | `pnpm run test:int -- tests/int/clinical-agent-orchestrator.int.spec.ts` | Fake gateway, clock, timers | five `agent/*.ts` files, test |
| 4 | Route and release | Commit 4 / exception PR | `pnpm run test:int -- tests/int/clinical-agent-route.int.spec.ts tests/int/gateway-preflight.int.spec.ts` | Disabled Vercel canary: 150s close <180s | route, script, dependencies, deployment/tests |

## Phase 1: Flow-1 Contract and Admission

- [x] 1.1 **RED**: test details: exact/stale, approved-present, absent/no-inference, unauthorized, temporary in `tests/int/clinical-product-{repository,query-postgres}.int.spec.ts`.
- [x] 1.2 **GREEN → REFACTOR/check**: extend only approved laboratory, presentation, and protocol fields in `src/lib/clinical-agent/{contracts,repository}.ts`; run Unit 1.
- [x] 1.3 **RED**: test HMAC isolation; atomic 60/2, race, expiry/crash, and DB/cleanup fail-closed in `tests/int/clinical-agent-route.int.spec.ts`.
- [x] 1.4 **GREEN → REFACTOR/check**: create `src/lib/clinical-agent/agent/admission.ts`, private reversible `src/migrations/<timestamp>_clinical_agent_admission.ts`, and register `src/migrations/index.ts`; run Unit 2.

## Phase 2: Typed Streaming Core

- [x] 2.1 **RED**: test DTO-only tools, safe non-successes, dual validation, and unshareable-protocol no-leak in `tests/int/clinical-agent-orchestrator.int.spec.ts`.
- [x] 2.2 **GREEN → REFACTOR/check**: create `src/lib/clinical-agent/agent/{contracts,prompt,tools}.ts` with request-bound `req`, `user`, `overrideAccess:false`; run Unit 3.
- [x] 2.3 **RED**: test exact limits, timeout/cancel, one transient pre-chunk retry, permanent/post-chunk no-retry, opaque errors/no retention in `clinical-agent-orchestrator.int.spec.ts`.
- [x] 2.4 **GREEN → REFACTOR/check**: create injected `src/lib/clinical-agent/agent/{orchestrator,gateway}.ts`: AI SDK 6/Gateway, fixed model, 150/45/30s limits, atomic artifact; run Unit 3.

## Phase 3: Route, Preflight, and Delivery

- [x] 3.1 **RED**: test auth-before-body/provider, 256 KiB/40 messages, external denial, finally release, and opaque route errors in `clinical-agent-route.int.spec.ts`.
- [x] 3.2 **GREEN → REFACTOR/check**: create Node `src/app/api/chat/route.ts` (`maxDuration=180`) with Payload session auth/bounded stream; run Unit 4.
- [x] 3.3 **RED**: test exact Gateway catalog success and absent/unverifiable no-fallback in `tests/int/gateway-preflight.int.spec.ts`.
- [x] 3.4 **GREEN → REFACTOR/check**: add `src/scripts/check-gateway-model.ts`, AI SDK 6/Gateway `package.json`/`pnpm-lock.yaml`; preflight. Configure disabled Vercel Pro Fluid, migrate, then canary 150s close <180s before enablement; threat matrix remains N/A (no shell/VCS tests).
