# AI Companion: Audit Ledger Persistence, Query, and Access-Control Architecture

## Purpose

Story 18.2.8 architecture baseline for canonical audit write/read workflows, append invariants, permission-aware query/detail retrieval, redacted detail shaping, linkage/correlation traversal, and retention lifecycle seams.

Canonical human doc: `docs/architecture/audit-ledger-persistence-query-and-access-control-architecture.md`

Related hardening note: `docs/architecture/audit-observability-failure-handling-and-redaction-safeguards.md`

## Canonical seams

- Write orchestration:
  - `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
  - `src/application/audit/shared/AuditReferenceNormalization.ts`
  - `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
- Durable append port and repository:
  - `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
  - `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
  - `src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts`
- Query and authorization:
  - `src/application/audit/use-cases/AuditLedgerQueryService.ts`
  - `src/application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer.ts`
- Governance/admin projection shaping:
  - `src/application/audit/use-cases/AuditGovernanceProjectionQueryService.ts`
  - supports projection-policy injection seams for deployment-profile shaping, broader governance facet logic, and future compliance/export explanatory notes
- Authoritative retrieval APIs:
  - `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`
  - `src/infrastructure/transport/http-server/authoritative-route-families/AuditAuthoritativeApiRoutes.ts`
- Shared contracts/DTO projection:
  - `src/shared/contracts/audit/AuditEventContracts.ts`
  - `src/shared/dto/audit/AuditEventDtos.ts`
- Retention config seam:
  - `src/infrastructure/config/AuditRetentionLifecycleConfig.ts`
  - supports profile-scoped retention default resolution with global fallback

## Required behavior reminders

- Append only through `IAuditLedgerRepository.appendAuditEvent(...)`.
- Keep `operationKey` replay/idempotency behavior intact.
- Preserve immutable-enough safeguards: no `UPDATE`/`DELETE`, hash-chain continuity enforcement.
- Keep read authorization and scope intersection in `AuditLedgerQueryService` + `WorkspaceAuditLedgerReadAuthorizer`.
- Keep governance/admin projection shaping in `AuditGovernanceProjectionQueryService` (application boundary), not UI pages/services.
- Keep non-admin detail responses `user-safe`; only admin scope may receive `adminOnlyDetails`.
- Keep linkage/correlation and retention/lifecycle filters in query contract/repository mapping.
- Retention remains `metadata-only`; destructive actions stay disabled.

## Prohibited shortcuts

- No UI/controller direct canonical writes.
- No bypass of authoritative recording service for new canonical events.
- No bypass of query service/authorizer for privileged reads.
- No non-admin exposure of `adminOnlyDetails`.
- No destructive retention delete/archive jobs in this story slice.

## Tests

- `src/application/audit/tests/AuditLedgerPersistenceQueryAccessDocumentation.test.ts`
- `src/application/audit/tests/AuthoritativeAuditRecordingService.test.ts`
- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/application/audit/tests/WorkspaceAuditLedgerReadAuthorizer.test.ts`
- `src/application/audit/tests/AuditLedgerProductionReadinessRegression.integration.test.ts`

## Story 18.3.6 hardening delta

Final production-readiness regression now includes integrated lifecycle coverage for:

- authoritative capture -> durable append -> query/access-control -> realtime publication
- append replay invariants and immutable-enough update/delete rejection
- permission-safe detail/list shaping (`user-safe` vs `admin`)
- startup reconciliation follow-up signaling for orphaned replay anomalies

Deferred edges are unchanged:

- retention remains metadata-only (destructive jobs disabled)
- external notarization/compliance export remains future scope

