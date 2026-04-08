# Offline Local-Mode Contributor Guide

## Purpose

Provide a durable implementation workflow for extending offline/local-mode behavior without breaking authoritative control-plane boundaries.

## Canonical docs for this area

- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-sync-shared-contracts.md`
- `docs/architecture/offline-local-mode-audit-operational-hooks.md`
- `docs/architecture/host-runtime-composition-boundaries.md`
- `docs/architecture/desktop-host-assembly.md`

## Canonical implementation seams

- domain boundary catalog and policy evaluators:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
- application classification and reconnect policy:
  - `src/application/common/OfflineResourceClassificationPolicy.ts`
  - `src/application/common/OfflineLocalModeResynchronization.ts`
- application authoritative snapshot cache service:
  - `src/application/common/OfflineAuthoritativeSnapshotCache.ts`
- application pending-operation persistence/replay-preparation service:
  - `src/application/common/OfflinePendingOperationPersistence.ts`
- application local-execution registration persistence/replay-preparation service:
  - `src/application/common/OfflineLocalExecutionRegistrationPersistence.ts`
- application controlled resynchronization coordinator:
  - `src/application/common/OfflineControlledResynchronizationCoordinator.ts`
- application offline audit/operational event hooks:
  - `src/application/common/OfflineOperationalEventPorts.ts`
- desktop host local-mode binding:
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
  - `src/hosts/desktop/DesktopConnectivityStateService.ts`
  - `src/hosts/desktop/DesktopOfflineSnapshotCacheHost.ts`
  - `src/hosts/desktop/DesktopOfflinePendingOperationHost.ts`
  - `src/hosts/desktop/DesktopOfflineLocalExecutionRegistrationHost.ts`
  - `src/hosts/desktop/DesktopOfflineResynchronizationHost.ts`
- desktop persistence adapter:
  - `src/infrastructure/desktop/DesktopOfflineSnapshotCacheRepository.ts`
  - `src/infrastructure/desktop/DesktopOfflinePendingOperationRepository.ts`
  - `src/infrastructure/desktop/DesktopOfflineLocalExecutionRegistrationRepository.ts`
  - `src/infrastructure/desktop/DesktopOfflineValueProtection.ts`
- runtime event adapter for offline hooks:
  - `src/infrastructure/api/system-runtime/DesktopOfflineOperationalEventSink.ts`
  - `src/infrastructure/api/system-runtime/OfflineOperationalObservability.ts`
  - `src/infrastructure/api/system-runtime/OfflineOperationalObservabilityRedaction.ts`
- shared offline contracts and schema parsers:
  - `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
  - `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
  - `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`
- desktop shared UI status seams:
  - `src/ui/shared/connectivity/DesktopConnectivityService.ts`
  - `src/ui/presenters/DesktopOfflineStatusPresenter.ts`
  - `src/ui/shared/connectivity/DesktopOfflineStatusSurface.tsx`
  - `src/ui/layout/AppLayout.tsx`

## Desktop cache and reconnect workflow entry points

Use this map when deciding where to extend behavior:

- cache population and policy admission:
  - `OfflineResourceClassificationPolicy.classifyOfflineResourceLocalModePolicy(...)`
  - `OfflineAuthoritativeSnapshotCacheService.cacheSnapshot(...)`
  - `DesktopOfflineSnapshotCacheHost.createDesktopOfflineSnapshotCacheHostRuntime(...)`
- offline transitions and connectivity state:
  - `DesktopConnectivityStateService.observe(...)`
  - `DesktopConnectivityStateService.setDeliberateOfflineMode(...)`
  - `DesktopConnectivityStateService.startMonitoring(...)`
- queue durability and replay preparation:
  - `OfflinePendingOperationService.queueOperation(...)`
  - `OfflinePendingOperationService.prepareReplayOperations(...)`
  - `OfflinePendingOperationService.markOperationReplayOutcome(...)`
  - `OfflineLocalExecutionRegistrationService.queueRegistration(...)`
  - `OfflineLocalExecutionRegistrationService.prepareReplayRegistrations(...)`
  - `OfflineLocalExecutionRegistrationService.markRegistrationReplayOutcome(...)`
  - `DesktopOfflinePendingOperationHost.createDesktopOfflinePendingOperationHostRuntime(...)`
  - `DesktopOfflineLocalExecutionRegistrationHost.createDesktopOfflineLocalExecutionRegistrationHostRuntime(...)`
- reconnect orchestration and post-sync cleanup:
  - `OfflineControlledResynchronizationCoordinator.synchronizeWorkspace(...)`
  - `DesktopOfflineResynchronizationHost.createDesktopOfflineResynchronizationHostRuntime(...)`
- shared contract updates:
  - `OfflineSynchronizationContracts.ts` (types + transitions)
  - `OfflineSynchronizationDtos.ts` (mapping)
  - `OfflineSynchronizationSchemaContracts.ts` (validation)

## Required extension sequence

1. Update shared contracts and schema validation first when any payload shape, status transition, conflict marker, or registration envelope changes.
2. Update domain offline catalog and policy semantics second:
   - register resource class or execution class,
   - set authority scope and storage bucket,
   - define capability matrix and eligibility metadata.
3. Update application classification/resynchronization behavior third:
   - keep reconnect decision rules explicit and bounded,
   - preserve visible divergence handling.
   - route reconnect replay through authoritative API ports and capture explicit outcomes for apply/conflict/reject/failure paths.
   - expose blocked replay operations with structured metadata (reason code/message/dependency blockers) rather than id-only reporting.
   - emit structured replay/conflict/recovery/protected-registration outcomes through offline event hooks with sanitized details.
   - keep sync-attempt correlation and diagnostics explicit (`requestId`, `correlationId`, `syncAttemptId`) so reconnect traces are operable in production.
   - emit explicit cache failure diagnostics (`snapshot-refresh-failed`) for refresh/invalidation misses instead of silent cleanup skips.
4. Update desktop profile bindings fourth:
   - keep desktop runtime as `control-plane-client`,
   - enforce allowed resource and execution classes through profile gates.
   - emit explicit offline-entered/offline-exited events from host-owned connectivity transitions.
5. Update adapters/UI surfaces last to consume new canonical contracts; do not invent ad hoc offline object shapes.
   - Keep offline/local-mode display logic in shared presenter/component seams.
   - Keep host/application synchronization mechanics out of UI components.
   - Include explicit interaction flows for preserved drafts, sync conflicts, replay outcomes, and first follow-up actions when unresolved local work is in scope.
   - Keep unsupported auto-merge behavior explicitly disclosed; do not imply merge tooling beyond bounded production replay rules.

## Workflow-specific extension checklists

### Extending cache population policy

- update domain boundary capability/policy metadata first (`OfflineLocalModeBoundaries.ts`);
- update classification gating (`OfflineResourceClassificationPolicy.ts`);
- keep snapshot cache constraints unchanged:
  - server-authoritative classes only,
  - logical payload only (no filesystem references),
  - digest integrity and retention bounds;
- add/update application + infrastructure tests:
  - `OfflineAuthoritativeSnapshotCache.test.ts`
  - `DesktopOfflineSnapshotCacheRepository.test.ts`
  - `DesktopOfflineSnapshotCacheHost.test.ts`

### Extending connectivity transitions

- keep transition authority in `DesktopConnectivityStateService` (not UI components);
- preserve explicit state model (`connected`, `degraded`, `reconnecting`, `disconnected`);
- preserve explicit deliberate-offline distinction (`offlineModeIntent='deliberate'`);
- keep transition events best-effort and sanitized;
- include correlation-safe diagnostics on transition events without exposing transport internals or path-like local content;
- add/update tests:
  - `DesktopConnectivityStateService.test.ts`
  - `DesktopOfflineOperationalEventSink.test.ts`

### Extending replay/conflict/cleanup behavior

- add policy changes in `OfflineLocalModeResynchronization.ts` first;
- keep explicit replay-preparation blocked reasons with structured metadata;
- ensure coordinator cleanup classification remains explicit and queryable;
- preserve post-sync cache maintenance semantics (refresh or invalidate);
- keep resync attempt start/completion diagnostics and replay/cache failure summaries aligned to offline observability model;
- add/update tests:
  - `OfflinePendingOperationPersistence.test.ts`
  - `OfflineControlledResynchronizationCoordinator.test.ts`
  - `DesktopOfflineResynchronizationHost.test.ts`

## Adding a new offline resource class

Required:
- add the class constant and boundary entry in `OfflineLocalModeBoundaries.ts`;
- include behavior class, authority scope, storage bucket, capability matrix, and eligibility metadata;
- ensure unsupported classes still fail closed;
- include reconnect policy and prohibited-pattern mapping;
- add policy matrix and evaluator test coverage.

## Extending local draft semantics

Required:
- preserve explicit `baseAuthoritativeRevision` and `authoritativeSnapshotRevision`;
- preserve explicit sync-status transitions;
- keep local edits resetting draft sync status to `local-only`;
- keep queued linkage explicit via `queuedMutationId`.

## Extending authoritative snapshot cache semantics

Required:
- keep authoritative snapshot cache restricted to server-authoritative resource classes allowed by offline policy;
- persist logical snapshot payload + metadata (workspace context, authoritative revisions, sync timestamps, eligibility markers);
- keep cache bounded (retention cap) to prevent uncontrolled local-cache sprawl;
- reject raw filesystem references in snapshot payloads;
- when storage rule requires encrypted cache, gate writes on protected-at-rest cache capability.
- preserve explicit value-protection posture metadata so protected vs unprotected local snapshot payload persistence is always visible.
- after reconnect attempts, apply explicit post-sync cache maintenance rules:
  - refresh stale authoritative snapshots when authoritative revisions change or replay succeeds;
  - invalidate cached snapshots when authoritative state indicates deleted/revoked resources, replay permission loss, or invalidated run submissions;
  - when stale snapshots cannot be refreshed, invalidate them so stale local cache does not appear authoritative.

## Extending pending operation semantics

Required:
- use queued envelopes with rooted replay descriptor (`method`, `path`, `idempotencyKey`, `payload`);
- include `divergenceDisclosureToken`;
- preserve no-preclaim rule: queued operations cannot be pre-marked globally applied;
- keep operation status transitions explicit (`queued-pending-sync`, `sync-conflict`, `sync-rejected`, `sync-applied`).
- persist pending operation records with explicit `actorWorkspaceContext`, dependency references, resource base-version metadata, and retryability metadata.
- preserve canonical replay payload serialization + digest so reconnect replay intent is durable across desktop restart.
- protect persisted replay/envelope JSON fields at rest when platform-protected storage is available; preserve explicit fallback posture metadata when protection is unavailable.
- replay-preparation output must be deterministic and dependency-aware, and must clearly separate replay-eligible unsynced records from blocked/non-eligible records.
- apply explicit cleanup classification for post-sync pending-operation handling:
  - `successful`: authoritative apply confirmed and queue entry removed;
  - `conflicted`: conflict outcome retained for explicit user review;
  - `failed`: replay attempt failed and record retained with explicit retryability state;
  - `abandoned`: replay rejected/non-retryable/terminally blocked and retained for explicit manual intervention.

## Extending reconnect conflict handling

Required:
- classify non-apply outcomes with canonical conflict class;
- keep decision rules explicit and testable;
- keep user/admin attention requirements explicit;
- preserve `assertResynchronizationPlanPreventsSilentGlobalDivergence(...)` invariants.
- when reconnect replay is rejected due revocation/permission-loss outcomes, persist non-retryable reason codes and apply snapshot invalidation/reduced-visibility cleanup.

## What must remain server-authoritative

- replay authorization and final apply/reject decisions;
- global shared-resource lifecycle writes;
- secret plaintext materialization;
- authoritative run history and orchestration lifecycle truth;
- conflict finalization for reconnect replay.

## Prohibited patterns

- treating offline cache or local draft as global authority;
- silently auto-merging conflicts or rejections;
- bypassing canonical domain/application seams from UI or transport handlers;
- storing/transporting offline state via ad hoc contract shapes;
- bypassing desktop host role checks to grant authoritative posture;
- blending local execution history into authoritative history without explicit registration outcome.

## Required tests and docs updates

At minimum, update:
- `src/domain/platform/tests/OfflineLocalModeBoundaries.test.ts`
- `src/application/common/tests/OfflineResourceClassificationPolicy.test.ts`
- `src/application/common/tests/OfflineLocalModeResynchronization.test.ts`
- `src/application/common/tests/OfflineAuthoritativeSnapshotCache.test.ts`
- `src/application/common/tests/OfflineOperationalEventPorts.test.ts`
- `src/hosts/desktop/tests/DesktopOfflineLocalModeProfile.test.ts`
- `src/hosts/desktop/tests/DesktopConnectivityStateService.test.ts`
- `src/hosts/desktop/tests/DesktopOfflineSnapshotCacheHost.test.ts`
- `src/infrastructure/desktop/tests/DesktopOfflineSnapshotCacheRepository.test.ts`
- `src/application/common/tests/OfflinePendingOperationPersistence.test.ts`
- `src/application/common/tests/OfflineControlledResynchronizationCoordinator.test.ts`
- `src/hosts/desktop/tests/DesktopOfflinePendingOperationHost.test.ts`
- `src/hosts/desktop/tests/DesktopOfflineResynchronizationHost.test.ts`
- `src/infrastructure/api/system-runtime/tests/DesktopOfflineOperationalEventSink.test.ts`
- `src/infrastructure/desktop/tests/DesktopOfflinePendingOperationRepository.test.ts`
- `src/application/common/tests/OfflineLocalExecutionRegistrationPersistence.test.ts`
- `src/hosts/desktop/tests/DesktopOfflineLocalExecutionRegistrationHost.test.ts`
- `src/infrastructure/desktop/tests/DesktopOfflineLocalExecutionRegistrationRepository.test.ts`
- `src/shared/contracts/runtime/tests/OfflineSynchronizationContracts.test.ts`
- `src/shared/dto/runtime/tests/OfflineSynchronizationDtos.test.ts`
- `src/shared/schemas/runtime/tests/OfflineSynchronizationSchemaContracts.test.ts`
- `src/ui/shared/connectivity/tests/DesktopConnectivityService.test.ts`
- `src/ui/presenters/tests/DesktopOfflineStatusPresenter.test.ts`
- `src/ui/shared/tests/DesktopOfflineStatusSurface.test.tsx`

For Story 19.3.2-style UX work, include interaction-flow coverage for:
- preserved unsynced draft visibility and recovery messaging,
- sync conflict inspection messaging and bounded manual follow-up guidance,
- replay outcome interpretation (applied/conflict/rejected),
- explicit unsupported auto-merge disclosure.

When architecture behavior changes, update both:
- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-local-mode-authority-boundaries.ai.md`

When contributor guidance changes, update both:
- `docs/offline-local-mode-contributor-guide.md`
- `docs/offline-local-mode-contributor-guide.ai.md`

## Intentionally deferred behavior guardrails

Do not implement these without explicit story scope:

- automatic multi-branch conflict merging for offline drafts/queues;
- desktop-to-desktop queue merge/sync outside authoritative replay;
- secret plaintext offline cache or replay payload inclusion;
- broadening local execution classes beyond profile-supported classes;
- making operational/audit event publication required for replay success.
