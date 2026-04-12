# Image Manipulation Resilience-State Contracts

## Purpose
Story 8.1.2 (Feature 8 / Epic 8.1) defines a shared resilience-state contract for degraded, partially available, blocked, and temporarily unavailable behavior across the image manipulation slice. The goal is explicit state truth, not implicit recovery heuristics.

## Canonical implementation seam
- `src/shared/contracts/image-workflows/ImageManipulationResilienceStateContracts.ts`

## Why this contract exists
The slice already separates:
- authoritative state truth,
- execution readiness and backend availability,
- node eligibility and dispatchability,
- result and preview readiness,
- protected/asset retrieval availability.

This contract gives those seams one cross-layer vocabulary so APIs, presenters, orchestration services, and monitoring can describe partial readiness without collapsing to generic failure.

## Core model
Resilience scopes:
- `authoritative-state`
- `execution-availability`
- `node-eligibility`
- `result-availability`
- `preview-readiness`
- `asset-retrieval`
- `backend-connectivity`

Resilience states:
- `healthy`
- `degraded`
- `partial`
- `pending-recovery`
- `blocked`
- `temporarily-unavailable`
- `unavailable`

Durability classes:
- `temporary`
- `persistent`
- `unknown`

Recovery kinds:
- `none`
- `retry`
- `pending-recovery`
- `user-action`
- `operator-action`
- `platform-repair`

## Condition and snapshot contracts
- A condition (`ImageManipulationResilienceCondition`) carries stable `code`, `scope`, `state`, `summary`, `observedAt`, durability, explicit recovery posture, and optional taxonomy classification.
- A snapshot (`ImageManipulationResilienceSnapshot`) aggregates conditions into authoritative slice-level truth:
  - overall `state`,
  - `usable` vs `partiallyUsable`,
  - grouped degraded/blocked/unavailable condition collections.

Aggregation is deterministic and severity-ordered so downstream consumers do not invent independent heuristics.

## Required scenario representation
The model explicitly supports:
- workflow valid but no eligible node:
  - scope `node-eligibility`, state `blocked`
- run completed but result preview pending:
  - scope `preview-readiness`, state `pending-recovery`
- asset present but retrieval temporarily unavailable:
  - scope `asset-retrieval`, state `temporarily-unavailable`
- backend reachable but degraded:
  - scope `execution-availability`, state `degraded`

## API, presenter, and monitoring projections
The contract includes reusable projections:
- `toImageManipulationResilienceApiProjection(...)`
- `toImageManipulationResilienceMonitoringProjection(...)`

Execution readiness and API DTO contracts can carry resilience snapshots directly, and presenter surfaces can attach resilience details to degraded states.

## Boundary posture
- Resilience state is not a replacement for validation/failure taxonomy. It complements taxonomy by expressing current operability and recovery posture.
- Backend/provider payloads remain diagnostics; resilience state remains canonical product-level truth.
- Recovery remains explicit (`retryable`, `blocking`, recovery kind), avoiding hidden fallback behavior.

## Representative adoption seams
- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
- `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
- `src/ui/shared/images/ImageStudioPresenterContracts.ts`

## Tests
- `src/shared/contracts/image-workflows/tests/ImageManipulationResilienceStateContracts.test.ts`
- `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
