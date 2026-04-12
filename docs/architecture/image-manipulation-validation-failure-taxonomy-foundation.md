# Image Manipulation Validation and Failure Taxonomy Foundation

## Purpose
Story 8.1.1 (Feature 8 / Epic 8.1) defines a unified validation and failure taxonomy for the image manipulation slice so assets, workflow/system configuration, run readiness, execution, result collection, and studio UX can classify degraded and terminal states consistently.

## Canonical taxonomy module
- `src/shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy.ts`

## Scope and boundaries
The taxonomy is platform-oriented and backend-neutral:
- it models product-level issue semantics for image manipulation,
- it does not expose ComfyUI- or transport-specific exception text as category truth,
- backend/provider quirks remain adapter diagnostics, not core taxonomy concepts.

## Layer taxonomy
Canonical issue layers:
- `asset-ingestion`
- `workflow-configuration`
- `run-readiness`
- `execution-dispatch`
- `node-availability`
- `result-collection`
- `preview-generation`
- `protected-retrieval`

These layers are the stable cross-layer vocabulary for issue ownership and reporting.

## Issue-kind and disposition model
- Issue kind:
  - `validation` (invalid payload, binding, or configuration semantics)
  - `operational` (runtime/storage/connectivity/dependency/platform conditions)
- Disposition:
  - `retryable` (safe candidate for explicit retry/recovery path)
  - `terminal` (requires correction, operator intervention, or explicit rerun)

This separates invalid-request semantics from operational failures and makes retry posture explicit.

## User-fixable vs operator/platform-fixable posture
Issue classifications carry:
- `userFixable` boolean for user-correctable conditions,
- `resolutionActor` (`user`, `operator`, `platform`) for operational ownership,
- `degraded` boolean for service-degraded-but-observable conditions.

This enables UI/presenter and audit/diagnostic flows to distinguish user follow-up from operator response paths.

## Machine-readable issue codes
Issue codes use a stable shape:
- `im.<layer-segment>.<kind>.<reason>`
- Example: `im.result.operational.partial-output-anomaly`

Canonical helpers:
- `createImageManipulationIssueCode(...)`
- `parseImageManipulationIssueCode(...)`
- `createImageManipulationIssueClassification(...)`

These ensure shared code structure while preserving room for local diagnostics payloads.

## Failure summary categories
Shared summary categories align execution/run/API surfaces:
- `validation`
- `translation`
- `dependency`
- `capacity`
- `timeout`
- `cancellation`
- `execution`
- `output`
- `connectivity`
- `internal`
- `unknown`

These categories are reused by:
- `ImageManipulationExecutionStatusContracts` (application execution status/failure contracts)
- `ImageRunApiContracts` (shared API contract failure categories)

## Execution normalization integration
`ImageManipulationFailureNormalization` now emits taxonomy classification in normalized failure payloads (`classification`) with:
- stable `issueCode`,
- canonical layer/kind/disposition,
- user-fixable/degraded indicators,
- resolution actor.

This provides one reusable failure-classification envelope across services, APIs, presenters, and diagnostics.

## Tests
- `src/shared/contracts/image-workflows/tests/ImageManipulationValidationFailureTaxonomy.test.ts`
- `src/application/image-workflows/tests/ImageManipulationFailureNormalization.test.ts`
