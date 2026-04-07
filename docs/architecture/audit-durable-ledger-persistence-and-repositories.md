# Audit Durable Ledger Persistence and Repositories

This note captures Story 18.2.1, Story 18.2.2, and Story 18.2.3 for Feature 18 / Epic 18.2.

## Purpose

Introduce the durable persistence model and repository implementation for canonical authoritative audit events so governance/security records are append-oriented platform state rather than transient hooks.

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

## Story 18.2.3 query service workflows

Application-layer query retrieval is now exposed through
`AuditLedgerQueryService` with explicit authorization and logical-scope enforcement.

Key behavior:

- validates and normalizes list query input using shared audit query contracts/schemas;
- enforces requester authorization decisions before repository access;
- applies logical scope constraints consistently across workspace, actor, and resource filters;
- enforces thin-safe and protected-data read posture constraints from authorization scope;
- provides deterministic paging/sort defaults (`occurredAt desc`) and stable pagination metadata (`hasMore`, bounded page window);
- keeps retrieval logic in the application layer and out of UI state services.

Repository query support now includes:

- `listAuditEvents(...)` for filtered/sorted/paged event retrieval;
- `countAuditEvents(...)` for filter-consistent total counts used by application query responses.

## Append semantics

- Events are inserted; existing event rows are not updated.
- Duplicate `eventId` with different payload/content is rejected.
- Duplicate append with the same operation key resolves from replay ledger with `wasReplay: true`.
- Existing identical event with a new operation key records replay metadata only.

This preserves append-oriented ledger behavior while allowing safe mutation replay/idempotency metadata.

## Story 18.2.2 immutable-enough safeguards

Baseline production safeguards now enforce immutable-enough audit persistence behavior:

- SQLite triggers prohibit `UPDATE` and `DELETE` on both:
  - `authoritative_audit_ledger_events`
  - `authoritative_audit_ledger_mutation_replays`
- Hash-chain posture guardrails are enforced for inserts:
  - `append-only-hash-chained` events must include an `integrity_event_digest`.
  - hash-chained events after the first persisted event must include `integrity_previous_event_digest`.
  - `integrity_previous_event_digest` must match the latest persisted event digest when present.
  - `integrity_previous_event_digest` cannot be set when there is no prior event.
- Repository append flow validates integrity continuity against the current ledger tail before insert and verifies sequence monotonicity after persistence.

These controls prevent ordinary application and repository pathways from silently mutating or replacing persisted historical rows.

## Current trust guarantees and limits

Current guarantees for supported production scope:

- append-only behavior is enforced at repository and database-trigger levels;
- replay/idempotency metadata cannot be silently rewritten through normal SQL update/delete paths;
- hash-chain metadata continuity checks provide integrity-oriented sequencing posture for events using hash-chain immutability mode.

Current limits (explicit, non-cryptographic):

- this implementation does not provide external notarization or independently verifiable cryptographic immutability;
- operators with direct filesystem/database-level write access outside normal runtime controls can still tamper with a copied/offline database;
- stronger tamper-evidence guarantees (for example signed digests anchored outside SQLite) remain future work.

## Composition and host wiring

- `createAuthoritativePersistentPlatformServices(...)` now composes `auditLedgerRepository`.
- Authoritative migration hooks include the `audit-ledger` migration domain.
- `AuthoritativeAuditRecordingService` now uses `persistentPlatformServices.auditLedgerRepository` in server host composition.

## Tests

- `SqliteAuditLedgerRepository.test.ts` validates durable append/reload, idempotent replay, immutable conflict handling, query filters/sorting, prohibited direct mutation paths, and hash-chain continuity guardrails.
- `AuditLedgerQueryService.test.ts` validates authorization outcomes, logical scope intersections (workspace/actor/resource), protected-data/thin-safe posture enforcement, and deterministic pagination behavior.
- `AuditLedgerPersistencePorts.test.ts` validates operation-key normalization guardrails.
- `AuthoritativePersistenceComposition.test.ts` and host composition tests are updated for the new audit-ledger service seam.
