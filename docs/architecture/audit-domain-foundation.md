# Audit Domain Foundation

This note defines Story 18.1.1 and establishes the canonical audit model for AI Loom.

## Scope

Implemented in this slice:

- canonical audit domain model and invariants in `src/domain/audit/AuditDomain.ts`
- canonical audit application contracts and taxonomy guidance in `src/application/audit/AuditApplicationContracts.ts`
- tests for domain invariants and application taxonomy/contract helpers

Out of scope in this slice:

- persistence schema and repository adapters for the durable audit ledger
- migration of existing feature-specific audit hooks to the canonical contract
- UI query surfaces beyond current governance-review experience

## Canonical files

- `src/domain/audit/AuditDomain.ts`
- `src/domain/audit/tests/AuditDomain.test.ts`
- `src/application/audit/AuditApplicationContracts.ts`
- `src/application/audit/tests/AuditApplicationContracts.test.ts`
- `docs/architecture/audit-shared-event-contracts.md` (shared contract/schema/DTO follow-up for Story 18.1.2)

## Canonical event model

Every canonical audit record uses `CanonicalAuditEvent` and has these required fields:

- `recordKind` (`audit-record`)
- `eventId`
- `eventType`
- `category`
- `action`
- `outcome`
- `occurredAt`
- `recordedAt`
- `actor`
- `scope`
- `payload`
- `integrity`
- `retention`
- `immutability`

Optional but supported:

- `protectedResource`
- `correlationId`
- `requestId`

## Actor, scope, and protected-resource contracts

- Actor identity is explicit (`actorId`, `actorKind`) and may include `actorUserIdentityId`, `actorServiceId`, and `actorSessionId`.
- Workspace scope is explicit (`global` or `workspace`) and enforces workspace-id presence/absence by scope kind.
- Protected-resource references are explicit (`resourceType`, `resourceId`, `resourceRef`, sensitivity class) and may carry workspace scope for governance joins.

## Taxonomy categories

Canonical event categories are:

- `security-sensitive`
- `administrative`
- `sharing`
- `policy`
- `orchestration`
- `protected-data`

Application-level helper `resolveAuditCategoryForAction(...)` maps action namespaces to these categories.

Current prefix guidance:

- `auth.*`, `identity.*`, `security.*` -> `security-sensitive`
- `workspace.*`, `node.*`, `storage.*` -> `administrative`
- `share.*`, `permission.*` -> `sharing`
- `policy.*`, `retention.*` -> `policy`
- `run.*`, `scheduling.*` -> `orchestration`
- `secret.*`, `asset.protected.*` -> `protected-data`

When adding a new audited action, contributors should:

1. choose the `action` namespace first,
2. map it with `resolveAuditCategoryForAction(...)`,
3. define event-specific payload keys in either `userSafeDetails` or `adminOnlyDetails`.

## Invariant posture

### Append-oriented and immutable-enough

- Canonical events are `audit-record` entries.
- Immutability posture is explicit (`append-only` or `append-only-hash-chained`).
- Event integrity metadata is required (`schemaVersion`, `hashAlgorithm`) with optional digest chaining fields.

### Timestamp integrity

- `occurredAt` and `recordedAt` must be valid timestamps.
- `recordedAt` cannot be earlier than `occurredAt`.

### Redaction boundaries

- Payloads are split into:
  - `userSafeDetails` (safe for broad governance read paths)
  - `adminOnlyDetails` (restricted details)
- Keys cannot exist in both payload sections.
- Protected payloads must declare `hasProtectedData: true` and one or more `redactionReasons`.

### Access boundary intent

- Canonical audit records are designed for policy-governed query and review.
- `toUserSafeAuditEventView(...)` projects a user-safe view with only safe details.

## Audit record vs operational log

`AuditApplicationContracts.ts` now makes the distinction explicit:

- Audit ledger (`IAuditLedgerRepository`): append/query canonical `audit-record` events for governance, compliance, and security review.
- Operational log (`IOperationalEventLogRepository`): ephemeral operational telemetry/debug events for troubleshooting and runtime health.

Audit events are authoritative governance records.
Operational logs are observability artifacts and are not equivalent to audit records.

## Tests

- `src/domain/audit/tests/AuditDomain.test.ts`
  - actor/scope invariants
  - payload redaction boundary invariants
  - canonical event creation and timestamp immutability checks
- `src/application/audit/tests/AuditApplicationContracts.test.ts`
  - action-prefix taxonomy mapping
  - audit vs operational record distinction
  - best-effort append helper behavior
