# Streaming Clinical-Agent Backend Specification

## Purpose

Provide internal users streamed Flow-1 clinical guidance without application retention.

## Requirements

### Requirement: Authenticated bounded admission

The system MUST resolve an authenticated internal Payload-session user before body parsing or provider/tool work. It MUST reject over 256 KiB, over 40 messages, request 61 per user/hour, and concurrent request 3 per user.

#### Scenario: Admission boundary

- GIVEN an internal user is at 59/hour and one concurrent request
- WHEN request 60 has 40 messages totaling 256 KiB
- THEN concurrent request 2 MAY proceed

#### Scenario: Admission denial

- GIVEN authentication fails or an admission maximum is exceeded
- WHEN the request arrives, even malformed
- THEN denial MUST precede parsing and provider/tools

### Requirement: Fixed available model

Deployment MUST confirm `deepseek/deepseek-v4-flash` in the Gateway catalog and MUST fail closed without fallback if unavailable or unverifiable.

#### Scenario: Catalog preflight

- GIVEN the exact model is cataloged
- WHEN preflight runs
- THEN deployment MAY use only that model

#### Scenario: Model unavailable

- GIVEN the model is absent or unverifiable
- WHEN preflight runs
- THEN deployment MUST fail without a fallback

### Requirement: Bounded streaming execution

Per request, the system MUST enforce 4096 output tokens, 12 steps, 8 tool calls, 4 detail calls, 150 seconds total, 45 seconds to first chunk, and 30 seconds per tool.

#### Scenario: Exact boundaries

- GIVEN all listed maxima are met exactly
- WHEN the request completes
- THEN its bounded stream MUST return

#### Scenario: Execution limit exceeded

- GIVEN any execution maximum would be exceeded
- WHEN its boundary is reached
- THEN further work MUST stop safely and structurally

#### Scenario: Tool timeout

- GIVEN a tool remains incomplete at 30 seconds
- WHEN its deadline expires
- THEN structured temporary failure MUST result

### Requirement: Pre-stream retry boundary

The system MAY retry at most once only when a retryable transient provider failure occurs before the first stream chunk. It MUST NOT retry permanent or non-retryable failures, including invalid credentials, invalid requests, unavailable or unverified models, and policy rejections. It MUST NOT retry after any stream chunk has been emitted. If the optional retry fails, the system MUST return or terminate with the safe structured failure contract.

#### Scenario: Transient pre-stream failure

- GIVEN a retryable transient provider failure occurs before the first stream chunk
- WHEN the system applies its optional retry
- THEN it MAY retry at most once
- AND if that retry fails, it MUST return the safe structured failure contract

#### Scenario: Permanent pre-stream failure

- GIVEN an invalid credential, invalid request, unavailable or unverified model, or policy rejection occurs before the first stream chunk
- WHEN the failure is classified as permanent or non-retryable
- THEN the system MUST NOT retry and MUST return the safe structured failure contract

#### Scenario: Post-start failure

- GIVEN any stream chunk has been emitted
- WHEN any provider failure occurs
- THEN the system MUST NOT retry and MUST terminate with the safe structured failure contract

### Requirement: Clinical tool boundary

Tools MUST return only authorized Flow-1 DTOs. Ambiguous, unavailable, unauthorized, and temporary failures MUST remain safe and structured; absent facts MUST NOT be inferred.

#### Scenario: Authorized tool result

- GIVEN Flow 1 returns an authorized approved DTO
- WHEN it is consumed
- THEN only its fields MAY inform output

#### Scenario: Non-success tool result

- GIVEN Flow 1 returns ambiguity, unavailable, unauthorized, or temporary failure
- WHEN it is consumed
- THEN it MUST remain safe without inference or hidden data

### Requirement: Audience validation

The typed artifact MUST separately validate internal/executive and client-shareable sections without an LLM auditor. Client content MUST honor per-protocol Flow-1 authorization.

#### Scenario: Valid artifact

- GIVEN authorized DTOs support both sections
- WHEN generation completes
- THEN each MUST pass independent type and safety validation

#### Scenario: Invalid section

- GIVEN a section is invalid or a protocol unshareable
- WHEN validation runs
- THEN it MUST fail without auditor use or client leakage

### Requirement: Privacy and scope

The system MUST NOT persist product telemetry, prompts, responses, tokens, or errors. Emitted errors MUST be redacted with opaque request IDs. It MUST NOT provide Flow 3 persistence, Flow 4 UI, external-client access, Prisma/filesystem sources, or `validateProductData`.

#### Scenario: Private failure

- GIVEN bounded processing fails
- WHEN an operational error is emitted
- THEN it MUST be redacted, opaque-ID-labeled, and not application-retained

#### Scenario: Excluded scope

- GIVEN an external request or a completed internal request
- WHEN scope is evaluated
- THEN external access MUST be denied and excluded features MUST NOT be used
