# AI Companion: Audit Durable Ledger Persistence and Repositories

## Purpose

Story 18.2.1 introduces durable canonical audit-ledger storage so authoritative audit events are persisted and queryable via dedicated repository seams.

Canonical human doc: `docs/architecture/audit-durable-ledger-persistence-and-repositories.md`

## Canonical files

- `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
- `src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts`
- `src/infrastructure/persistence/audit/AuditLedgerPersistenceMapper.ts`
- `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/hosts/server/IdentityServerHost.ts`

## What changed

- Added explicit audit ledger persistence ports (`IAuditLedgerRepository`) under `src/application/audit/ports`.
- Added SQLite audit ledger table/migrations with append-oriented event storage and replay metadata table.
- Added durable repository adapter with:
  - replay-safe operation-key handling,
  - duplicate-content conflict protection,
  - indexed list-query filtering over canonical references/taxonomy/timestamps.
- Updated persistence composition and host audit recorder wiring so authoritative capture writes to the durable audit ledger adapter.

## Behavior summary

- Canonical events are appended, not updated in place.
- Mutation replay metadata is append-maintenance only and does not mutate persisted event truth.
- Query filters support category/action/eventType/actor/workspace/resource/occurred windows and thin-safe category mode.

## Tests

- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/application/audit/tests/AuditLedgerPersistencePorts.test.ts`
- `src/infrastructure/persistence/tests/AuthoritativePersistenceComposition.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
