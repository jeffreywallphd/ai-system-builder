# AI Companion: Audit Durable Ledger Persistence and Repositories

## Purpose

Story 18.2.1, Story 18.2.2, Story 18.2.3, Story 18.2.4, Story 18.2.5, Story 18.2.7, and Story 18.3.4 provide durable canonical audit-ledger storage plus permission-aware application query/detail retrieval workflows with immutable-enough baseline safeguards, retention/lifecycle policy seams, and authoritative server APIs.

Canonical human doc: `docs/architecture/audit-durable-ledger-persistence-and-repositories.md`

## Canonical files

- `src/application/audit/ports/AuditLedgerPersistencePorts.ts`
- `src/application/audit/use-cases/AuditLedgerQueryService.ts`
- `src/application/audit/use-cases/WorkspaceAuditLedgerReadAuthorizer.ts`
- `src/infrastructure/api/audit/AuditLedgerBackendApi.ts`
- `src/infrastructure/api/audit/sdk/PublicAuditLedgerApiContract.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/AuditAuthoritativeApiRoutes.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/application/audit/tests/WorkspaceAuditLedgerReadAuthorizer.test.ts`
- `src/infrastructure/api/audit/tests/AuditLedgerBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuditLedger.test.ts`
- `src/infrastructure/persistence/audit/SqliteAuditLedgerPersistenceMigrations.ts`
- `src/infrastructure/persistence/audit/AuditLedgerPersistenceMapper.ts`
- `src/infrastructure/persistence/audit/SqliteAuditLedgerRepository.ts`
- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/infrastructure/config/AuditRetentionLifecycleConfig.ts`
- `src/infrastructure/config/tests/AuditRetentionLifecycleConfig.test.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/hosts/server/IdentityServerHost.ts`

## What changed

- Added explicit audit ledger persistence ports (`IAuditLedgerRepository`) under `src/application/audit/ports`.
- Added SQLite audit ledger table/migrations with append-oriented event storage and replay metadata table.
- Added linkage persistence columns/indexes (event-group/root/parent/workflow/session/run/governance-action + related-resources JSON) for investigative joins.
- Added durable repository adapter with:
  - replay-safe operation-key handling,
  - duplicate-content conflict protection,
  - indexed list-query filtering over canonical references/taxonomy/timestamps,
  - filter-consistent `countAuditEvents(...)` support for query pagination metadata,
  - canonical event lookup support (`getAuditEventById(...)`) for detail workflows.
- Added immutable-enough persistence safeguards:
  - DB triggers that prohibit `UPDATE`/`DELETE` for audit events and replay records.
  - hash-chain insert guardrails for digest presence and previous-digest continuity.
  - repository-level integrity continuity checks and sequence monotonic validation during append.
- Updated persistence composition and host audit recorder wiring so authoritative capture writes to the durable audit ledger adapter.
- Added application-layer `AuditLedgerQueryService` to provide authorization-aware retrieval over shared query contracts with deterministic pagination/sorting defaults and logical scope filtering.
- Added `WorkspaceAuditLedgerReadAuthorizer` to centralize workspace-role/sensitivity-driven read scope decisions for list and detail retrieval.
- Added permission-aware detail retrieval (`getAuditEventDetail(...)`) with user-safe vs admin detail projection.
- Added authoritative audit query/read APIs:
  - `GET /api/v1/audit/events`
  - `GET /api/v1/audit/events/:eventId`
  - request parsing from shared audit query contracts/schemas and canonical status mapping for invalid/forbidden/not-found outcomes.
- Added retention/lifecycle policy seams without destructive behavior:
  - canonical `retentionMetadata` fields in domain/shared contracts/schemas,
  - indexed retention columns in SQLite persistence,
  - retention/lifecycle list filters (`retentionPostures`, `lifecycleStates`, `retentionPolicyKeys`, `retainUntilAfter`, `retainUntilBefore`),
  - environment-backed metadata defaults for authoritative recording (`AI_LOOM_AUDIT_RETENTION_*`),
  - explicit guardrail that destructive retention actions are rejected by configuration.
- Added interrupted-write recovery and startup reconciliation seams:
  - `resolveAppendOutcome(...)` for post-failure commit-state verification (`committed` / `not-committed` / `ambiguous`),
  - replay-metadata repair when event row exists but replay row was missing,
  - explicit ambiguous-state surfacing when replay metadata references missing event rows,
  - `reconcileWritePathAnomalies(...)` for startup-time anomaly detection and manual-follow-up reporting.

## Behavior summary

- Canonical events are appended, not updated in place.
- Mutation replay metadata is append-maintenance only and does not mutate persisted event truth.
- Authoritative write success is defined as event persistence + operation replay mapping persistence.
- Query filters support category/action/eventType/actor/workspace/resource/occurred windows and thin-safe category mode.
- Query filters also support retention/lifecycle selection and retain-until windows for future archival control surfaces.
- Query filters also support correlation/request and linkage selectors for related workflow/event traversal.
- Query service merges authorization scope limits (workspace/actor/resource/protected-data/thin-safe) with caller filters before repository reads.
- Detail retrieval applies the same authorization scope and returns non-leaky `notFound` when events are outside workspace/sensitivity visibility.
- The same canonical event can render as `user-safe` detail for general actors and `admin` detail for administrative actors.
- Trust boundary is explicit: this is immutable-enough within runtime/SQLite controls, not a full cryptographic immutability/notarization system.
- Retention/lifecycle policy seams are metadata-only in this slice; no delete/purge worker is shipped.
- Exactly-once external publication across transport interruption windows is not claimed; ambiguous write-path outcomes are explicit and require reconciliation/manual follow-up.

## Tests

- `src/infrastructure/persistence/audit/tests/SqliteAuditLedgerRepository.test.ts`
- `src/application/audit/tests/AuditLedgerQueryService.test.ts`
- `src/application/audit/tests/WorkspaceAuditLedgerReadAuthorizer.test.ts`
- `src/application/audit/tests/AuditLedgerPersistencePorts.test.ts`
- `src/infrastructure/persistence/tests/AuthoritativePersistenceComposition.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
