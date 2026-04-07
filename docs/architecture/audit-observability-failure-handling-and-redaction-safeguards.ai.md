# AI Companion: Audit Observability, Failure Handling, and Redaction Safeguards

## Purpose

Story 18.3.3 hardens audit write/read operations with structured diagnostics, explicit failure outcomes, and centralized redaction so the audit stack does not become a leakage surface.

Human doc: `docs/architecture/audit-observability-failure-handling-and-redaction-safeguards.md`

## Canonical seams

- `src/application/audit/shared/AuditOperationalSignalRedaction.ts`
- `src/application/audit/ports/AuditLedgerObservabilityPorts.ts`
- `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- `src/application/audit/use-cases/AuditLedgerQueryService.ts`
- `src/infrastructure/api/audit/AuditLedgerObservability.ts`
- `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Behavior summary

- write path emits structured `audit-ledger.write.*` diagnostics with correlation/request/workspace context when available
- read/query path emits structured `audit-ledger.query.*` diagnostics for list/detail and governance projections
- write append failures become explicit audit-domain failures and include sanitized diagnostics for operators
- query service converts repository/authorizer throw paths into explicit `audit-ledger-query-failed` outcomes
- API maps query-failed outcomes to stable `internal` responses
- observability and metrics publication remain best-effort and non-blocking
- centralized audit operational redaction masks secrets/prompts/raw paths/unsafe payload fragments

## Tests

- `src/application/audit/tests/AuditOperationalSignalRedaction.test.ts`
- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/infrastructure/api/audit/tests/AuditLedgerBackendApi.test.ts`
- `src/infrastructure/api/audit/tests/AuditLedgerObservability.test.ts`
