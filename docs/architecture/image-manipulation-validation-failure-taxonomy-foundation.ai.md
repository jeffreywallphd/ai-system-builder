# AI Companion: Image Manipulation Validation and Failure Taxonomy Foundation

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-validation-failure-taxonomy-foundation.md`
- Canonical code seam:
  - `src/shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy.ts`

## Why this exists
- Story 8.1.1 needs one cross-layer validation/failure taxonomy for the image-manipulation slice.
- The slice already spans asset ingestion, workflow/system setup, run readiness checks, execution dispatch, node state, output collection, preview generation, and protected retrieval.
- Feature 8 resilience work requires these seams to share retryability, degraded-state, terminal-state, and ownership semantics.

## Canonical taxonomy model
- Layer taxonomy (`asset-ingestion`, `workflow-configuration`, `run-readiness`, `execution-dispatch`, `node-availability`, `result-collection`, `preview-generation`, `protected-retrieval`)
- Issue kind (`validation`, `operational`)
- Failure disposition (`retryable`, `terminal`)
- Resolution actor (`user`, `operator`, `platform`)
- Summary categories (validation/translation/dependency/capacity/timeout/cancellation/execution/output/connectivity/internal/unknown)

## Machine-readable issue codes
- Code shape: `im.<layer-segment>.<kind>.<reason>`
- Helpers:
  - `createImageManipulationIssueCode(...)`
  - `parseImageManipulationIssueCode(...)`
  - `createImageManipulationIssueClassification(...)`

This keeps failures machine-sortable without coupling category semantics to one backend.

## Integration posture
- `ImageManipulationExecutionStatusContracts` and `ImageRunApiContracts` now reuse shared summary categories.
- `ImageManipulationFailureNormalization` emits normalized `classification` payloads so application/API/presenter/audit flows can consume one taxonomy envelope.
- Backend-specific details remain diagnostics only, not taxonomy truth.

## Expected usage pattern
1. Determine layer boundary where issue occurred.
2. Classify issue kind (`validation` vs `operational`).
3. Set retry posture (`retryable` vs `terminal`).
4. Mark degraded/user-fixable semantics and resolution actor.
5. Emit stable issue code and include optional sanitized diagnostics separately.

## Tests
- `src/shared/contracts/image-workflows/tests/ImageManipulationValidationFailureTaxonomy.test.ts`
- `src/application/image-workflows/tests/ImageManipulationFailureNormalization.test.ts`
