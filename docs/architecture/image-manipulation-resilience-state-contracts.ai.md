# AI Companion: Image Manipulation Resilience-State Contracts

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-resilience-state-contracts.md`
- Canonical implementation seam:
  - `src/shared/contracts/image-workflows/ImageManipulationResilienceStateContracts.ts`

## Why this exists
- Story 8.1.2 requires explicit resilience-state contracts for degraded, partially available, blocked, and temporarily unavailable slice behavior.
- Feature 8 needs state truth that can represent partial readiness and recovery posture without flattening everything into generic failure.

## Contract highlights
- Shared scopes:
  - `authoritative-state`, `execution-availability`, `node-eligibility`, `result-availability`, `preview-readiness`, `asset-retrieval`, `backend-connectivity`
- Shared states:
  - `healthy`, `degraded`, `partial`, `pending-recovery`, `blocked`, `temporarily-unavailable`, `unavailable`
- Shared durability:
  - `temporary`, `persistent`, `unknown`
- Shared recovery kinds:
  - `none`, `retry`, `pending-recovery`, `user-action`, `operator-action`, `platform-repair`

## Canonical helpers
- `createImageManipulationResilienceCondition(...)`
- `createImageManipulationResilienceSnapshot(...)`
- `isImageManipulationResilienceBlockingState(...)`
- `isImageManipulationResilienceUnavailableState(...)`
- `toImageManipulationResilienceApiProjection(...)`
- `toImageManipulationResilienceMonitoringProjection(...)`

## Cross-layer reuse in this slice
- Execution readiness now emits a resilience snapshot:
  - `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
- Image run API contracts now accept resilience envelopes for readiness/result/detail payloads:
  - `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
- Studio presenter degraded surfaces can carry resilience context:
  - `src/ui/shared/images/ImageStudioPresenterContracts.ts`

## Required scenario coverage
- workflow valid but no eligible node -> `node-eligibility` + `blocked`
- run completed but preview pending -> `preview-readiness` + `pending-recovery`
- asset present but retrieval temporarily unavailable -> `asset-retrieval` + `temporarily-unavailable`
- backend reachable but degraded -> `execution-availability` + `degraded`

## Tests
- `src/shared/contracts/image-workflows/tests/ImageManipulationResilienceStateContracts.test.ts`
- `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`
- `src/shared/contracts/image-workflows/tests/ImageRunApiContracts.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
