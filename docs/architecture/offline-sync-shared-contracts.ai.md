# AI Companion: Offline Sync Shared Contracts Usage Notes

## Story scope

Story 19.1.2 establishes shared offline-state/sync contracts so desktop host logic, API DTO/schema validation, and UI rendering rely on one canonical shape set.

## Canonical runtime contract package

- `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
- `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
- `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`

## What to use where

- Use `OfflineSynchronizationStateSnapshotDto` as the root offline/resync state object.
- Use `OfflinePendingOperationEnvelopeDto` for queued operations.
- Use `OfflineReconciliationOutcomeDto` (+ `OfflineConflictIndicatorDto`) for reconnect outcomes.
- Use `OfflineConnectivitySurfaceStateDto` for connectivity-aware UI state.
- Use parser helpers in `OfflineSynchronizationSchemaContracts` before persisting or serving payloads.

## Compatibility posture

- Domain/application offline policy models remain in place and include migration notes.
- Runtime UI connection state typing now maps to the shared connectivity-state contract shape.
