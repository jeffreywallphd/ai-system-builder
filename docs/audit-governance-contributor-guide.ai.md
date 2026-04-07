# AI Companion: Audit Governance Contributor Guide

## Purpose

Contributor quick-reference for extending audit event taxonomy/capture safely and consistently.

Canonical human doc: `docs/audit-governance-contributor-guide.md`

## Canonical implementation seams

- taxonomy/domain: `src/domain/audit/AuditDomain.ts`, `src/application/audit/AuditApplicationContracts.ts`
- authoritative capture: `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`, `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- durable ledger persistence: `src/application/audit/ports/AuditLedgerPersistencePorts.ts`, `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
- application retrieval: `src/application/audit/use-cases/AuditLedgerQueryService.ts`, `src/application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer.ts`
- shared contracts: `src/shared/contracts/audit/AuditEventContracts.ts`, `src/shared/dto/audit/AuditEventDtos.ts`, `src/shared/schemas/audit/AuditEventSchemaContracts.ts`
- source adapters: `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`, `src/infrastructure/audit/AuthoritativeSchedulingGovernanceEventSink.ts`, `src/infrastructure/audit/AuthoritativeStorageManagementAuditSink.ts`, `src/infrastructure/audit/AuthoritativeSecretAccessAuditHook.ts`

## Must-follow rules

- Emit new canonical audit events through authoritative recording ports/service.
- Keep action namespace and taxonomy alignment consistent with `resolveAuditCategoryForAction(...)`.
- Keep UI/transport write paths out of canonical audit append workflows.
- Keep audit read authorization/scope evaluation in application query services, not UI state services.
- Keep audit detail visibility shaping (`user-safe` vs `admin`) in application authorizer/query services, not controllers/pages.
- Never place raw secret/prompt/path/credential material in ledger payload details.

## Tests

- `src/application/audit/tests/AuditTaxonomyExtensionDocumentation.test.ts`

