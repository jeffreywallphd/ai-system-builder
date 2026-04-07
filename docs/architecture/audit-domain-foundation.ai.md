# AI Companion: Audit Domain Foundation

## What this slice does

- Adds canonical audit domain contracts in `src/domain/audit/AuditDomain.ts`.
- Defines canonical event envelope fields for actor identity, workspace scope, protected-resource references, timestamps, integrity metadata, payload boundaries, retention posture, and immutability posture.
- Adds application-level audit contracts in `src/application/audit/AuditApplicationContracts.ts`.
- Defines explicit taxonomy categories and action-prefix category mapping guidance for future audited actions.
- Makes audit-record vs operational-log boundaries explicit.

## Main files

- `src/domain/audit/AuditDomain.ts`
- `src/domain/audit/tests/AuditDomain.test.ts`
- `src/application/audit/AuditApplicationContracts.ts`
- `src/application/audit/tests/AuditApplicationContracts.test.ts`
- `docs/architecture/audit-shared-event-contracts.md` (Story 18.1.2 shared contract/schema/DTO follow-up)
- `docs/architecture/audit-domain-foundation.md`

## Canonical required event fields

- `recordKind`, `eventId`, `eventType`, `category`, `action`, `outcome`
- `occurredAt`, `recordedAt`
- `actor`, `scope`
- `payload`, `integrity`
- `retention`, `immutability`

Optional: `protectedResource`, `correlationId`, `requestId`.

## Taxonomy categories

- `security-sensitive`
- `administrative`
- `sharing`
- `policy`
- `orchestration`
- `protected-data`

Use `resolveAuditCategoryForAction(...)` to map action namespaces into categories.

## Key invariants

- Append-oriented record posture with explicit immutability mode.
- `recordedAt >= occurredAt` timestamp integrity.
- Payload boundary split between `userSafeDetails` and `adminOnlyDetails`.
- No duplicated keys across user-safe/admin-only payload sections.
- Protected payloads require explicit redaction reasons.
- Scope and actor identity combinations are validated.

## Audit vs observability

- Audit record: authoritative governance/security/compliance history, queryable through audit ledger contracts.
- Operational log: runtime observability/troubleshooting telemetry, not an audit substitute.
