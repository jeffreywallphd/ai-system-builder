# Audit Durable Ledger Persistence and Repositories

This note captures Story 18.2.1 for Feature 18 / Epic 18.2.

## Purpose

Introduce the durable persistence model and repository implementation for canonical authoritative audit events so governance/security records are append-oriented platform state rather than transient hooks.

## Canonical files

- `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
- `src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts`
- `src/infrastructure/persistence/audit/AuditLedgerPersistenceMapper.ts`
- `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Repository and schema posture

The durable audit ledger adapter now implements `IAuditLedgerRepository` with:

- append-oriented canonical event persistence (`appendAuditEvent(...)`)
- replay-safe mutation idempotency using normalized `operationKey` records
- indexed read queries over canonical audit dimensions (`listAuditEvents(...)`)

SQLite schema additions (`authoritative_audit_ledger_events`) persist:

- canonical envelope identity and taxonomy fields (`eventId`, `eventType`, `category`, `action`, `outcome`)
- normalized actor/scope/resource references
- immutable event timing (`occurredAt`, `recordedAt`) and integrity/retention/immutability fields
- payload boundary metadata (`hasProtectedData`, redaction reasons, safe/admin JSON)
- full canonical event JSON snapshot for deterministic rehydration

Secondary indexes support common governance query paths:

- timeline (`occurred_at`, `recorded_at`)
- taxonomy (`category`, `action`, `event_type`)
- actor/workspace/resource references
- correlation/request lookups
- protected-data posture filters

## Append semantics

- Events are inserted; existing event rows are not updated.
- Duplicate `eventId` with different payload/content is rejected.
- Duplicate append with the same operation key resolves from replay ledger with `wasReplay: true`.
- Existing identical event with a new operation key records replay metadata only.

This preserves append-oriented ledger behavior while allowing safe mutation replay/idempotency metadata.

## Composition and host wiring

- `createAuthoritativePersistentPlatformServices(...)` now composes `auditLedgerRepository`.
- Authoritative migration hooks include the `audit-ledger` migration domain.
- `AuthoritativeAuditRecordingService` now uses `persistentPlatformServices.auditLedgerRepository` in server host composition.

## Tests

- `SqliteAuditLedgerRepository.test.ts` validates durable append/reload, idempotent replay, immutable conflict handling, and query filters/sorting.
- `AuditLedgerPersistencePorts.test.ts` validates operation-key normalization guardrails.
- `AuthoritativePersistenceComposition.test.ts` and host composition tests are updated for the new audit-ledger service seam.
