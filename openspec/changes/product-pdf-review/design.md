# Design: Product PDF Review

## Technical Approach

Expose Payload `GET /api/products/:id/pdf`. Pure mapping retains Product `id`, `createdAt`, and `updatedAt` while omitting related/row IDs; `server-only` modules buffer the PDF atomically. A Payload client component supplies the action.

## Architecture Decisions

| Decision | Choice and rationale | Rejected alternative |
|---|---|---|
| Server boundary | Pure `model.ts` omits `server-only`. Runtime-bound `endpoint.ts` and `document.tsx` import it; only the latter imports React-PDF. Vitest aliases the marker to `tests/stubs/server-only.ts` (`export {}`), preserving production enforcement while enabling tests. | A marked model blocks pure tests; client rendering exposes data and dependencies. |
| Exposure boundary | `toProductPdfViewModel(Product)` is the rendering whitelist. It validates every used relationship as populated; any ID-only value returns a typed incomplete-graph failure. It retains only Product `id`, `createdAt`, and `updatedAt`, omitting relationship/row IDs and related timestamps. | Raw Payload records risk exposure and silent omissions. |
| Atomic buffering | Render with installed `@react-pdf/renderer@4.5.1` to a buffer before creating the response. | Streaming complicates atomic failure; persistence conflicts with on-demand scope. |
| Admin integration | Register `@/components/ProductPdfAction` under `admin.components.edit.beforeDocumentControls`. The client component uses `useDocumentInfo()` and `useFormModified()`: hide without a persisted ID, disable and explain while modified, otherwise open the encoded same-origin URL using `_blank` plus `noopener,noreferrer` and clear `opener`. | Replacing SaveButton couples the feature to core save behavior. |

## Data Flow

`ProductPdfAction -> /api/products/:id/pdf -> req.payload.findByID -> graph validator/mapper -> ProductPdfDocument -> buffer -> inline Response`

The endpoint rejects missing `req.user` with 401. It calls `findByID({ collection: 'products', id, depth: 5, user: req.user, req, overrideAccess: false })`; invalid, missing, forbidden, and inaccessible results become indistinguishable 404 responses. Incomplete graphs return stable 422 and render failures stable 500 JSON errors, without clinical details or PDF headers. Success sets `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<safe>.pdf"`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and `Content-Length`.

Filename generation normalizes to ASCII, hyphenates non-alphanumerics, trims, caps at 80 characters, and falls back to sanitized `producto-<id>`; CR/LF, quotes, separators, and traversal tokens cannot reach headers.

## Document Contract

The whitelist maps traceability, General, Clinical Safety, Presentations, and Protocol fields `name`, `zones`, `routes`, `techniques`, `sessionsMin`, `sessionsMax`, `frequency`. Before Protocols, `document.tsx` reads the existing `presentation.reconstitution` view model and renders a nested, pageable **Reconstitución / Dilución** subsection with `diluentType`, `volumeMl`, and `instructions`. No Payload schema reflection or presentation/group-level `wrap={false}` is used. Protocol/nested IDs and timestamps are omitted. Absent scalars use `No informado`; empty arrays use `Sin registros`. `PENDING` adds the fixed warning on every page; `APPROVED` adds only its header badge. Server fonts preserve Spanish accents.

## File Changes — This Amendment

| File | Action |
|---|---|
| `src/lib/product-pdf/document.tsx` | Modify renderer to add the reconstitution subsection before Protocols. |
| `tests/int/product-pdf.int.spec.ts` | Modify integration coverage with the subsection RED-GREEN case. |

The existing mapper, endpoint, collection, admin action/tests, Vitest configuration, generated types, and import map are context only and unchanged by this amendment.

## Testing Strategy

Strict vertical RED-GREEN-REFACTOR slices preserve prior coverage. Add one integration RED for missing **Reconstitución / Dilución**, then GREEN by rendering its heading and current `diluentType`, `volumeMl`, and `instructions`; refactor only while green. Existing mapper, depth-5 endpoint, action, collection, and generated types remain unchanged. The runtime gate stays a multi-page `%PDF` within 10 seconds and under 256 MiB RSS growth in CI. The current single-PR scope retains maintainer-approved `size:exception`; generated artifacts remain excluded from authored sizing. No E2E is required.

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior | Planned RED tests |
|---|---|---|---|
| Payload HTTP route | Applicable | Encoded ID plus authenticated, authorized lookup; fail atomically with stable non-PDF errors. | Auth, invalid/missing/inaccessible ID, incomplete graph, render failure, success headers. |
| Documentation-like paths | N/A: no path classification, shell, or executable-file handling. | No filesystem execution boundary. | None. |
| Git repository selection | N/A: no Git invocation. | No repository selection. | None. |
| Commit state | N/A: no index/worktree automation. | No commit behavior. | None. |
| Push state | N/A: no remote/ref handling. | No push behavior. | None. |
| PR commands | N/A: no PR or command composition. | No PR behavior. | None. |

## Migration / Rollout

No migration or feature flag is required. Roll back by removing the action, endpoint, and PDF modules, then regenerating types/import map; no stored PDFs or data require cleanup.

## Risks

Integration tests cover action behavior, but exact `beforeDocumentControls` placement remains a residual real-browser verification risk during implementation acceptance.

## Open Questions

None.
