# Audit Durable Ledger Persistence and Repositories

This note captures Story 18.2.1, Story 18.2.2, Story 18.2.3, Story 18.2.4, Story 18.2.5, Story 18.2.7, and Story 18.3.4 for Feature 18.

## Purpose

Introduce the durable persistence model and repository implementation for canonical authoritative audit events so governance/security records are append-oriented platform state rather than transient hooks.

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
- retention lifecycle metadata seams (`retention_policy_key`, `retention_policy_version`, `retention_anchor`, `retention_retain_until`, `retention_archive_after`, `lifecycle_state`, `lifecycle_updated_at`)
- linkage metadata for event/resource/workflow traversal (`event_group`, `root/parent`, `workflow/run/session`, governance action, related-resource refs JSON)
- full canonical event JSON snapshot for deterministic rehydration

Secondary indexes support common governance query paths:

- timeline (`occurred_at`, `recorded_at`)
- taxonomy (`category`, `action`, `event_type`)
- actor/workspace/resource references
- correlation/request lookups
- linkage lookups (event group, root/parent, workflow, run, session, governance action)
- retention/lifecycle lookups (retention posture, lifecycle state, policy key, retain-until windows)
- protected-data posture filters

## Story 18.2.7 retention/lifecycle policy seams

The durable ledger now includes explicit non-destructive seams for future retention governance:

- canonical event-level retention metadata (`retentionMetadata`) is supported in domain/contracts/schemas;
- authoritative recording can apply default retention metadata policy seams from environment configuration;
- retention defaults can resolve profile-scoped overrides (for `home`, `classroom`, `organization`, and future canonical deployment profiles) before falling back to global keys;
- persistence stores indexed retention/lifecycle selector columns to avoid future schema redesign for archival workflows;
- list query filters support retention/lifecycle selectors (`retentionPostures`, `lifecycleStates`, `retentionPolicyKeys`, `retainUntilAfter`, `retainUntilBefore`).

Current supported behavior is intentionally limited:

- the system remains append-oriented and immutable-enough (`UPDATE`/`DELETE` prohibited via triggers);
- retention/lifecycle fields are metadata and query seams only;
- no destructive retention worker/job/delete pathway is implemented in this story;
- configuration explicitly rejects enabling destructive retention actions.
- host startup wiring passes resolved deployment profile context into audit retention configuration so future policy differences are additive instead of composition-breaking.

## Story 18.2.3 query service workflows

Application-layer query retrieval is now exposed through
`AuditLedgerQueryService` with explicit authorization and logical-scope enforcement.

Key behavior:

- validates and normalizes list query input using shared audit query contracts/schemas;
- enforces requester authorization decisions before repository access;
- applies logical scope constraints consistently across workspace, actor, and resource filters;
- supports linkage-aware filtering over correlation/request and linkage metadata selectors;
- enforces thin-safe and protected-data read posture constraints from authorization scope;
- provides deterministic paging/sort defaults (`occurredAt desc`) and stable pagination metadata (`hasMore`, bounded page window);
- keeps retrieval logic in the application layer and out of UI state services.

## Story 18.2.4 permission-aware access and detail projection

Audit retrieval now has explicit role/sensitivity-aware access profiling in the application layer:

- `WorkspaceAuditLedgerReadAuthorizer` derives read scope from workspace authorization snapshots and role posture.
- workspace-scoped admin actors (`owner`/`admin`) receive full-category query scope, protected-data eligibility, and `admin` detail visibility.
- active non-admin workspace actors receive thin-safe category scope, protected-data exclusion, and `user-safe` detail visibility.
- list retrieval applies role-derived scope and category intersections before repository reads.
- detail retrieval (`getAuditEventDetail`) is permission-checked through the same authorizer path and returns:
  - `notFound` for missing/non-visible events,
  - `user-safe` detail for general access tiers,
  - `admin` detail (including admin-only payload) only for admin tiers.

This keeps role, workspace, category-sensitivity, and visibility decisions centralized in audit application services, not in controllers or page code.

Repository query support now includes:

- `listAuditEvents(...)` for filtered/sorted/paged event retrieval;
- `countAuditEvents(...)` for filter-consistent total counts used by application query responses.
- `getAuditEventById(...)` for permission-aware detail retrieval.

## Story 18.2.5 authoritative audit APIs for admin/governance consumers

Audit retrieval is now exposed through authoritative server APIs rather than backend-only seams:

- `GET /api/v1/audit/events`
- `GET /api/v1/audit/events/:eventId`

Key transport behavior:

- routes are part of authoritative route-family registration (`audit-ledger`);
- authenticated workspace context is required (`workspaceId` query);
- list query parsing uses shared audit schema contracts (`parseAuditEventListQueryFromSearchParams`);
- responses preserve canonical pagination and shared error semantics:
  - invalid request -> `400 invalid-request`
  - permission denial -> `403 forbidden`
  - non-visible detail/not found -> `404 not-found`
- detail visibility remains role-aware and centralized in audit application services (`user-safe` vs `admin`).

## Append semantics

- Events are inserted; existing event rows are not updated.
- Duplicate `eventId` with different payload/content is rejected.
- Duplicate append with the same operation key resolves from replay ledger with `wasReplay: true`.
- Existing identical event with a new operation key records replay metadata only.
- `resolveAppendOutcome(...)` is available for interrupted-write recovery when a caller saw an append failure but needs to verify durable commit state.

This preserves append-oriented ledger behavior while allowing safe mutation replay/idempotency metadata.

## Story 18.3.4 interrupted-write recovery and startup reconciliation

The durable repository now exposes explicit recovery/reconciliation seams for write-path interruptions and partial-failure diagnosis:

- `resolveAppendOutcome({ eventId, context })` determines whether a failed append attempt was actually committed, not committed, or ambiguous.
- If an event row exists but replay metadata is missing, `resolveAppendOutcome(...)` repairs the replay mapping and returns `committed` with `repairedReplayMapping: true`.
- If replay metadata references a missing event row, `resolveAppendOutcome(...)` returns `ambiguous` and does not hide the inconsistency.
- `reconcileWritePathAnomalies(...)` supports startup-time scanning for orphaned replay metadata records and returns explicit manual-follow-up counts.

Authoritative-write success for this scope is now defined as:

- canonical event row durably persisted, and
- operation replay mapping present for the normalized `operationKey`.

Safe retry posture for callers:

- retrying the same logical write with the same `operationKey` is safe;
- if a previous attempt committed, replay semantics return the existing record;
- if a previous attempt did not commit, retry appends normally.

Known limit (explicit):

- this implementation does not provide exactly-once publication guarantees across external transport interruption windows;
- when write outcome remains `ambiguous`, manual reconciliation is required and is surfaced as explicit operational signal.

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
