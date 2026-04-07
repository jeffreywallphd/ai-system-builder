# AI Companion: Audit Governance Contributor Guide

## Purpose

Contributor quick-reference for extending audit event taxonomy/capture safely and consistently.

Canonical human doc: `docs/audit-governance-contributor-guide.md`

Related architecture baseline: `docs/architecture/audit-ledger-persistence-query-and-access-control-architecture.md`

## Canonical implementation seams

- taxonomy/domain: `src/domain/audit/AuditDomain.ts`, `src/application/audit/AuditApplicationContracts.ts`
- authoritative capture: `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`, `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- durable ledger persistence: `src/application/audit/ports/AuditLedgerPersistencePorts.ts`, `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
- application retrieval: `src/application/audit/use-cases/AuditLedgerQueryService.ts`, `src/application/audit/use-cases/AuditGovernanceProjectionQueryService.ts`, `src/application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer.ts`
- shared contracts: `src/shared/contracts/audit/AuditEventContracts.ts`, `src/shared/dto/audit/AuditEventDtos.ts`, `src/shared/schemas/audit/AuditEventSchemaContracts.ts`
- source adapters: `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`, `src/infrastructure/audit/AuthoritativeSchedulingGovernanceEventSink.ts`, `src/infrastructure/audit/AuthoritativeStorageManagementAuditSink.ts`, `src/infrastructure/audit/AuthoritativeSecretAccessAuditHook.ts`
- observability/failure-hardening: `src/application/audit/shared/AuditOperationalSignalRedaction.ts`, `src/application/audit/ports/AuditLedgerObservabilityPorts.ts`, `src/infrastructure/api/audit/AuditLedgerObservability.ts`, `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`

## Must-follow rules

- Emit new canonical audit events through authoritative recording ports/service.
- Keep action namespace and taxonomy alignment consistent with `resolveAuditCategoryForAction(...)`.
- Keep UI/transport write paths out of canonical audit append workflows.
- Keep audit read authorization/scope evaluation in application query services, not UI state services.
- Keep audit detail visibility shaping (`user-safe` vs `admin`) in application authorizer/query services, not controllers/pages.
- Keep list/detail retrieval ownership in `AuditLedgerQueryService` plus `WorkspaceAuditLedgerReadAuthorizer`, and governance/admin projection shaping ownership in `AuditGovernanceProjectionQueryService`, not transport/UI reimplementations.
- Use `AuditGovernanceProjectionQueryService` projection-policy seams for deployment-profile-specific governance view growth and compliance/export note shaping, rather than introducing controller/UI branching.
- Never place raw secret/prompt/path/credential material in ledger payload details.
- Never place raw secret/prompt/path/credential material in audit observability logs or failure details.
- Keep retention lifecycle behavior metadata-only in this slice; do not add destructive retention jobs.
- Do not ship placeholder compliance-export endpoints or fake profile toggles; add only real seams that preserve current behavior.

## Tests

- `src/application/audit/tests/AuditTaxonomyExtensionDocumentation.test.ts`

