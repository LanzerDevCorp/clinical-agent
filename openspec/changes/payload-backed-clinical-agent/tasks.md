# Tasks: Payload-Backed Clinical Agent — Flow 1

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 550–750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Single approved PR: Units 1 → 2 → 3 |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |
| Size exception | Explicit maintainer approval |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Start schema/access; finish default-deny field, migration, types, PDF regression. | Single PR—Unit 1 | `pnpm run test:int -- tests/int/clinical-product-query-postgres.int.spec.ts tests/int/product-pdf.int.spec.ts` | `pnpm payload migrate`, then focused tests against Postgres | `src/access/`, collections, migration/index, types, postgres test |
| 2 | Start contracts; finish injected-reader discovery and safe-result boundary. | Single PR—Unit 2 | `pnpm run test:int -- tests/int/clinical-product-repository.int.spec.ts` | N/A—reader-spy contract has no external runtime boundary | `src/lib/clinical-agent/*` and repository test |
| 3 | Start bounded details; finish Postgres projection and shareability integration. | Single PR—Unit 3 | `pnpm run test:int -- tests/int/clinical-product-*.int.spec.ts` | Seed approved/active and ineligible records in Payload/Postgres | repository detail/share code and both clinical tests |

## Phase 1: Access, Schema, and Migration

- [x] 1.1 **RED** — Extend `tests/int/clinical-product-query-postgres.int.spec.ts` for `users`-only product/protocol reads and existing-protocol `clientShareable: false`; retain `tests/int/product-pdf.int.spec.ts` PENDING, depth-5, and error assertions.
- [x] 1.2 **GREEN** — Create `src/access/internalUsersOnly.ts`; apply it to `src/collections/Products.ts` and `Protocols.ts`, add required default-false `clientShareable`, generate/register reversible migration in `src/migrations/`, and run `pnpm generate:types` for `src/payload-types.ts`.
- [x] 1.3 **REFACTOR** — Remove duplicated access/migration test setup without changing PDF endpoint/hooks; rerun Unit 1 tests.

## Phase 2: Safe Repository Contract

- [x] 2.1 **RED** — In `tests/int/clinical-product-repository.int.spec.ts`, prove malformed/non-user requests make zero reads; reader errors become `TEMPORARY_FAILURE`; stale/ineligible data becomes `UNAVAILABLE`; no legacy source is consulted.
- [x] 2.2 **GREEN** — Create `src/lib/clinical-agent/contracts.ts` and `repository.ts` with safe unions, injected request-bound `find`/`findByID`, `req`/`user`/`overrideAccess: false`, and bounded failure mapping.
- [x] 2.3 **REFACTOR** — Isolate pure input validation and safe-result mappers in `repository.ts`; keep Payload as the sole caller/source and rerun Unit 2 tests.

## Phase 3: Deterministic Discovery

- [x] 3.1 **RED** — Add repository cases for canonical/alias/presentation/partial matches, APPROVED+active filtering, limit 21/depth 0/OR query shape, deterministic rank/order, empty result, and product/presentation clarification.
- [x] 3.2 **GREEN** — Implement bounded `searchProducts` in `repository.ts`; normalize rows and return only summary DTOs or explicit clarification choices.
- [x] 3.3 **REFACTOR** — Centralize ranking/comparators and query construction; rerun the focused repository suite.

## Phase 4: Details and Protocol Sharing

- [x] 4.1 **RED** — Add detail/share tests for discovered IDs, explicit presentation, depth-2 nested projection, ID-only relation `UNAVAILABLE`, exact shareable protocol, and identical false decisions without instructions.
- [x] 4.2 **GREEN** — Implement bounded `getProductDetails` and `canShareProtocol` in `repository.ts`; exclude timestamps, notes, raw documents, and partial data.
- [x] 4.3 **REFACTOR** — Deduplicate detail/protocol eligibility mapping; run Unit 3 tests, `pnpm run lint`, and `pnpm exec tsc --noEmit`.

## Phase 5: Scope Verification

- [x] 5.1 Verify `pnpm run test:int`; confirm no E2E threat tasks because the design marks every threat-matrix row N/A.
- [x] 5.2 Audit the diff: no AI route, persistence, UI, RAG, PDF behavior, or unrelated OpenSpec change is modified.
