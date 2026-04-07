# AI Companion: Offline Local-Mode Authority Boundaries

## Purpose

Story 19.1.7 hardens the offline/local-mode architecture docs so future features keep limited local autonomy without creating silent competing truth.

## Canonical files

- `src/domain/platform/OfflineLocalModeBoundaries.ts`
- `src/application/common/OfflineResourceClassificationPolicy.ts`
- `src/application/common/OfflineLocalModeResynchronization.ts`
- `src/application/common/OfflineAuthoritativeSnapshotCache.ts`
- `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- `src/hosts/desktop/DesktopConnectivityStateService.ts`
- `src/hosts/desktop/DesktopOfflineSnapshotCacheHost.ts`
- `src/infrastructure/desktop/DesktopOfflineSnapshotCacheRepository.ts`
- `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
- `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
- `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`
- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/offline-local-mode-contributor-guide.md`

## Required invariants

- Desktop offline support is bounded local autonomy, not a second control plane.
- Authoritative global truth remains server-owned.
- Offline local state remains explicitly local until reconnect outcomes are decided.
- Client code must not treat offline local state as silently authoritative global truth.
- Conflict/rejection outcomes remain visible and require user/admin intervention where required.

## Current production model summary

- Explicit offline resource-class catalog with capability matrix, authority scope, behavior class, and storage bucket.
- Deterministic classification from visibility/role/sharing/sensitivity/storage-rule/device-trust inputs.
- Explicit local draft lifecycle and queued replay envelope semantics.
- Explicit reconnect decision actions (`apply-to-authoritative`, `conflict-requires-review`, `reject-not-allowed`).
- Canonical bounded conflict classes + decision-rule taxonomy.
- Explicitly limited offline execution classes and reconnect registration envelope flow.
- Explicit desktop connectivity-state transitions (`connected`, `degraded`, `reconnecting`, `disconnected`) derived from transport/session/trust/offline-intent probes.
- Dedicated desktop authoritative snapshot cache service + SQLite persistence with bounded retention and metadata integrity digest checks.
- Snapshot records persist logical resource snapshots and offline eligibility markers, not raw filesystem references.

## Server-authoritative-only baseline

Must remain server-authoritative:
- replay authorization and final acceptance/rejection;
- global lifecycle mutation for shared resources;
- secret plaintext materialization;
- authoritative run-orchestration history.

## Prohibited shortcuts (preserved)

- silent-global-divergence
- local-cache-as-global-authority
- unsignaled-authoritative-overwrite
- pre-marking queued operations as globally applied
- silent merge of local execution history into authoritative run history

## Contributor workflow pointer

Use `docs/offline-local-mode-contributor-guide.md` for extension sequence, required test updates, and prohibited implementation patterns.
