# AI Companion: Offline Local-Mode Contributor Guide

## Human doc

- `docs/offline-local-mode-contributor-guide.md`
- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-sync-shared-contracts.md`

## Purpose

Keep offline-aware feature work aligned to one bounded local-autonomy model and prevent silent competing authority.

## Required implementation order

1. Shared offline contracts/schemas.
2. Domain offline boundary catalog and policy model.
3. Application classification/resynchronization/cache/pending-operation persistence seams.
   - include controlled reconnect coordinator (`src/application/common/OfflineControlledResynchronizationCoordinator.ts`) and keep replay outcome capture explicit.
   - include structured blocked replay metadata (reason code/message/dependency blockers) in coordinator results so UI/admin surfaces can explain non-replayed operations.
4. Desktop host profile + offline cache/pending-operation runtime gating.
   - include desktop connectivity-state host service (`src/hosts/desktop/DesktopConnectivityStateService.ts`) and keep connectivity heuristics out of page code.
   - include desktop controlled-resynchronization host runtime (`src/hosts/desktop/DesktopOfflineResynchronizationHost.ts`) when reconnect workflow composition changes.
5. Infrastructure adapter and persistence updates.
6. Adapter/UI consumption updates.

## Invariants to preserve

- offline local state is not authoritative global truth;
- reconnect conflict/rejection outcomes are visible and explicit;
- queued operations keep divergence disclosure and replay descriptors;
- desktop host remains control-plane-client and non-authoritative.
- authoritative snapshot cache stores logical payload + sync metadata, not filesystem references.
- snapshot cache writes respect eligibility and protected-storage requirements.
- reconnect paths must perform explicit cache refresh/invalidation maintenance so stale/revoked content is not left looking authoritative.
- pending-operation persistence keeps actor/workspace context, dependency metadata, base-version metadata, retryability metadata, and canonical replay payload digest for deterministic reconnect replay.
- reconnect cleanup semantics classify pending operations (`successful`, `conflicted`, `failed`, `abandoned`) with explicit remove-vs-retain behavior for queryable local state transitions.

## Prohibited patterns

- local cache as global write authority;
- pre-marking queued mutations as globally applied;
- silent auto-merge of conflict/rejection outcomes;
- bypassing domain/application offline seams from UI or transport layers.

## Test and doc checklist

- update relevant offline tests across domain/application/host/shared contract modules;
- include desktop connectivity-state transition coverage in host tests when connectivity semantics change;
- keep `.md` and `.ai.md` offline docs paired and updated together.
