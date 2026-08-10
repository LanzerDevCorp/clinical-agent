# Apply Progress: Streaming Clinical-Agent Backend

## Execution State

- Status: `remediated` — all 12 apply tasks remain complete; the bounded correction passes locally, but fresh `sdd-verify` is still required and archive remains blocked.
- Mode: Strict TDD reconciliation plus one maintainer-authorized bounded remediation; no task, dependency, migration, configuration, deployment, or admitted verify-report bytes changed.
- Delivery strategy: `exception-ok`; chain strategy: `size-exception`; maintainer approval: Engram #519.
- Work-unit commits: Unit 1 `9aee293`, Unit 2 `97b1130`, Unit 3 `34f68f4`, Unit 4 `a8566e0` (subject line is misleading; its bytes are the route/Gateway/preflight unit).
- Native attempt owned by parent: ordinal 2, generation 2, work unit `reconcile-direct-units-2-4`, input revision `sha256:e2fbecf5f62c8b54f861579f125aef3d408d687cc13424a86ef3fd51437a238a`.
- Active remediation attempt remains parent-owned: work unit `remediate-final-verify-blockers`, token `sha256:208b825dde9249a36c1cf2822736fde288be94c9cc01b6dfda317b0392340d5c`, failed evidence `sha256:0143eefcaabea4f8800345e130ce42dec4d9febc2452ea903797eb177f06ccc5`.
- Completed tasks: 12 of 12.

## TDD Cycle Evidence

