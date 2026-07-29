# Product PDF Review Specification

## Purpose

Provide non-persisted printable review of persisted Product data.

## Requirements

### Requirement: Persisted-product review action

Persisted Product editors MUST place **Ver en PDF** before **Guardar**. They MUST hide it on creation, disable it while dirty with save guidance, expose accessible name/status, and open the same-origin PDF in a new tab without an opener.

#### Scenario: Clean persisted product

- GIVEN a clean persisted Product
- WHEN Ver en PDF is selected
- THEN its endpoint opens in a new tab

#### Scenario: Create or dirty editor

- GIVEN creation or dirty editing
- WHEN controls appear
- THEN the action is hidden or disabled with accessible guidance

### Requirement: Authorized, atomic on-demand response

The endpoint MUST require authentication/Product read access, use persisted state only, never mutate/persist data, and return a complete PDF or concise atomic non-PDF error. It MUST return 401 unauthenticated; 404 invalid, missing, or inaccessible.

#### Scenario: Authorized request

- GIVEN an authorized reader and persisted Product
- WHEN the PDF is requested
- THEN a complete PDF represents that persisted state

#### Scenario: Denied or incomplete request

- GIVEN authentication, access, ID, graph, or rendering fails
- WHEN the PDF is requested
- THEN no partial PDF or clinical payload returns

### Requirement: Private inline delivery

Success MUST set `application/pdf`, inline sanitized filename, `private, no-store`, and `X-Content-Type-Options: nosniff`; errors MUST omit PDF headers/bodies.

#### Scenario: Successful delivery headers

- GIVEN successful generation
- WHEN inspected
- THEN delivery is inline, private, non-cacheable, type-safe

### Requirement: Complete review graph

PDF MUST contain the complete persisted Product graph loaded at depth 5. Unresolved required relationships or remaining IDs MUST fail atomically, never yield an incomplete review.

#### Scenario: Unresolved nested relationship

- GIVEN a zone, route, or technique remains an ID
- WHEN PDF is requested
- THEN generation returns a stable atomic error

### Requirement: Document content and omissions

The PDF MUST include Header/traceability (canonical name, Product ID, status/notes, created/updated dates); General (type, laboratory, active ingredients, aliases); Clinical Safety (contraindications, adverse effects); and Presentations (name, status, aliases, clinical notes, reconstitution, protocols). Every Protocol MUST show `name`, `zones`, `routes`, `techniques`, `sessionsMin`, `sessionsMax`, and `frequency`. It MUST omit Protocol, zone, route, and technique IDs/timestamps plus array-row IDs; Product `id`, `createdAt`, and `updatedAt` MUST remain visible.

#### Scenario: Complete Protocol review

- GIVEN Protocol fields plus sentinel Protocol/nested metadata
- WHEN the PDF renders
- THEN seven fields/traceability are visible; sentinel metadata is absent

### Requirement: Nested Payload groups

Each actual Payload `type:'group'` in the printable model MUST render as a labeled subsection within its owner. Groups MUST be statically known, never schema-reflected. `reconstitution` MUST appear within its presentation under **Reconstitución / Dilución**, showing Tipo de diluyente, Volumen (mL), and Instrucciones with explicit empty-value treatment.

#### Scenario: Reconstitution hierarchy

- GIVEN complete or empty presentation reconstitution
- WHEN the PDF renders
- THEN labeled subsection appears under the presentation with three explicit labeled values

### Requirement: Explicit data and validation status

Missing scalars MUST render **No informado** and empty collections **Sin registros**. `PENDING` MUST show **PENDIENTE DE VALIDACIÓN — NO APROBADO** on every page. `APPROVED` MUST show an Aprobado header badge and MUST NOT show the pending warning.

#### Scenario: Multi-page pending document

- GIVEN a representative multi-page PENDING Product
- WHEN the PDF renders
- THEN every page shows the warning; Spanish accents remain legible

#### Scenario: Approved document

- GIVEN an APPROVED Product with empty values
- WHEN the PDF renders
- THEN explicit empties and only approved treatment appear

### Requirement: Evolution and representative rendering

PDF coverage MUST match supported schema. New clinical, functional, or group fields MUST add document coverage/tests. Multi-page output MUST preserve nested content, hierarchy, and status. Dedicated E2E MUST NOT be required.

#### Scenario: Schema evolution

- GIVEN new clinical, functional, or group field
- WHEN PDF support releases
- THEN mapping/coverage update before claiming completeness
