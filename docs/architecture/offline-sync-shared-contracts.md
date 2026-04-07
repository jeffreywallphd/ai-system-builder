# Offline Sync Shared Contracts Usage Notes

Story 19.1.2 introduces canonical shared offline-state and synchronization contracts for desktop/local-mode behavior.

## Canonical files

- `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
- `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
- `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`

Story 19.1.4 extends this package with local draft lifecycle and replayability semantics for disconnected work.
Story 19.1.5 extends it with explicit conflict-class metadata and reconciliation decision markers.
Story 19.1.6 extends it with explicit offline local-execution metadata and reconnect registration contracts.

## Usage guidance

- Use `OfflineSynchronizationStateSnapshotDto` as the top-level state shape for workspace offline/resync views.
- Use `OfflineDraftStateDto.syncStatus` transitions to model local draft lifecycle explicitly (`local-only`, `queued-pending-sync`, `sync-conflict`, `sync-rejected`, `sync-applied`).
- Use `OfflinePendingOperationEnvelopeDto` for queue entries persisted while disconnected, including the required structured `replayDescriptor` for reconnect replay.
- Use `OfflineSyncQueueStateDto.pendingRunSubmissions` for pending run submissions that are locally durable but not yet authoritative.
- Use `OfflineSyncQueueStateDto.localExecutionRegistrations` for queued registration of local offline executions.
- Use `OfflineLocalExecutionRecordDto` to persist local execution metadata (actor/time/digests/output summaries/mode context).
- Use `OfflineLocalExecutionRegistrationEnvelopeDto` for reconnect registration attempts of local execution records.
  - keep `execution.historyScope='explicit-local-activity'`
  - do not treat registration queue entries as authoritative orchestration success
- Use `OfflineReconciliationOutcomeDto` and `OfflineConflictIndicatorDto` for reconnect outcomes and user-review surfaces.
  - `OfflineConflictIndicatorDto.conflictClass` carries canonical bounded conflict category.
  - `OfflineReconciliationOutcomeDto` now carries `decisionRule`, `requiresAdminAttention`, and `preserveLocalDraftAsUnsynced`.
- Use `OfflineConnectivitySurfaceStateDto` for connectivity-aware status rendering in UI surfaces.
- Validate incoming/outgoing payloads with `parseOfflineSynchronizationStateSnapshotDto(...)` (and related parser helpers) before persistence or transport.

## Migration notes

- Domain `OfflineQueuedMutationEnvelope` and application `OfflineResynchronizationDecision` remain policy seams and are marked for migration alignment.
- UI realtime connection snapshots now align to the shared connectivity-state contract shape (`state`/`stale`/`detail`).
- Conflict-class and decision-rule fields are required to prevent ad hoc reconnect handling and over-claiming automatic resolution.
- Local execution registration queue entries are required to keep offline local runs explicit and prevent silent merge into authoritative remote run history.
