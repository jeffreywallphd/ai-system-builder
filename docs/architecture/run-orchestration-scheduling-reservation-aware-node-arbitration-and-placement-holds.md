# Reservation-Aware Node Arbitration and Temporary Placement Holds

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.2: Implement reservation-aware node arbitration and temporary placement holds

## Purpose

Add a short-lived reservation seam during scheduler assignment materialization so selected run/node pairs can be guarded by explicit placement holds before dispatch-preparation claim finalization. This reduces duplicate placement races and creates a stable extension point for richer future reservation and capacity policies.

## Canonical implementation map

- Placement-hold contracts and conflict model:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- Scheduler assignment materialization + hold lifecycle orchestration:
  - `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- Durable placement-hold persistence + conflict/expiry behavior:
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`

## Hold lifecycle behavior

1. Scheduler selects assignment intents from claimed queue leases.
2. Assignment gateway attempts `acquireNodePlacementHold` for each selected run/node pair.
3. If hold acquisition conflicts:
   - selected intent is not materialized
   - queue claim is released immediately for re-evaluation
4. If hold acquisition succeeds:
   - assignment finalization proceeds through `ClaimRunForNodeDispatchPreparationUseCase`
5. Hold is explicitly released after claim attempt completion (success or conflict).

## Conflict and expiry semantics

- Active-hold conflict reason: `held-by-another-owner`
- Hold conflict is node-scoped and explicit in result contracts.
- Expired holds are treated as reclaimable during acquisition.
- Hold release is token-guarded (`nodeId` + `holdToken`) to avoid accidental cross-release.

## Extension seam posture

- Placement-hold contracts remain application-layer and transport-agnostic.
- Queue leasing, scheduling policy evaluation, placement holds, and assignment claim finalization stay separated.
- Current hold semantics are intentionally lightweight and do not implement full capacity accounting or reservation calendars.
- Future quota/reservation-window/resource arbitration can extend this seam without reworking queue claim or dispatch boundaries.

## Verification baseline

- `src/application/runs/tests/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`
