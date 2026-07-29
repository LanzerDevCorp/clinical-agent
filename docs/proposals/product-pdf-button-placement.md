# Product PDF Action Placement Proposal

**Status:** Proposed  
**Date:** 2026-07-29  
**Audience:** Clinical operations, product administrators, and implementers

## Recommendation

Add a secondary action labeled **“Ver en PDF”** immediately before the existing **Guardar** control in the Product edit view.

Register the client component through:

```text
Products.admin.components.edit.beforeDocumentControls
```

This placement makes the PDF a document-level review action: it is easy to find when an administrator finishes inspecting or editing a product, while remaining visually subordinate to saving.

## Placement evidence

The current Product screen separates the global document controls from the editable tabs:

```text
Document control bar                              [Ver en PDF] [Guardar] [⋮]
────────────────────────────────────────────────────────────────────────────
Product fields and tabs
```

Payload exposes `beforeDocumentControls` for controls rendered before the document actions. This matches the requested position without inserting a review action into a particular product tab or into the navigation header.

The action belongs here because the generated document represents the entire persisted product graph—not only the visible **General**, **Seguridad Clínica**, or **Presentaciones** tab.

## Interaction states

| Product state | Action behavior | User feedback |
| --- | --- | --- |
| Creating a new product | Hidden | A persisted product ID does not exist yet. |
| Existing product, no unsaved changes | Enabled | Opens the PDF inline in a new browser tab. |
| Existing product with unsaved changes | Disabled | Tooltip or helper text: **“Guarda los cambios para actualizar el PDF.”** |
| PDF request in progress | The new tab shows the browser loading state | Do not replace the current edit screen. |
| PDF generation fails | The new tab shows a concise error response | The Product form and its unsaved state remain untouched. |

The client component should use Payload's `useDocumentInfo()` to determine whether a persisted Product ID exists and `useFormModified()` to disable the action when the form is dirty. The action URL should remain same-origin and use `target="_blank"` with `rel="noopener noreferrer"`.

## Interaction flow

1. An administrator opens an existing Product.
2. The component obtains the persisted document ID and current dirty state.
3. If the form is modified, **“Ver en PDF”** remains disabled until **Guardar** succeeds.
4. The administrator selects **“Ver en PDF”**.
5. A new tab requests `GET /api/products/:id/pdf` using the current authenticated session.
6. The browser renders the response inline and retains its native print and download controls.

This flow guarantees that the PDF reflects the latest saved API state. It never attempts to serialize temporary form values.

## Visual treatment

- Use the standard secondary button treatment already used by the admin UI.
- Keep the label visible; do not reduce the action to an icon because PDF review is a primary operational task.
- Preserve the control order: **Ver en PDF**, **Guardar**, overflow menu.
- Maintain keyboard focus, disabled semantics, and an accessible name equal to the visible label.
- Do not imply that opening the PDF validates, approves, or saves the Product.

## Acceptance criteria

- **“Ver en PDF”** is rendered immediately before **Guardar** on an existing Product edit view.
- The action is not rendered while creating a Product.
- The action is disabled whenever Payload reports unsaved form changes.
- The disabled state explains that the Product must be saved before the PDF can be updated.
- Selecting the enabled action opens `/api/products/:id/pdf` in a new tab.
- The edit view remains open and retains its current tab and form state.
- The browser receives an inline PDF rather than an automatic attachment download.
- The action is keyboard-operable and exposes correct accessible disabled behavior.
- Component tests cover hidden-on-create, enabled-on-clean, disabled-on-dirty, and new-tab navigation states.

## Alternatives not selected

### Beside “Editar” and “API” in the upper navigation header

This location has strong visibility, but it mixes a Product-specific review operation with navigation and mode-switching controls. It also places the action farther from **Guardar**, weakening the important persisted-state relationship.

### Inside the three-dot overflow menu

This keeps the toolbar compact, but makes a frequent audit action harder to discover and adds an unnecessary interaction. It is better suited to infrequent or destructive operations.

### Inside one Product tab

This would incorrectly associate the PDF with only one section and require users to remember which tab contains the action. The PDF covers the complete Product, so the document control bar is the correct scope.

