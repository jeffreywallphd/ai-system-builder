# Image Manipulation Execution Application Ports

## Purpose
This document defines the Story 3.1.1 architecture boundary for image-manipulation backend execution in AI Loom.

The goal is to keep workflow/system models authoritative in the application/domain layers while treating ComfyUI (or any future runtime) as a replaceable infrastructure adapter.

## Canonical port module
- `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`

## Intended consumers
- Run orchestration use cases that dispatch prepared execution requests.
- Image-workflow/system services that need normalized execution status and outputs.
- Infrastructure execution adapters that implement backend communication (ComfyUI first, but not required).

## Port responsibilities
The application execution ports cover six responsibilities:

1. Dispatch execution jobs
- `IImageManipulationExecutionDispatchPort`
- Accepts translation-ready workflow/system/input/output context expressed in AI Loom terms.

2. Query execution state
- `IImageManipulationExecutionStateQueryPort`
- Returns normalized run/job state snapshots and terminal-error semantics.

3. Query or stream progress
- `IImageManipulationExecutionProgressPort`
- Supports polling (`listExecutionProgress`) and subscription (`subscribeToExecutionProgress`) without exposing transport details.

4. Request cancellation
- `IImageManipulationExecutionCancellationPort`
- Normalizes cancellation outcomes (`accepted`, `already-terminal`, `not-supported`, etc.).

5. Discover outputs
- `IImageManipulationExecutionOutputPort`
- Returns normalized output references (`asset-reference`, `dataset-item-reference`, `storage-object-reference`, `external-url`, `inline-value`).

6. Check backend health and capabilities
- `IImageManipulationExecutionCapabilityPort`
- Reports backend health and supported operation/contract capabilities.

## Boundary rules
- Application/domain consumers must not depend on ComfyUI request/response DTOs.
- Ports must remain phrased in AI Loom concepts: workflow definition, system binding, logical asset/dataset references, run identity, and normalized output references.
- Backend-specific terms remain inside infrastructure adapters.
- UI/transport layers must call application use cases, not backend adapters directly.

## Notes for future orchestration
- The dispatch request shape includes translation metadata and run/workspace identity so future run orchestration can prepare once and dispatch to any backend adapter.
- Progress/state/output contracts are normalized to support consistent run projections regardless of runtime provider.

## Story 3.1.2 translation bridge
- Translation request/response contracts that bridge Feature 2 authoritative workflow/system definitions into backend-executable internal payloads are defined in:
  - `src/application/image-workflows/ports/ImageManipulationTranslationContracts.ts`
- Architecture reference note:
  - `docs/architecture/image-manipulation-translation-contracts.md`

## Story 3.1.3 normalized status/error contracts
- Backend-neutral job-state/progress/completion/failure contracts are defined in:
  - `src/application/image-workflows/ports/ImageManipulationExecutionStatusContracts.ts`
- Architecture reference note:
  - `docs/architecture/image-manipulation-execution-status-contracts.md`

## Story 3.1.4 output discovery and collected-result contracts
- Backend output-discovery and collected-result contracts are defined in:
  - `src/application/image-workflows/ports/ImageManipulationOutputDiscoveryContracts.ts`
- Architecture reference note:
  - `docs/architecture/image-manipulation-output-discovery-and-collection-contracts.md`