Historical evidence is reconstructed only from committed bytes and durable Engram records. Exact historical RED process output was not retained for Units 2–4 and is not fabricated; their records explicitly require/record Strict TDD, the parent revisions lack the new production modules, and the autonomous commits co-locate behavioral tests with implementation. Later corrective RED evidence is recorded separately where durable evidence exists.

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `clinical-product-{repository,query-postgres}.int.spec.ts` | Reader + Payload/Postgres integration | ✅ Historical 42/42 | ✅ Historical exit 1: exactly 3 intended failures, 41 passed | ✅ Historical 44/44; current 44/44 | ✅ Present, absent/ID-only, unauthorized, stale/ineligible, temporary failure | ✅ Current focused 44/44; typecheck/lint/build/diff checks pass |
| 1.2 | Same | Mapping + Payload/Postgres integration | ✅ Historical 42/42 | ✅ Approved fields absent from DTO/projection | ✅ Historical/current 44/44 | ✅ Populated and absent/unresolved paths | ✅ Two pure bounded helpers; current checks pass |
| 1.3 | `clinical-agent-route.int.spec.ts` | Payload/Postgres integration | ✅ Unit 1 44/44 (Engram #530) | ✅ Reconstructed from Strict TDD record #530 and parent of `97b1130`; exact RED count unavailable | ✅ Historical admission 6/6; current route 10/10 | ✅ 60/61, 2/3 race/release, expiry/crash, HMAC, DB/cleanup failure | ✅ Release proof correction #533/#534; current 10/10 |
| 1.4 | Same | Postgres migration/admission integration | ✅ Unit 1 44/44 | ✅ Test contract preceded admission module under documented Strict TDD; exact RED output unavailable | ✅ Historical admission 6/6; current 10/10 | ✅ Up/down migration and fail-closed storage paths | ✅ Private reversible schema and focused/current checks pass |
| 2.1 | `clinical-agent-orchestrator.int.spec.ts` | Injected integration | ✅ Units 1–2 50/50 (Engram #537) | ✅ Reconstructed from Strict TDD records #538–#540 and parent of `34f68f4`; exact RED count unavailable | ✅ Historical/current 10/10 | ✅ Authorized facts, safe non-successes, private protocol, invalid/partial artifact | ✅ Access-bypass correction #541/#543/#545 retained |
| 2.2 | Same | Request-bound repository integration | ✅ Units 1–2 50/50 | ✅ New tool/contracts/prompt modules were absent in the parent revision; exact RED output unavailable | ✅ Historical/current 10/10 | ✅ Original `req`/user/`overrideAccess:false` plus bypass rejection | ✅ Public operations override removed; current checks pass |
| 2.3 | Same | Deterministic timer/gateway integration | ✅ Units 1–2 50/50 | ✅ Original Strict TDD record plus durable corrective gaps #541 and regressions #543; exact original RED count unavailable | ✅ Historical/current 10/10 | ✅ 8/4 calls, 12/13 steps, 4096/4097 tokens, 150/45/30s, cancellation, retry classes | ✅ Non-cooperative cancellation and numeric-limit proof corrected; current checks pass |
| 2.4 | Same | Injected gateway/orchestration integration | ✅ Units 1–2 50/50 | ✅ New orchestrator/gateway modules absent in parent of `34f68f4`; exact RED output unavailable | ✅ Historical/current 10/10 | ✅ Pre-part transient retry once; permanent/post-part no retry; atomic final validation | ✅ Request-read cancellation race and iterator cleanup retained |
| 3.1 | `clinical-agent-route.int.spec.ts` | Route + Payload/Postgres integration | ✅ Units 1–3 60/60 (Engram #550) | ✅ Original Strict TDD record; corrective nested-key RED explicitly returned 200 before fix (#556) | ✅ Historical/current route 10/10 | ✅ auth/external denial, admission-before-body, byte/message/nested bounds, release/error/cancel | ✅ Exact nested keys and intentional ordering preserved |
| 3.2 | Same | App Router stream integration | ✅ Units 1–3 60/60 | ✅ Route absent in parent of `a8566e0`; exact original RED output unavailable | ✅ Historical/current route 10/10 | ✅ finish/failure/cancel release exactly once; no tools/provider on denial | ✅ Node runtime, 180s platform bound, redacted route events |
| 3.3 | `gateway-preflight.int.spec.ts` | Gateway adapter/preflight integration | ✅ Units 1–3 60/60 | ✅ Preflight/test absent in parent of `a8566e0`; exact original RED output unavailable | ✅ Historical/current preflight 7/7 | ✅ exact catalog match, absent/unverifiable/timeout, no fallback | ✅ Deterministic injected fetch/timers; no live catalog call |
| 3.4 | Route + preflight suites | Route/Gateway integration | ✅ Units 1–3 60/60 | ✅ Gateway adapter/script/dependencies absent in parent of `a8566e0`; exact original RED output unavailable | ✅ Historical/current Unit 4 17/17 | ✅ fixed model, zero SDK retries, cancellation, structured final artifact | ✅ Typecheck, targeted ESLint, production build, diff-check pass |

## Test Summary

- Net reconciled focused tests above the 42-test pre-change Flow-1 safety net: 29; current combined result: 5 files, 71/71 tests passed.
- Layers: integration only (reader doubles, deterministic gateway/timers, real Payload/Postgres where applicable); no UI E2E scope.
- Approval/safety-net tests: existing 42-test Flow-1 baseline.
- Pure helpers retained: `optionalRelationshipValues`, `boundedReconstitution`; provider and timer seams remain injected.

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| 1 — DTO extension | `pnpm run test:int -- tests/int/clinical-product-repository.int.spec.ts tests/int/clinical-product-query-postgres.int.spec.ts` — exit 0; 2 files, 44/44 tests. | Same command used seeded real Payload/Postgres; Postgres file 9/9 and cleanup completed. | Revert `9aee293`: DTO/repository mappings and the two focused tests. |
| 2 — Admission | `pnpm run test:int -- tests/int/clinical-agent-route.int.spec.ts` — exit 0; 1 file, 10/10 tests (6 admission cases plus 4 route cases). | Same command ran migration down/up and real Postgres 60/2 race, release, rolling expiry/crash recovery, and failure cleanup. | Revert `97b1130`: `admission.ts`, admission migration/registration, and admission cases in route tests. |
| 3 — Safe orchestration | `pnpm run test:int -- tests/int/clinical-agent-orchestrator.int.spec.ts` — exit 0; 1 file, 10/10 tests. | Same command exercised the provider-free runtime boundary with injected Flow-1 reader, gateway, clocks, timers, cancellation, and structured events; no external provider is part of Unit 3. | Revert `34f68f4`: five orchestration modules and their focused test, including later corrections preserved in that commit's current bytes. |
| 4 — Route and release | `pnpm run test:int -- tests/int/clinical-agent-route.int.spec.ts tests/int/gateway-preflight.int.spec.ts` — exit 0; 2 files, 17/17 tests. | Same command exercised the App Router stream boundary with real Payload/Postgres plus deterministic Gateway/catalog fakes. Live Vercel/catalog/provider canary was prohibited and remains a pre-enable rollout gate. | Revert `a8566e0`: route, AI SDK Gateway bridge, preflight script, dependency/lock changes, and Unit 4 route/preflight tests. |

## Current Candidate Verification

| Command | Exact result |
|---|---|
| Five-file combined integration command | Exit 0; 5 files passed; 71/71 tests passed. |
| `pnpm exec tsc --noEmit` | Exit 0; no diagnostics. |
| Targeted `pnpm exec eslint` over all Flow 2 source/migration/script/test paths | Exit 0; no diagnostics. |
| `pnpm run build` | Exit 0; Next.js 16.2.6 production build compiled, typechecked, generated 7/7 static pages, and included dynamic `/api/chat`. |
| `git diff --check`; `git diff --cached --check` | Exit 0; no output before artifact reconciliation. |

## Completed Tasks

- [x] 1.1–1.4 Flow-1 bounded details and Postgres admission.
- [x] 2.1–2.4 typed request-bound streaming orchestration.
- [x] 3.1–3.4 authenticated route, Gateway adapter, exact-model preflight, and local delivery checks.

## Remaining Tasks

- None in apply. Proceed to `sdd-verify`; do not launch it from this executor.

## Deviations, Issues, and Rollout Gates

- No implementation deviation from the proposal/spec/design was found. Authentication → admission → bounded body validation is intentionally preserved (Engram #555).
- The live target-environment migration, Vercel Pro Fluid configuration, exact-model catalog call, and 150s<180s canary were not run because this reconciliation forbids deployment, production migration, live calls, and secrets. They remain mandatory pre-enable rollout gates, not local source gaps.
- `pnpm` warns that the existing `pnpm.onlyBuiltDependencies` package field is ignored; this did not affect tests, typecheck, lint, or build.
- Historical RED output counts for Units 2–4 were not retained. This artifact cites only durable commit/Engram evidence and does not invent process results.

## Bounded Remediation: Final Verification Blockers

- Authority: one unmanaged native attempt, maximum 200 changed lines; parent retains settle/finish authority.
- Scope: only the three frozen CRITICAL findings in admitted verification evidence `sha256:0143eefcaabea4f8800345e130ce42dec4d9febc2452ea903797eb177f06ccc5`.
- Result: all three corrections pass locally; the admitted FAIL report is unchanged and independent re-verification remains mandatory.

```json
{"schema":"gentle-ai.remediation-result/v1","outcome":"passed","lineage_id":"","generation":0,"fix_batch":0,"failed_evidence_revision":"sha256:0143eefcaabea4f8800345e130ce42dec4d9febc2452ea903797eb177f06ccc5","work_unit":"remediate-final-verify-blockers","native_attempt_token":"sha256:208b825dde9249a36c1cf2822736fde288be94c9cc01b6dfda317b0392340d5c","changed_lines":133,"reverification_required":true}
```
```json
{"schema":"gentle-ai.remediation-evidence/v1","lineage_id":"","generation":0,"fix_batch":0,"failed_evidence_revision":"sha256:0143eefcaabea4f8800345e130ce42dec4d9febc2452ea903797eb177f06ccc5","focused_tests":"2 files, 23/23 passed","runtime_harness":"5 files, 74/74 passed","typecheck":"exit 0","eslint":"exit 0","build":"exit 0","rollback":["src/lib/clinical-agent/agent/orchestrator.ts","tests/int/clinical-agent-orchestrator.int.spec.ts","tests/int/clinical-agent-route.int.spec.ts","this remediation section"]}
```

### Remediation TDD Cycle Evidence

| Frozen blocker | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Request-scoped first-part deadline | `clinical-agent-orchestrator.int.spec.ts` | Injected integration | 20/20 passed | Exit 1: `{ ok: true }` received instead of safe failure at 80,000 ms after a retryable failure at 44,000 ms | Filtered 1/1 and focused suite 23/23 passed | Existing direct 45,000 ms timeout and successful early retry remain passing | Timer allocation moved outside the retry loop; same focused suite passed |
| Exact 256 KiB acceptance | `clinical-agent-route.int.spec.ts` | App Router/Postgres integration | 20/20 passed | Coverage-gap probe selected 0 tests before the new case; behavior required no production change | Exact 262,144-byte valid JSON returned 200; focused suite passed | Existing oversized 413 and 40-message exact-bound cases remain passing | No production refactor needed |
| Retry exhaustion safe failure | `clinical-agent-orchestrator.int.spec.ts` | Injected integration | 20/20 passed | Coverage-gap probe selected 0 tests before the new case; behavior required no production change | Two retryable pre-stream failures produced exactly two attempts and one opaque `TEMPORARY_FAILURE` without provider detail | Existing retry-success, permanent-failure, and post-start-failure branches remain passing | No production refactor needed |

### Remediation Command and Work-Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused safety net | `pnpm exec vitest run --config ./vitest.config.mts tests/int/clinical-agent-orchestrator.int.spec.ts tests/int/clinical-agent-route.int.spec.ts` — exit 0; 2 files, 20/20 tests. |
| RED | Filtered orchestrator command — exit 1; 1 intended failure and 1 passing coverage case. Exact-route boundary command — exit 0; 1/1 passing because existing behavior already complied. |
| Focused GREEN / runtime harness | Same two-file command — exit 0; 2 files, 23/23 tests; real route/Postgres plus provider-free injected gateway/timers. |
| Combined Flow-2 integration | Five-file Vitest command — exit 0; 5 files, 74/74 tests. |
| Static/build | `pnpm exec tsc --noEmit`, targeted ESLint, and `pnpm run build` — each exit 0; Next.js built 7/7 pages and dynamic `/api/chat`. |
| Changed lines | 133 additions plus deletions relative to the acquired worktree: 17 production, 52 orchestrator-test, 19 route-test, and 45 merged-progress lines; below the 200-line attempt budget. |
| Rollback boundary | Revert the request-scoped timer move, the three regression cases and virtual-clock seam, and this remediation section only; prior apply evidence, tasks, admitted verify report, and unrelated work remain intact. |

### Exact Correction Locations

- `src/lib/clinical-agent/agent/orchestrator.ts:75-81, 100-101, 140-155`: request-level first-part deadline allocation, removal of attempt-level cleanup, and final cleanup.
- `tests/int/clinical-agent-orchestrator.int.spec.ts:26-58, 122-141, 401-433`: virtual clock, injected clock seam, 44,000→80,000 ms retry regression, and two-attempt safe-failure coverage.
- `tests/int/clinical-agent-route.int.spec.ts:324-341`: exact 262,144-byte accepted-body runtime coverage.
- `openspec/changes/streaming-clinical-agent-backend/apply-progress.md:5-10, 75-113`: cumulative remediation evidence merged without changing `tasks.md` or `verify-report.md`.
