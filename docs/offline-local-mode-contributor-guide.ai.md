# AI Companion: Offline Local-Mode Contributor Guide

## Human doc

- `docs/offline-local-mode-contributor-guide.md`
- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-sync-shared-contracts.md`
- `docs/architecture/offline-local-mode-audit-operational-hooks.md`

## Purpose

Keep offline-aware feature work aligned to one bounded local-autonomy model and prevent silent competing authority.

## Required implementation order

1. Shared offline contracts/schemas.
2. Domain offline boundary catalog and policy model.
3. Application classification/resynchronization/cache/pending-operation persistence seams.
  - include local-execution registration persistence/replay seams (`src/application/common/OfflineLocalExecutionRegistrationPersistence.ts`) when supported local execution registration behavior changes.
  - include controlled reconnect coordinator (`src/application/common/OfflineControlledResynchronizationCoordinator.ts`) and keep replay outcome capture explicit.
  - include desktop startup recovery/reconciliation seam (`src/application/common/OfflineDesktopStartupRecovery.ts`) when restart-time interrupted-resync behavior changes.
  - include structured blocked replay metadata (reason code/message/dependency blockers) in coordinator results so UI/admin surfaces can explain non-replayed operations.
  - include offline event hook contracts (`src/application/common/OfflineOperationalEventPorts.ts`) and emit sanitized reconnect outcome events.
4. Desktop host profile + offline cache/pending-operation runtime gating.
   - include desktop connectivity-state host service (`src/hosts/desktop/DesktopConnectivityStateService.ts`) and keep connectivity heuristics out of page code.
   - include desktop controlled-resynchronization host runtime (`src/hosts/desktop/DesktopOfflineResynchronizationHost.ts`) when reconnect workflow composition changes.
   - include runtime adapter wiring (`src/infrastructure/api/system-runtime/DesktopOfflineOperationalEventSink.ts`) when operational/governance publication paths change.
   - include structured offline observability adapter seams (`src/infrastructure/api/system-runtime/OfflineOperationalObservability.ts`, `src/infrastructure/api/system-runtime/OfflineOperationalObservabilityRedaction.ts`) when reconnect diagnostics/metrics behavior changes.
5. Infrastructure adapter and persistence updates.
6. Adapter/UI consumption updates.
   - keep status derivation in shared presenter seams.
   - keep host/application sync mechanics outside UI components.
   - include explicit unresolved-work interaction flows (preserved drafts, sync conflicts, replay outcomes, first follow-up actions) when story scope targets reconnect UX.
   - keep unsupported auto-merge limitations explicit in UI copy.

## Desktop cache + reconnect extension map

- cache admission + snapshot persistence:
  - `src/application/common/OfflineResourceClassificationPolicy.ts`
  - `src/application/common/OfflineAuthoritativeSnapshotCache.ts`
  - `src/hosts/desktop/DesktopOfflineSnapshotCacheHost.ts`
  - `src/infrastructure/desktop/DesktopOfflineSnapshotCacheRepository.ts`
- connectivity transitions:
  - `src/hosts/desktop/DesktopConnectivityStateService.ts`
- queue durability + replay prep:
  - `src/application/common/OfflinePendingOperationPersistence.ts`
  - `src/application/common/OfflineLocalExecutionRegistrationPersistence.ts`
  - `src/hosts/desktop/DesktopOfflinePendingOperationHost.ts`
  - `src/hosts/desktop/DesktopOfflineLocalExecutionRegistrationHost.ts`
  - `src/infrastructure/desktop/DesktopOfflinePendingOperationRepository.ts`
  - `src/infrastructure/desktop/DesktopOfflineLocalExecutionRegistrationRepository.ts`
  - `src/infrastructure/desktop/DesktopOfflineValueProtection.ts`
- reconnect coordination + cache cleanup:
  - `src/application/common/OfflineControlledResynchronizationCoordinator.ts`
  - `src/application/common/OfflineDesktopStartupRecovery.ts`
  - `src/hosts/desktop/DesktopOfflineResynchronizationHost.ts`
  - `src/infrastructure/desktop/DesktopOfflineResynchronizationRecoveryRepository.ts`
  - `src/infrastructure/api/system-runtime/OfflineOperationalObservability.ts`
  - `src/infrastructure/api/system-runtime/OfflineOperationalObservabilityRedaction.ts`
- shared queue/connectivity/outcome contracts:
  - `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
  - `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
  - `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`
- desktop shared UI status seams:
  - `src/ui/shared/connectivity/DesktopConnectivityService.ts`
  - `src/ui/presenters/DesktopOfflineStatusPresenter.ts`
  - `src/ui/shared/connectivity/DesktopOfflineStatusSurface.tsx`
  - `src/ui/layout/AppLayout.tsx`

## Invariants to preserve

- offline local state is not authoritative global truth;
- reconnect conflict/rejection outcomes are visible and explicit;
- queued operations keep divergence disclosure and replay descriptors;
- local execution registrations keep explicit-local history scope and output metadata until authoritative linkage succeeds;
- desktop host remains control-plane-client and non-authoritative.
- authoritative snapshot cache stores logical payload + sync metadata, not filesystem references.
- snapshot cache writes respect eligibility and protected-storage requirements.
- offline repositories should persist explicit value-protection posture metadata and protect sensitive JSON payload fields when platform-protected storage is available.
- reconnect paths must perform explicit cache refresh/invalidation maintenance so stale/revoked content is not left looking authoritative.
- pending-operation persistence keeps actor/workspace context, dependency metadata, base-version metadata, retryability metadata, and canonical replay payload digest for deterministic reconnect replay.
- reconnect cleanup semantics classify pending operations (`successful`, `conflicted`, `failed`, `abandoned`) with explicit remove-vs-retain behavior for queryable local state transitions.
- revocation/permission-loss replay rejections should persist non-retryable reason codes so rejected local queue state is explicit and not silently reattempted.
- reconnect diagnostics should include correlatable attempt/replay/cache markers (`requestId`, `correlationId`, `syncAttemptId`) and sanitized replay-failure summaries for production triage.
- startup recovery should classify retryable vs manual-follow-up interrupted replay cases explicitly and keep unresolved state queryable.

## Deferred unless explicitly scoped

- no automatic multi-branch conflict merge expansion.
- no desktop-to-desktop queue merge protocol.
- no secret plaintext cache path.
- no local cache/draft promotion to authoritative truth without reconnect decisions.
- no replay control-flow dependency on best-effort event publication.

## Prohibited patterns

- local cache as global write authority;
- pre-marking queued mutations as globally applied;
- silent auto-merge of conflict/rejection outcomes;
- bypassing domain/application offline seams from UI or transport layers.

## Test and doc checklist

- update relevant offline tests across domain/application/host/shared contract modules;
- include desktop connectivity-state transition coverage in host tests when connectivity semantics change;
- include shared desktop offline-status service/presenter/surface coverage when offline UX behavior changes;
- include interaction-flow coverage for preserved drafts/conflicts/replay-outcome interpretation when reconnect UX behavior changes;
- keep `.md` and `.ai.md` offline docs paired and updated together.
