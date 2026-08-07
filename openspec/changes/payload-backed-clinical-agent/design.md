# Design: Payload-Backed Clinical Agent — Flow 1

## Technical Approach

Add a server-only `ClinicalProductRepository` as this capability's sole Payload caller. It validates request-bound inputs, performs bounded access-controlled reads, and maps generated types to stable DTOs. Routes, AI/provider/prompt work, persistence, UI, and RAG remain out of scope; product PDF stays independent.

## Architecture Decisions

| Concern | Alternatives / tradeoff | Decision and rationale |
| --- | --- | --- |
| Authorization | Payload defaults vs explicit policy | Add `internalUsersOnly` to `products` and `protocols`, accepting only `req.user.collection === 'users'`. The repository denies other identities before querying and passes `req`, `user`, and `overrideAccess: false` on every read. Do not filter approval in collection access; authenticated PENDING PDFs must continue working. |
| Agent eligibility | New presentation approval field vs existing model | Treat `validationStatus === 'APPROVED'` plus presentation `status === 'activa'` as approved eligibility. Presentations are embedded children of the validated product; discontinued/PENDING content is excluded by the repository. |
| Discovery | Filesystem/SQL index vs Payload query | Use bounded `find` (`depth: 0`, limit 21) with APPROVED filtering and `contains` OR predicates on `canonicalName`, `aliases.term`, `presentations.canonicalName`, and `presentations.aliases.term`. Payload 3.85/Postgres executed this query on the current schema. Normalize active rows; rank exact/prefix/substring; sort by rank, names, product ID, then presentation ID. Multiple plausible choices always clarify. Defer trigram indexes until measured need. |
| Details and relationships | PDF `depth: 5` vs projection | `findByID` uses discovered product/presentation IDs, `depth: 2`, nested `select`, and collection `populate`, covering protocol sub-relationships. Normalizers handle generated `number | object` unions; unexpected ID-only required data yields `UNAVAILABLE`, without extra reads or partial output. |
| Protocol policy | Product/presentation flag vs protocol field | Add required boolean `clientShareable`, default `false`, to `src/collections/Protocols.ts`. A positive decision requires the approved product, active selected presentation, related protocol ID, protocol read access, and this flag. All absent/ineligible cases return the same negative decision without instructions. |
| Test seam | Global mocks vs injection | Construct with a request-bound reader (`find`, `findByID`): production supplies `req.payload`; tests inject spies. Ranking/mapping remains pure. |

## Data Flow

```text
authenticated PayloadRequest → repository → Payload Local API
        │                         │              │
        └─ internal-user check    └─ safe DTO ← selected documents
                                      └─ stable safe result
```

## File Changes

| File | Action | Description |
| --- | --- | --- |
| `src/access/internalUsersOnly.ts` | Create | Shared product/protocol read policy. |
| `src/collections/Products.ts` | Modify | Apply explicit read access; preserve PDF endpoint and hooks. |
| `src/collections/Protocols.ts` | Modify | Apply read access and add `clientShareable`. |
| `src/lib/clinical-agent/contracts.ts` | Create | Inputs, DTOs, and safe outcomes. |
| `src/lib/clinical-agent/repository.ts` | Create | Queries, ranking, mapping, and failure normalization. |
| `src/migrations/<generated>_add_protocol_client_shareable.ts`, `src/migrations/index.ts` | Create/Modify | Additive default-false column and reversible registration. |
| `src/payload-types.ts` | Regenerate | Include the new protocol field/select type. |
| `tests/int/clinical-product-repository.int.spec.ts` | Create | Contract, query-option, access, ambiguity, mapping, and error tests. |
| `tests/int/clinical-product-query-postgres.int.spec.ts` | Create | Real nested-query, migration default, and policy coverage. |

Expected implementation size: **550–750 changed lines**, including generated types and tests.

## Interfaces / Contracts

```ts
type SafeResult<T> = { ok: true; data: T } | {
  ok: false; code: 'UNAUTHORIZED' | 'INVALID_REQUEST' | 'UNAVAILABLE' | 'TEMPORARY_FAILURE'
}
type SearchData =
  | { kind: 'empty' }
  | { kind: 'match'; product: ProductSummary; presentation: PresentationSummary }
  | { kind: 'clarification'; choices: ClarificationChoice[]; truncated: boolean }
```

`getProductDetails({ productId, presentationId })` returns one bounded DTO. `canShareProtocol({ productId, presentationId, protocolId })` returns `{ shareable: boolean }`; negative results disclose no protocol data. Exceptions, timestamps, validation notes, relationship documents, and storage details never cross the boundary.

## Testing Strategy

| Layer | RED tests before implementation |
| --- | --- |
| Integration (injected reader) | Invalid/unauthorized inputs make zero calls; calls carry access context; discovery and ambiguity are deterministic; ID-only data/errors map safely; DTOs contain no raw sentinels. |
| Integration (Payload/Postgres) | Seeded nested paths work; only APPROVED + active data appears; shareability defaults false; `users` access and bounded projections hold. |
| Regression | Existing `tests/int/product-pdf.int.spec.ts` proves PENDING PDFs, depth 5, and PDF errors stay unchanged. E2E is N/A without route/UI. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is introduced.

## Migration / Rollout

After RED tests, change schema, run `pnpm payload migrate:create`, inspect reversible SQL (`boolean DEFAULT false NOT NULL`), then run `pnpm generate:types`. Run `pnpm payload migrate` before future consumers; existing protocols default deny. Roll back consumers/repository/access first, then migrate down after field readers are gone. PDF code remains unchanged and ignores `clientShareable`.

## Open Questions

None blocking. Flow 1 defines “internal” as membership in the authenticated `users` collection because no role field exists; role expansion belongs to a later authorized change.
