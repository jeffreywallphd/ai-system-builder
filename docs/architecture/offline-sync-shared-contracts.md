# Offline Sync Shared Contracts Usage Notes

Story 19.1.2 introduces canonical shared offline-state and synchronization contracts for desktop/local-mode behavior.

## Canonical files

- `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
- `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
- `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`

## Usage guidance

- Use `OfflineSynchronizationStateSnapshotDto` as the top-level state shape for workspace offline/resync views.
- Use `OfflinePendingOperationEnvelopeDto` for queue entries persisted while disconnected.
- Use `OfflineReconciliationOutcomeDto` and `OfflineConflictIndicatorDto` for reconnect outcomes and user-review surfaces.
- Use `OfflineConnectivitySurfaceStateDto` for connectivity-aware status rendering in UI surfaces.
- Validate incoming/outgoing payloads with `parseOfflineSynchronizationStateSnapshotDto(...)` (and related parser helpers) before persistence or transport.

## Migration notes

- Domain `OfflineQueuedMutationEnvelope` and application `OfflineResynchronizationDecision` remain policy seams and are marked for migration alignment.
- UI realtime connection snapshots now align to the shared connectivity-state contract shape (`state`/`stale`/`detail`).
