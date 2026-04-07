# Run Orchestration Transport Contracts

## Story alignment

- Feature: 16, Run Submission and Orchestration Core
- Epic: 16.1, Establish the Authoritative Run Domain and Submission Pipeline
- Story: 16.1.2, Create shared run submission, mutation, and status contracts

## Purpose

Define one stable shared run transport contract for submission, read/status access, cancellation/retry mutations, queue-relevant status reads, and lifecycle update envelopes so clients and server routes stop drifting across runtime-specific DTO variants.

## Canonical contract files

- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - Canonical route catalog and typed request/response contracts for:
    - `submitRun`
    - `getRunDetail`
    - `getRunStatus`
    - `cancelRun`
    - `retryRun`
    - `listQueueStatus`
    - `updateLifecycle`
  - Canonical run summary/detail/status/event envelope shapes.
  - Mapping helpers from `CanonicalRunRecord` to transport-safe summary/detail/status projections.
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
  - Schema-backed parsers and validation errors for the canonical run contracts.
  - Compatibility parsing for legacy runtime start-run payloads (`systemId`/`versionId`) so server endpoints can migrate without breaking existing clients.
- `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`
  - Compatibility facade now marked for migration; canonical run contract ownership moved to `RunOrchestrationTransportContracts.ts`.
- `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts`
  - Compatibility wrappers now delegate start-run and cancel-run parsing through canonical run schema parsers.

## Compatibility and migration notes

- Existing runtime SDK payload shapes are still accepted at transport boundaries.
- Canonical run submission parsing now normalizes both:
  - new run submission contract (`runtimeTarget` object)
  - legacy runtime start payload (`systemId`, `versionId`, optional `executionId`)
- Cancellation parsing now accepts run-oriented semantics and adapts to existing `executionId` mutation handlers.
- `SystemRuntimeTransportContracts` continues to expose legacy DTOs for current consumers, but run submission/mutation lifecycle ownership is now documented and implemented through the new run contract module.

## Validation and test coverage

- Contract tests:
  - `src/shared/contracts/runtime/tests/RunOrchestrationTransportContracts.test.ts`
- Schema tests:
  - `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
- Compatibility tests retained and updated in:
  - `src/shared/contracts/runtime/tests/SystemRuntimeTransportContracts.test.ts`
  - `src/shared/schemas/runtime/tests/SystemRuntimeTransportSchemaContracts.test.ts`

## Usage guidance

1. New run-facing API additions should import run contracts from `RunOrchestrationTransportContracts.ts`.
2. HTTP/WS/IPC boundaries should parse run payloads with `RunOrchestrationTransportSchemaContracts.ts`.
3. Existing runtime transport DTOs in `SystemRuntimeTransportContracts.ts` should be treated as migration shims, not new feature entry points.
