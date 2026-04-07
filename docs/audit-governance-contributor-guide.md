# Audit Governance Contributor Guide

## Purpose

Provide contributor rules for safely extending audit taxonomy and event capture without violating redaction, governance, or architectural boundaries.

## Canonical docs for this area

- `docs/architecture/audit-domain-foundation.md`
- `docs/architecture/audit-shared-event-contracts.md`
- `docs/architecture/audit-reference-normalization-layer.md`
- `docs/architecture/audit-authoritative-recording-service-and-ports.md`
- `docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md`
- `docs/architecture/audit-durable-ledger-persistence-and-repositories.md`
- `docs/architecture/audit-ledger-persistence-query-and-access-control-architecture.md`

## Required implementation path

1. Confirm action namespace and category mapping:
   - `src/application/audit/AuditApplicationContracts.ts`
   - `src/domain/audit/AuditDomain.ts`
2. Confirm shared event/query contract shape:
   - `src/shared/contracts/audit/AuditEventContracts.ts`
   - `src/shared/dto/audit/AuditEventDtos.ts`
   - `src/shared/schemas/audit/AuditEventSchemaContracts.ts`
3. Emit through authoritative service contracts:
   - `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
   - `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
   - `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
4. Add/update audit query retrieval service and authorization scoping:
   - `src/application/audit/use-cases/AuditLedgerQueryService.ts`
   - `src/application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer.ts`
5. Add/update durable ledger persistence implementation:
   - `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
   - `src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts`
6. Add/update source adapter mapping in infrastructure:
   - `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`
   - `src/infrastructure/audit/AuthoritativeSchedulingGovernanceEventSink.ts`
   - `src/infrastructure/audit/AuthoritativeStorageManagementAuditSink.ts`
   - `src/infrastructure/audit/AuthoritativeSecretAccessAuditHook.ts`
7. Validate review-surface compatibility:
   - `src/ui/services/GovernanceAuditReviewService.ts`
   - `src/ui/shared/admin/GovernanceAuditRedaction.ts`

## Adding a new audit event type

1. Choose `eventType` and stable `action` namespace first.
2. Keep category consistent with `resolveAuditCategoryForAction(...)`; only override category explicitly when needed and justified.
3. Add mapper logic at an existing or new authoritative source adapter.
4. Populate `operationKey`, `actor`, `scope`, `occurredAt`, and optional `protectedResource`.
5. Keep payload split across:
   - `userSafeDetails` for broad governance review
   - `adminOnlyDetails` for restricted diagnostics
6. Verify redaction/protected-data behavior through service tests and adapter tests.

## Capture boundary rules

- Emit from application use-cases/services or infrastructure event adapters only.
- Keep UI and route handlers read/query only for governance review.
- Keep canonical ledger append ownership under `IAuditLedgerRepository` via authoritative service.
- Keep audit retrieval authorization and logical scope enforcement in application query services, not UI state services.
- Keep audit detail visibility (`user-safe` vs `admin`) role-derived in application authorizer/query use cases.

## Audit ledger query/access extension guardrails

- Keep list/detail retrieval routed through `AuditLedgerQueryService`; do not re-implement authorization intersections in transport/UI layers.
- Keep workspace/role-derived scope decisions in `WorkspaceAuditLedgerReadAuthorizer`.
- Keep detail visibility projection delegated to shared DTO contracts (`toAuditEventDetailView(...)`) so admin-only payloads are not leaked.
- Keep retention/lifecycle behavior metadata-only until a dedicated retention workflow story introduces destructive policy operations.

## Redaction and payload rules

- Use identifiers, reason codes, booleans, counts, and bounded summaries.
- Treat `adminOnlyDetails` as restricted but still sanitized; it is not a raw dump sink.
- If protected data is present, ensure `hasProtectedData` and redaction reasons are correctly represented.
- Reuse existing normalized references instead of custom raw resource refs.

## Data/content that must never be recorded

- raw secret values, token strings, passwords, credentials, private key material
- raw prompts, raw completion text, full chat transcripts, raw tool payload bodies
- raw connection strings, raw database URLs, raw local filesystem paths, raw storage object keys
- broad personal data payloads beyond minimum governance need

## Prohibited patterns

- Writing audit records directly from UI code is prohibited.
- Writing canonical audit events directly from transport route handlers is prohibited.
- Bypassing `AuthoritativeAuditRecordingService` for new canonical events is prohibited.
- Bypassing `AuditLedgerQueryService`/`WorkspaceAuditLedgerReadAuthorizer` for privileged reads is prohibited.
- Returning `adminOnlyDetails` for non-admin audit detail responses is prohibited.
- Implementing destructive retention deletes or archive jobs in this slice is prohibited.
- Storing raw secrets or raw prompts in the ledger is prohibited.
- Creating duplicate taxonomy mappings outside `AuditApplicationContracts.ts` is prohibited.

## Review checklist

1. Does the event action map to the intended canonical category?
2. Is emission routed through authoritative recording ports/service?
3. Are payload details split and redacted according to boundary rules?
4. Are prohibited content types excluded from ledger payloads?
5. Are shared contracts/schemas updated when queryable shapes change?
6. Are `.md` and `.ai.md` docs updated together?
7. Are tests updated for contracts/service/adapters/docs?

