# Clinical Product Query Specification

## Purpose

Provide authenticated internal users approved clinical product discovery, details, and protocol-sharing decisions sourced only from Payload.

## Requirements

### Requirement: Internal-user authorization

The system MUST serve queries only to authenticated internal users with read access and MUST deny all others without confirming product existence or returning clinical data.

#### Scenario: Authorized requester

- GIVEN an authenticated internal user with read access
- WHEN the user submits a valid product query
- THEN the query is evaluated within that user's permissions

#### Scenario: Unauthorized requester

- GIVEN a requester is unauthenticated, non-internal, or unauthorized
- WHEN the requester submits a clinical product query
- THEN the system returns a safe denial without product or access internals

### Requirement: Approved-data boundary

The system MUST expose only accessible, approved products and presentations. It MUST exclude all other records without returning their clinical data.

#### Scenario: Approved accessible data

- GIVEN an accessible approved product with an approved presentation
- WHEN it matches a query
- THEN only its approved, contract-defined data is available

#### Scenario: Ineligible data

- GIVEN matching data is unapproved, inaccessible, or lacks an approved presentation
- WHEN it is queried
- THEN the system returns its stable unavailable outcome without clinical content

### Requirement: Broad discovery with clarification

Discovery MUST match canonical names, aliases, presentation names, and partial names. Multiple plausible products or presentations MUST produce explicit clarification choices; the system MUST NOT select implicitly.

#### Scenario: Unique broad match

- GIVEN one eligible product and presentation match a canonical, alias, presentation, or partial-name query
- WHEN discovery runs
- THEN it returns the stable product identity and eligible presentation summary

#### Scenario: Ambiguous products

- GIVEN a query plausibly matches multiple products
- WHEN discovery runs
- THEN it returns explicit product choices and requests clarification

#### Scenario: Ambiguous presentations

- GIVEN a product match has multiple plausible presentations
- WHEN discovery runs
- THEN it returns explicit presentation choices and requests clarification

### Requirement: Stable bounded details

Detail retrieval MUST use a discovered product identity and an explicit presentation when required. It MUST return only contract-defined approved fields, never raw CMS records or unrelated data.

#### Scenario: Exact detail retrieval

- GIVEN a discovered product identity and resolved presentation
- WHEN details are requested
- THEN the system returns the corresponding stable bounded detail result

#### Scenario: Invalid or stale identity

- GIVEN an unknown, stale, mismatched, or inaccessible identity
- WHEN details are requested
- THEN the system returns a safe unavailable result without record contents

### Requirement: Individual protocol shareability

The system MUST authorize client sharing separately for each protocol. Approval of a product or presentation MUST NOT imply that any protocol is client-shareable.

#### Scenario: Shareable protocol

- GIVEN an approved accessible protocol is explicitly authorized for client sharing
- WHEN its client-shareability is checked
- THEN the system returns an affirmative decision for that protocol only

#### Scenario: Non-shareable protocol

- GIVEN a protocol is absent, inaccessible, unapproved, or not explicitly client-shareable
- WHEN its client-shareability is checked
- THEN the system returns a safe negative decision without protocol instructions

### Requirement: Safe query outcomes

The system MUST provide stable outcomes for no match, inaccessible or unapproved data, malformed input, and transient failure. Outcomes MUST NOT expose exceptions, storage details, or partial records.

#### Scenario: Empty result

- GIVEN a valid query has no eligible match
- WHEN discovery completes
- THEN the system returns a stable empty result

#### Scenario: Malformed request

- GIVEN required input is missing or invalid
- WHEN a query is submitted
- THEN the system returns a stable invalid-request outcome without querying clinical data

#### Scenario: Transient failure

- GIVEN the clinical source temporarily fails
- WHEN a query is evaluated
- THEN the system returns a stable temporary-failure outcome without partial data or internals

### Requirement: Payload-only v1 source

Payload MUST be the sole v1 source. The system MUST NOT read or fall back to Markdown, JSON registries, static mappings, or RAG.

#### Scenario: Payload unavailable with legacy data present

- GIVEN Payload is unavailable and matching legacy-source data exists
- WHEN a clinical product query runs
- THEN the system returns the temporary-failure outcome without consulting the legacy source
