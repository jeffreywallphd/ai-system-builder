# Audit Shared Event Contracts

This note captures Story 18.1.2 for Feature 18 / Epic 18.1.

## Scope

Implemented in this slice:

- canonical shared audit event envelope contracts for cross-layer write/read workflows
- category-specific payload shape contracts for security-sensitive, administrative, sharing, policy, orchestration, and protected-data events
- canonical actor/scope/resource reference contracts, plus redacted summary/detail projection contracts
- shared query/filter/pagination DTO shapes for admin audit review surfaces
- schema-backed validation for canonical event writes and list-query parsing (including repeated-key filter query conventions)
- migration markers on legacy platform audit payload interfaces where canonical shared contracts should be adopted

Out of scope in this slice:

- persistence adapter migration from legacy run-orchestration audit records to canonical event envelopes
- end-to-end UI surface migration to consume canonical audit query DTOs directly
- durable storage implementation for full audit ledger append/query behavior

## Canonical files

- `src/shared/contracts/audit/AuditEventContracts.ts`
- `src/shared/contracts/audit/tests/AuditEventContracts.test.ts`
- `src/shared/dto/audit/AuditEventDtos.ts`
- `src/shared/dto/audit/tests/AuditEventDtos.test.ts`
- `src/shared/schemas/audit/AuditEventSchemaContracts.ts`
- `src/shared/schemas/audit/tests/AuditEventSchemaContracts.test.ts`

## Contract surface summary

Shared audit contracts now define:

- `AuditEventEnvelopeDto` for canonical record exchange across application, persistence, and transport boundaries
- optional `linkage` metadata on envelopes and read projections for event/resource/workflow traversal
- category payload contracts with stable shapes:
  - `SecuritySensitiveAuditCategoryPayloadDto`
  - `AdministrativeAuditCategoryPayloadDto`
  - `SharingAuditCategoryPayloadDto`
  - `PolicyAuditCategoryPayloadDto`
  - `OrchestrationAuditCategoryPayloadDto`
  - `ProtectedDataAuditCategoryPayloadDto`
- redacted read models:
  - `AuditEventSummaryViewDto` (user-safe summary)
  - `AuditEventDetailViewDto` (user-safe/admin visibility boundary)
- shared list query/filter contracts:
  - `AuditEventListFiltersDto`
  - `AuditEventListQueryDto`
  - canonical sorting fields and thin-safe category subset contracts
  - linkage-aware filter selectors (`correlationIds`, `requestIds`, `eventGroupIds`, `rootEventIds`, `parentEventIds`, `workflowIds`, `sessionRefs`, `runIds`, `governanceActionIds`)

## DTO usage notes

Use `src/shared/dto/audit/AuditEventDtos.ts` for canonical payload boundaries:

- write path: `AuditLedgerAppendRequestDto`
- list read path: `AuditLedgerListQueryDto` and `AuditLedgerListResponseDto`
- detail read path: `AuditLedgerGetDetailResponseDto`

Projection helpers (`toAuditLedgerAppendResponseDto`, `toAuditLedgerListResponseDto`, `toAuditLedgerGetDetailResponseDto`) ensure redaction-safe views are emitted by default.

## Schema validation posture

`AuditEventSchemaContracts.ts` enforces boundary-level invariants for:

- actor/scope validity expectations by actor/scope kind
- timestamp integrity (`recordedAt >= occurredAt`)
- category payload consistency (`payload.categoryPayload.category` matches event category)
- redaction posture (`hasProtectedData` with required redaction reasons)
- admin query conventions (bounded pagination, canonical sort fields, repeated-key filter parsing)
- thin-safe list filter constraints when `includeThinSafeOnly` is enabled

## Migration posture

Legacy audit payload definitions under
`src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
remain active for existing orchestration flows but are now explicitly marked as migration-targeted to canonical shared audit contracts.

New audited features should use shared audit contracts/schemas/DTOs in `src/shared/*/audit`.
