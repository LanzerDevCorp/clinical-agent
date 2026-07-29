## Exploration: Product PDF review

### Current State
`Products` has the complete persisted graph required by the proposal: product audit fields, clinical relationships, presentations, reconstitution, and protocols whose zones, routes, and techniques are nested relationships. Payload 3.85.1 exposes both `admin.components.edit.beforeDocumentControls` and collection `endpoints`; its generated REST catch-all already mounts collection endpoints beneath `/api/products`. No product PDF endpoint or review action exists. The installed `@react-pdf/renderer` is version 4.5.1 and is a production dependency; it declares React 19 support. An in-memory Node 24.15.0 spike with the installed React 19.2.6 rendered a valid `%PDF` buffer.

### Affected Areas
- `src/collections/Products.ts` — register `beforeDocumentControls` and `GET /:id/pdf` collection endpoint.
- `src/components/ProductPdfAction.tsx` (new) — client control using `useDocumentInfo().id` and `useFormModified()`; hidden without a persisted ID, disabled while dirty, and opens the same-origin URL in a new tab.
- `src/lib/product-pdf/*` (new) — typed persisted-graph guard, explicit view model, missing-value formatting, safe filename, and React-PDF document/layout.
- `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` — regenerated Payload artifacts after the collection component registration.
- `tests/int/*` and `tests/e2e/*` — endpoint/PDF data-access tests plus admin-state coverage; no Product fixture currently exists.

### Constraints and Coupling
- Endpoint form: `Products.endpoints = [{ path: '/:id/pdf', method: 'get', handler }]`, yielding `GET /api/products/:id/pdf`; obtain the ID from `req.routeParams.id`.
- Custom endpoints are not authenticated automatically: reject absent `req.user`, then call `req.payload.findByID({ collection: 'products', id, depth: 2, req, overrideAccess: false })` so Product read access remains authoritative.
- `depth: 2` is necessary for protocol zones/routes/techniques. The generated `Product` type deliberately permits numeric relationship IDs, so the mapper must reject unpopulated required related records instead of presenting incomplete data.
- The generated Payload REST catch-all must remain untouched. The React-PDF code must be server-only: its browser build deliberately throws for `renderToBuffer`; the existing catch-all runs in the default Node runtime.
- `validationStatus` currently has only `PENDING | APPROVED` in the source schema/types. Render the specified fixed warning on every page only for `PENDING`, and the approved badge only for `APPROVED`.
- Product audit metadata (`id`, `createdAt`, `updatedAt`) is displayable. Omit relationship IDs, array row IDs, and related-record timestamps. Scalars use `No informado`; collections use `Sin registros`.
- `openspec/config.yaml`, `openspec/specs/`, and this change's `state.yaml` are absent. Per the explore executor boundary, only `exploration.md` was created; state initialization remains the orchestrator's responsibility.

### Approaches
| Approach | Pros | Cons | Complexity |
|---|---|---|---|
| React-PDF server renderer (recommended) | Existing production dependency; React 19 peer support; valid Node buffer spike; declarative multi-page sections and fixed warning | Requires server-only separation and layout/font regression tests | Medium |
| Playwright HTML-to-PDF | Familiar HTML/CSS | Browser runtime is dev-only, heavy, and operationally unsuitable | High |
| pdf-lib/PDFKit primitives | Direct primitive control | Manual pagination, wrapping, repeated status notices, and nested layout | High |

### Recommendation
Keep the ADR's React-PDF decision, but remove its premise that the package must be added: version 4.5.1 is already resolved and compatible with React 19. Implement a typed server-only mapper/validator first, expose it through the authenticated Payload collection endpoint, and add the client control via `beforeDocumentControls`. Use `renderToBuffer` initially; preserve `private, no-store`, `nosniff`, and inline `Content-Disposition` headers. The remaining compatibility gate is a representative multi-page product under the deployment Node runtime, including accented text and the fixed warning.

### Risks
- The current test suite has no Product graph fixture or endpoint harness, so strict TDD requires new fixtures and tests before implementation.
- `renderToBuffer` buffers the entire document; measure the largest product before considering streaming.
- The package uses a browser export that rejects Node rendering APIs; any client-side or mixed import will fail.
- Generated Payload types/import map are concurrent-work-sensitive and must be regenerated only after the schema/component change is finalized.

### Forecast
Expected implementation: roughly 330–390 authored changed lines across the endpoint, server-only mapper/PDF document, admin action, regenerated artifacts, and focused tests. This is within the 400-line review budget but leaves little contingency; keep the PDF module compact and split only if test fixtures or layout styling push the forecast above the budget.

### Ready for Proposal
Yes. The implementation path, extension APIs, access model, renderer compatibility, and unresolved runtime/layout gate are sufficiently defined for `sdd-propose`.
