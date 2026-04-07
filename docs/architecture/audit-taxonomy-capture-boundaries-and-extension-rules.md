# Audit Taxonomy, Capture Boundaries, and Extension Rules

This note captures Story 18.1.8 for Feature 18 / Epic 18.1.

## Purpose

Define durable contributor rules for:

- what actions must emit canonical audit events
- where audit capture is allowed in the architecture
- how to add new event types and category mappings safely
- what data/content must never be written to the audit ledger

## Canonical seams

- `src/domain/audit/AuditDomain.ts`
- `src/application/audit/AuditApplicationContracts.ts`
- `src/application/audit/ports/AuthoritativeAuditRecordingPorts.ts`
- `src/application/audit/use-cases/AuthoritativeAuditRecordingService.ts`
- `src/application/audit/shared/AuditReferenceNormalization.ts`
- `src/shared/contracts/audit/AuditEventContracts.ts`
- `src/shared/dto/audit/AuditEventDtos.ts`
- `src/shared/schemas/audit/AuditEventSchemaContracts.ts`
- `src/infrastructure/audit/AuthoritativeRunSubmissionAuditSink.ts`
- `src/infrastructure/audit/AuthoritativeSchedulingGovernanceEventSink.ts`
- `src/infrastructure/audit/AuthoritativeStorageManagementAuditSink.ts`
- `src/infrastructure/audit/AuthoritativeSecretAccessAuditHook.ts`
- `src/ui/services/GovernanceAuditReviewService.ts`
- `docs/audit-governance-contributor-guide.md`

## Canonical taxonomy and action namespaces

Canonical categories are defined in `AuditEventCategories`:

- `security-sensitive`
- `administrative`
- `sharing`
- `policy`
- `orchestration`
- `protected-data`

Action namespaces are resolved through `resolveAuditCategoryForAction(...)` in `AuditApplicationContracts.ts`:

- `auth.*`, `identity.*`, `security.*` -> `security-sensitive`
- `workspace.*`, `node.*`, `storage.*` -> `administrative`
- `share.*`, `permission.*` -> `sharing`
- `policy.*`, `retention.*` -> `policy`
- `run.*`, `scheduling.*` -> `orchestration`
- `secret.*`, `asset.protected.*` -> `protected-data`

## What must emit audit events

Emit authoritative audit events for actions that change security posture, authorization posture, governance posture, or protected-resource access posture.

Required emission classes:

- authentication/session lifecycle and trusted-device trust changes
- node trust approval/revocation and similar trust-admin mutations
- sharing/permission/publication policy mutations
- storage governance changes (instance lifecycle, metadata, policy, access administration)
- run orchestration governance actions (submission accepted/denied, lifecycle transitions, scheduling admin and decision events)
- secret access decisions and secret operations (create/rotate/disable/delete/runtime retrieval)
- protected asset access decisions and protected data retrieval operations

## Capture boundaries

Canonical audit event emission belongs in application use-case and service boundaries, routed through `AuthoritativeAuditRecordingPort`.

Allowed capture points:

- application use-cases and orchestration services
- infrastructure adapters that translate domain/application events into authoritative audit recorder calls

Not allowed capture points:

- UI components, UI pages, or UI service code writing directly to audit repositories
- transport route handlers writing canonical ledger records directly
- domain entities invoking infrastructure audit repositories

## Authoritative recording workflow

1. Create category-appropriate action key and stable operation key.
2. Normalize actor/scope/protected-resource references through authoritative service flow.
3. Populate payload boundaries using `userSafeDetails` and `adminOnlyDetails`.
4. Let `AuthoritativeAuditRecordingService` sanitize/redact and compute protected-data posture.
5. Append via `IAuditLedgerRepository` using canonical `CanonicalAuditEvent`.
6. Expose audit data only through shared DTO/schema/query contracts.

## Use-case to audit-event mapping examples

- Run submission accepted:
  - `eventType`: `run-submission-accepted`
  - `action`: `run.submission.accepted`
  - category: `orchestration`
  - source adapter: `AuthoritativeRunSubmissionAuditSink`
- Scheduling reservation conflict:
  - `eventType`: `scheduling-reservation-conflict`
  - `action`: `run.scheduling.reservation.conflict`
  - category: `orchestration`
  - source adapter: `AuthoritativeSchedulingGovernanceEventSink`
- Storage policy changed:
  - `eventType`: `storage-policy-updated`
  - `action`: `policy.storage.updated`
  - category: `policy`
  - source adapter: `AuthoritativeStorageManagementAuditSink`
- Secret access decision denied:
  - `eventType`: `secret-access-decision`
  - `action`: `secret.<operation>.access-evaluated`
  - category: `protected-data`
  - source adapter: `AuthoritativeSecretAccessAuditHook`

## Data that must never be recorded

Never place these values in `userSafeDetails` or `adminOnlyDetails`:

- raw secret material, tokens, passwords, credentials, key bytes, PEM, CSR
- raw prompts, completions, conversation transcripts, or tool-call bodies containing sensitive prompt content
- raw filesystem paths, raw storage object keys, connection strings, database URLs
- plaintext personal data not required for governance review
- unrestricted stack traces or internal diagnostics that expose sensitive payloads

Use stable identifiers, counts, classifications, reason codes, and bounded summaries instead.

## Prohibited patterns

- Writing audit records directly from UI code is prohibited.
- Writing canonical audit records directly from transport handlers is prohibited.
- Bypassing `AuthoritativeAuditRecordingService` for new canonical events is prohibited.
- Storing raw secrets or raw prompts in the ledger is prohibited.
- Duplicating ad-hoc taxonomy mapping outside `resolveAuditCategoryForAction(...)` is prohibited.

## Retention and immutability posture

- Default retention posture is governance (`AuditRetentionPostures.governance`) unless a valid override is required.
- Default immutability posture is append-only (`AuditImmutabilityPostures.appendOnly`) unless hash-chain mode is explicitly required.
- Prefer additive event correction over mutation/deletion of existing records.

## Access control and projection posture

- Use shared query contracts (`AuditEventListQueryDto`, `AuditLedgerListQueryDto`) for retrieval.
- Use redacted views (`AuditEventSummaryViewDto`, `AuditEventDetailViewDto`) for display paths.
- Thin/admin-lite review paths must continue to enforce thin-safe filtering and redaction.

## Extension checklist

1. Define/confirm action namespace and category mapping.
2. Add/update event type mapping in the source adapter.
3. Emit through `AuthoritativeAuditRecordingPort` from application/infrastructure boundary.
4. Ensure payload boundaries avoid prohibited content and include redaction reasons when protected.
5. Add/update shared contracts/schemas/DTOs if queryable shape changes.
6. Add/extend tests for service/adapters and documentation contracts.
7. Update `.md` and `.ai.md` docs together.

