# AI Companion: Audit Durable Ledger Persistence and Repositories

## Purpose

Story 18.2.1, Story 18.2.2, and Story 18.2.3 provide durable canonical audit-ledger storage plus application query retrieval workflows with immutable-enough baseline safeguards for authoritative audit persistence.

Canonical human doc: `docs/architecture/audit-durable-ledger-persistence-and-repositories.md`

## Canonical files

- `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
- `src/application/audit/use-cases/AuditLedgerQueryService.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
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
  - indexed list-query filtering over canonical references/taxonomy/timestamps,
  - filter-consistent `countAuditEvents(...)` support for query pagination metadata.
- Added immutable-enough persistence safeguards:
  - DB triggers that prohibit `UPDATE`/`DELETE` for audit events and replay records.
  - hash-chain insert guardrails for digest presence and previous-digest continuity.
  - repository-level integrity continuity checks and sequence monotonic validation during append.
- Updated persistence composition and host audit recorder wiring so authoritative capture writes to the durable audit ledger adapter.
- Added application-layer `AuditLedgerQueryService` to provide authorization-aware retrieval over shared query contracts with deterministic pagination/sorting defaults and logical scope filtering.

## Behavior summary

- Canonical events are appended, not updated in place.
- Mutation replay metadata is append-maintenance only and does not mutate persisted event truth.
- Query filters support category/action/eventType/actor/workspace/resource/occurred windows and thin-safe category mode.
- Query service merges authorization scope limits (workspace/actor/resource/protected-data/thin-safe) with caller filters before repository reads.
- Trust boundary is explicit: this is immutable-enough within runtime/SQLite controls, not a full cryptographic immutability/notarization system.

## Tests

- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/application/audit/tests/AuditLedgerPersistencePorts.test.ts`
- `src/infrastructure/persistence/tests/AuthoritativePersistenceComposition.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
