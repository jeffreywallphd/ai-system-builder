# Offline Sync Shared Contracts Usage Notes

Story 19.1.2 introduces canonical shared offline-state and synchronization contracts for desktop/local-mode behavior.

## Canonical files

- `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
- `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
- `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`

Story 19.1.4 extends this package with local draft lifecycle and replayability semantics for disconnected work.
Story 19.1.5 extends it with explicit conflict-class metadata and reconciliation decision markers.

## Usage guidance

- Use `OfflineSynchronizationStateSnapshotDto` as the top-level state shape for workspace offline/resync views.
- Use `OfflineDraftStateDto.syncStatus` transitions to model local draft lifecycle explicitly (`local-only`, `queued-pending-sync`, `sync-conflict`, `sync-rejected`, `sync-applied`).
- Use `OfflinePendingOperationEnvelopeDto` for queue entries persisted while disconnected, including the required structured `replayDescriptor` for reconnect replay.
- Use `OfflineSyncQueueStateDto.pendingRunSubmissions` for pending run submissions that are locally durable but not yet authoritative.
- Use `OfflineReconciliationOutcomeDto` and `OfflineConflictIndicatorDto` for reconnect outcomes and user-review surfaces.
  - `OfflineConflictIndicatorDto.conflictClass` carries canonical bounded conflict category.
  - `OfflineReconciliationOutcomeDto` now carries `decisionRule`, `requiresAdminAttention`, and `preserveLocalDraftAsUnsynced`.
- Use `OfflineConnectivitySurfaceStateDto` for connectivity-aware status rendering in UI surfaces.
- Validate incoming/outgoing payloads with `parseOfflineSynchronizationStateSnapshotDto(...)` (and related parser helpers) before persistence or transport.

## Migration notes

- Domain `OfflineQueuedMutationEnvelope` and application `OfflineResynchronizationDecision` remain policy seams and are marked for migration alignment.
- UI realtime connection snapshots now align to the shared connectivity-state contract shape (`state`/`stale`/`detail`).
- Conflict-class and decision-rule fields are required to prevent ad hoc reconnect handling and over-claiming automatic resolution.
