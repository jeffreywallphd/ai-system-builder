# AI Companion: Image Manipulation Retry, Recovery, and Escalation Contracts

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-retry-recovery-escalation-contracts.md`
- Canonical implementation seam:
  - `src/shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts.ts`

## Why this exists
- Story 8.1.3 requires one reusable cross-layer contract for retry, recovery, and escalation decisions.
- Taxonomy (8.1.1) and resilience-state (8.1.2) already classify failure and operability; this seam translates those inputs into action guidance.

## Contract highlights
- Retry advice:
  - `retryEligible`
  - `retrySafe`
  - `retryMode` (`none` | `automatic` | `manual`)
  - `retryAfterMs`
- Recovery action hints:
  - `retry-automatic`
  - `retry-manual`
  - `user-action-required`
  - `backend-recovery-pending`
  - `terminal-not-retryable`
- Escalation:
  - `none`
  - `operator`
  - `admin`

## Canonical helpers
- `createImageManipulationRetryRecoveryContract(...)`
- `deriveImageManipulationRetryRecoveryContractFromClassification(...)`
- `deriveImageManipulationRetryRecoveryContractFromResilienceCondition(...)`
- `deriveImageManipulationRetryRecoveryContractFromResilienceSnapshot(...)`

## Integration seams in this slice
- Application failure normalization emits shared recovery envelopes:
  - `src/application/image-workflows/ports/ImageManipulationFailureNormalization.ts`
- Shared run API failure DTOs carry recovery guidance:
  - `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
  - `src/shared/schemas/image-workflows/ImageRunApiSchemaContracts.ts`
- Studio presenter degraded surfaces consume resilience-derived recovery guidance:
  - `src/ui/shared/images/ImageStudioPresenterContracts.ts`

## Posture rules
- Do not duplicate retry/recovery logic in UI copy or backend-specific adapters.
- Use taxonomy/resilience contracts as inputs, then produce recovery/escalation output.
- Preserve backend neutrality: adapters provide diagnostics; shared contracts provide product-level decisions.

## Tests
- `src/shared/contracts/image-workflows/tests/ImageManipulationRetryRecoveryContracts.test.ts`
- `src/application/image-workflows/tests/ImageManipulationFailureNormalization.test.ts`
- `src/shared/contracts/image-workflows/tests/ImageRunApiContracts.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageRunApiSchemaContracts.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
