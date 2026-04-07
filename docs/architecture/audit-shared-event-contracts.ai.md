# AI Companion: Audit Shared Event Contracts

## Purpose

Story 18.1.2 baseline for Feature 18 / Epic 18.1: establish canonical shared audit envelope/query contracts and schema-backed validation for cross-layer audit write/read workflows.

## Canonical files

- `src/shared/contracts/audit/AuditEventContracts.ts`
- `src/shared/contracts/audit/tests/AuditEventContracts.test.ts`
- `src/shared/dto/audit/AuditEventDtos.ts`
- `src/shared/dto/audit/tests/AuditEventDtos.test.ts`
- `src/shared/schemas/audit/AuditEventSchemaContracts.ts`
- `src/shared/schemas/audit/tests/AuditEventSchemaContracts.test.ts`
- `docs/architecture/audit-shared-event-contracts.md`

## Added contract concepts

- canonical event envelope (`AuditEventEnvelopeDto`) for stable audit record exchange
- category-specific payload contracts across all canonical audit categories
- explicit actor/scope/protected-resource references for portable audit joins
- redacted summary/detail view contracts with user-safe vs admin visibility boundary
- admin-ready list filter/query contracts with shared pagination and sort fields

## Validation posture

Schema contracts enforce:

- actor/scope/category consistency checks
- timestamp order invariants (`recordedAt >= occurredAt`)
- protected-data redaction requirements
- category payload alignment to event category
- list query/filter validation for pagination/sorting/repeated-key filters
- thin-safe category guardrails when thin-safe filtering is enabled

## Migration guidance

Legacy orchestration audit payload types in
`src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
are now marked as migration targets.

Use `src/shared/contracts/audit/*`, `src/shared/dto/audit/*`, and `src/shared/schemas/audit/*`
for new audit workflows and incremental migration slices.
