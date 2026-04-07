# Audit Observability, Failure Handling, and Redaction Safeguards

## Story alignment

- Feature 18: Audit, Governance, and Security Event Ledger
- Epic 18.3: Deliver Governance Visibility, Event Streaming, and Production Hardening for the Audit Ledger
- Story 18.3.3: Implement audit observability, failure handling, and sensitive-data redaction safeguards

## Purpose

Harden the audit stack itself so write/read paths emit structured diagnostics with correlation context, query/write failures are explicit and stable, and operational telemetry never leaks secret/prompt/raw-path payload fragments.

## Canonical implementation seams

- Centralized audit operational redaction:
  - `src/application/audit/shared/AuditOperationalSignalRedaction.ts`
- Authoritative write-path observability + explicit append-failure handling:
  - `src/application/audit/ports/AuditLedgerObservabilityPorts.ts`
  - `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- Query-path explicit failure outcomes:
  - `src/application/audit/use-cases/AuditLedgerQueryService.ts`
- Infrastructure structured logging + metrics adapter for audit operations:
  - `src/infrastructure/api/audit/AuditLedgerObservability.ts`
- Audit API boundary diagnostics and query failure mapping:
  - `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`
- Host wiring:
  - `src/hosts/server/IdentityServerHost.ts`

## Structured diagnostics model

- Write operations emit `audit-ledger.write.completed` / `audit-ledger.write.failed`.
- Query operations emit `audit-ledger.query.completed` / `audit-ledger.query.failed`.
- Diagnostics include correlatable identifiers when available (`correlationId`, `requestId`, `workspaceId`, `eventId`, actor identity).
- Counter-style metadata captures representative operational dimensions (for example returned rows, total rows, sequence, protected-data/redaction counts).

## Redaction safeguards

Operational redaction is centralized and reused for audit-facing diagnostics:

- sensitive key masking (`secret`, `token`, `credential`, prompt/completion/message payload fields, raw content/path/url fields),
- string-level fragment redaction (Bearer tokens, secret assignments, prompt fragments),
- raw filesystem path masking (Windows and Unix path patterns),
- bounded array/string normalization for diagnostic payloads.

The authoritative write payload sanitizer additionally uses this string redaction layer so prompt/path fragments are not preserved in canonical audit detail boundaries.

## Failure-handling posture

- Authoritative append failures are explicit (`AuditDomainError("Authoritative audit append failed.")`) and emit sanitized failure diagnostics.
- Query read failures in `AuditLedgerQueryService` return explicit `audit-ledger-query-failed` outcomes instead of bubbling unhandled exceptions.
- `AuditLedgerBackendApi` maps query-failed outcomes to stable API `internal` responses and records structured failure diagnostics.
- Observability/logging/metrics emissions are intentionally non-blocking and cannot alter authoritative write or read control flow.

## Tests

- `src/application/audit/tests/AuditOperationalSignalRedaction.test.ts`
- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/infrastructure/api/audit/tests/AuditLedgerBackendApi.test.ts`
- `src/infrastructure/api/audit/tests/AuditLedgerObservability.test.ts`
