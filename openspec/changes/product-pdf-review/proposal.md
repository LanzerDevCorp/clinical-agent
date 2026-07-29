# Proposal: Product PDF Review

## Intent

Give administrators a printable view of a persisted Product. Reviewing Payload tabs and nested records obscures omissions and status. The PDF never saves, approves, or mutates data.

## Scope

### In Scope
- Add **Ver en PDF** before **Guardar**; hide on create and disable with dirty guidance.
- Add access-controlled `GET /api/products/:id/pdf`, returning an inline PDF or atomic error.
- Render agreed fields and every actual Payload group as a labeled nested subsection, with explicit empty values, traceability, and status treatment.
- Add focused endpoint, rendering, admin-state, and runtime coverage.

### Out of Scope
- Persisted PDFs, history, signatures, approval actions, or audit certificates.
- Unsaved-form rendering, automatic download, raw JSON appendices, and tagged-PDF compliance claims.
- Schema-reflective layout generation or new E2E coverage.

## Capabilities

### New Capabilities
- `product-pdf-review`: Discoverable admin review action and secure on-demand PDF generation for the complete persisted Product graph.

### Modified Capabilities
- None; no existing capability specs are present.

## Approach

Load through request-bound Payload Local API at `depth: 5` with `req` and `overrideAccess: false`; reject unauthenticated, inaccessible, missing, or incomplete graphs. Render the explicit view model server-only with installed `@react-pdf/renderer@4.5.1`. Use static layout: every actual group is a labeled nested subsection; currently **Reconstitución / Dilución** within each presentation. Mapper, endpoint, and action stay unchanged. The Node/React 19 buffer spike passed. Representative multi-page output, accents, fixed warnings, memory, and render time remain an implementation gate.

## Affected Areas

| Area | Impact |
|---|---|
| `src/collections/Products.ts` | Register endpoint and admin control |
| `src/components/ProductPdfAction.tsx` | New persisted/dirty-state action |
| `src/lib/product-pdf/*` | New validator, mapper, renderer, filename handling |
| `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js` | Regenerated artifacts |
| `tests/int/*` | Fixtures and focused coverage |

## Risks

- Buffering may exceed memory limits; measure before release and stream only if justified.
- Client/mixed renderer imports fail; keep a server-only boundary.
- Schema drift could omit fields; make mapper completeness explicit and covered.

## Rollback Plan

Remove the admin registration, endpoint, and PDF module; regenerate Payload artifacts. No data migration or stored files require cleanup.

## Dependencies

- Existing Payload authentication/access rules and Node runtime.
- Installed `@react-pdf/renderer@4.5.1`; representative runtime gate must pass.

## Success Criteria

- [ ] Action states, accessibility, and new-tab behavior match the approved placement.
- [ ] Endpoint enforces access and returns valid PDF headers or stable non-PDF errors.
- [ ] Nested data, empty-value labels, and ID omissions are verified.
- [ ] Each group is labeled and nested; reconstitution appears within its presentation.
- [ ] `PENDING` warns on every page; `APPROVED` shows only its badge.
- [ ] Representative multi-page runtime measurements are acceptable.
