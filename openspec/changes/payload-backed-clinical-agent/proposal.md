# Proposal: Payload-Backed Clinical Agent

## V1 Roadmap

| Flow | Independent SDD change | Status |
| --- | --- | --- |
| 1 | `payload-backed-clinical-agent`: Payload clinical-query contract and safety policy | **This change only** |
| 2 | `streaming-clinical-agent-backend`: provider/model, streaming route, prompt, dual responses, Flow-1 tools | Follow-on; depends on 1 |
| 3 | `payload-conversation-persistence`: history, feedback, metrics, owner/supervisor access | Follow-on; retention requires compliance approval |
| 4 | `advanced-clinical-chat-ui`: UI, streaming/tool states, provenance, authenticated PDFs | Follow-on; depends on 2 and 3 |

RAG is a later, evidence-led experiment, not a v1 flow.

## Intent

Make Payload the sole, safe clinical-data source before any chat backend or UI consumes it. Internal authenticated users need bounded, approved product information without exposing CMS records, pending data, or unauthorized client protocols.

## Scope

### In Scope
- Server-only clinical repository and typed `searchProducts`, `getProductDetails`, and protocol-shareability contracts.
- Approved-data policy; broad canonical, alias, presentation, and partial-name discovery that returns clarification for ambiguity.
- Individual-protocol client-shareability, authenticated Local API access, stable DTOs/errors, schema migration/type generation, and TDD coverage.

### Out of Scope
- Flows 2–4; they remain separate SDD lifecycles, not implementation work here.
- AI provider, streaming route, prompt, UI, persistence, roles, retention, PDF presentation, and `validateProductData`.
- RAG, Markdown/JSON registries, and static source mappings.

## Capabilities

### New Capabilities
- `clinical-product-query`: Approved Payload product discovery, detail, protocol-sharing, authorization, and safe error contracts.

### Modified Capabilities
None; `openspec/specs/` has no existing capability specs.

## Approach

Create a server-only `ClinicalProductRepository` as the sole Local API caller. Validate boundary inputs, use minimal `select`/bounded `depth`, map Payload types to DTOs, default-deny unapproved or inaccessible data, and pass the real user/request with `overrideAccess: false`. Target 400–650 changed lines; use ask-on-risk if the 800-line budget is threatened.

## Affected Areas

| Area | Impact | Description |
| --- | --- | --- |
| `src/lib/clinical-agent/*` | New | Repository, DTOs, mappers, query/tool contracts |
| `src/collections/Products.ts`, `Protocols.ts` | Modified | Publication/read and protocol-shareability policy |
| `src/payload-types.ts` | Regenerated | Payload schema types |
| `tests/int/*` | Modified | Local API, mapping, ambiguity, and error tests |

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Pending or unauthorized clinical data leaks | Med | Default deny; real-user access tests |
| Query/relationship overfetch or unsupported search | Med | Prove queries against Payload/Postgres integration tests |

## Rollback Plan

Revert the repository, contracts, access policy, and additive shareability migration; retain existing PDF behavior. No chat/UI consumer is introduced, so rollback removes the unused boundary.

## Dependencies

- Authenticated Payload user/request context and an approved additive migration rollout.
- Compliance retention decision before Flow 3; Flows 2–4 depend on their stated predecessors.

## Success Criteria

- [ ] Only approved, authorized data appears in bounded DTOs; Markdown/JSON sources are never read.
- [ ] Ambiguous broad searches request clarification; per-protocol sharing is enforced.
- [ ] Integration tests prove Local API options, stable errors, and access behavior.
