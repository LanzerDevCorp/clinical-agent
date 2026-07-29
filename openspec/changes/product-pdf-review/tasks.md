# Tasks: Product PDF Review

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 606 additions / 1 deletion authored actual (generated types/import map excluded) |
| Incremental amendment | ~10–25 authored lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Maintainer-approved single PR; commit vertical slices |
| Delivery strategy | single-pr with approved size:exception |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| 1 | Model + document | `pnpm test:int -- product-pdf` | multi-page `%PDF`, <10s/<256 MiB RSS | `src/lib/product-pdf/*`, int test |
| 2 | Endpoint + admin | `pnpm test:int -- product-pdf` | authenticated depth-5 request and clean editor | endpoint/action registration and integration tests |
| 3 | Reconstitution hierarchy | `pnpm test:int -- product-pdf` | existing multi-page `%PDF` gate | renderer/test hunks only |

## Phase 1: Pure review model — sequential

- [x] 1.1 **RED:** `tests/int/product-pdf.int.spec.ts` covers graph mapping, seven Protocol fields, traceability, empty labels, status, and metadata omission. [Req: Complete graph; Content]
- [x] 1.2 **GREEN:** `src/lib/product-pdf/model.ts` provides pure validation, whitelisted mapping, Product traceability, and safe filenames. [Req: Complete graph; Delivery]
- [x] 1.3 **REFACTOR:** Keep mapper completeness and fixtures readable. [Req: Evolution]

## Phase 2: Server PDF boundary — after Phase 1

- [x] 2.1 **RED:** `tests/stubs/server-only.ts`/`vitest.config.mts` enable accented multi-page and status rendering coverage. [Req: Status; Evolution]
- [x] 2.2 **GREEN:** `src/lib/product-pdf/document.tsx` buffers server-only React-PDF output with server fonts. [Req: Delivery]
- [x] 2.3 **GATE:** Record `%PDF`, <10s, and <256 MiB RSS evidence. [Req: Evolution]

## Phase 3: Atomic route — after Phase 2

- [x] 3.1 **RED:** `tests/int/product-pdf.int.spec.ts` asserts depth 5, seven Protocol fields, metadata omission, atomic errors, and safe headers. [Req: Authorization; Complete graph]
- [x] 3.2 **GREEN:** `src/lib/product-pdf/endpoint.ts` uses request-bound depth 5 with access enforcement, buffering, and stable responses. [Req: Authorization]
- [x] 3.3 **REFACTOR:** Centralize stable error/headers without changing successful bytes. [Req: Authorized response]

## Phase 4: Admin and generated artifacts — after Phase 3

- [x] 4.1 **RED:** `tests/int/product-pdf-action.int.spec.tsx` covers create/dirty/clean states and opener-safe URL behavior; no E2E. [Req: Action]
- [x] 4.2 **GREEN/REFACTOR:** Add `src/components/ProductPdfAction.tsx`; register `beforeDocumentControls`; preserve Save behavior. [Req: Persisted-product action]
- [x] 4.3 Run `pnpm generate:types` and `pnpm generate:importmap`; retain generator output only. [Req: Evolution]
- [x] 4.4 Run focused/full integration gates and record runtime/rollback evidence. [Req: All]

## Phase 5: Reconstitution hierarchy amendment — sequential

- [x] 5.1 **RED:** In `tests/int/product-pdf.int.spec.ts`, assert visible nested heading `Reconstitución / Dilución` while retaining diluent type, volume, and instructions values. [Req: Nested Payload groups]
- [x] 5.2 **GREEN:** In `src/lib/product-pdf/document.tsx`, statically group those three fields in a pageable subsection before Protocols. [Req: Nested Payload groups]
- [x] 5.3 **VERIFY:** Run `pnpm test:int -- product-pdf`, `pnpm test:int`, and `pnpm exec tsc --noEmit`; record results. [Req: Evolution]

Amendment scope excludes E2E, mapper, endpoint, action, collection, and generated files. Maintainer authorized invalidating the prior receipt and one new bounded review after apply.
