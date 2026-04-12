# Image Manipulation Retry, Recovery, and Escalation Contracts

## Purpose
Story 8.1.3 (Feature 8 / Epic 8.1) defines shared contracts that explicitly classify whether a failure should be retried automatically, retried manually, corrected by the user, escalated to an operator/admin, or treated as terminal.

## Canonical implementation seam
- `src/shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts.ts`

## Why this contract exists
Earlier Feature 8 stories introduced:
- validation and failure taxonomy (`ImageManipulationValidationFailureTaxonomy`),
- resilience-state truth (`ImageManipulationResilienceStateContracts`).

This story adds the cross-layer recovery decision contract so application services, API DTOs, and presenters consume the same recovery semantics without duplicating heuristics.

## Core contract model
`ImageManipulationRetryRecoveryContract` contains three envelopes:

- `retry`
  - `retryEligible`
  - `retrySafe`
  - `retryMode` (`none`, `automatic`, `manual`)
  - `retryAfterMs`
- `recoveryAction`
  - `kind` (`retry-automatic`, `retry-manual`, `user-action-required`, `backend-recovery-pending`, `terminal-not-retryable`, `none`)
  - `userActionRequired`
  - `backendRecoveryPending`
  - `terminalNotRetryable`
  - `summary`
- `escalation`
  - `category` (`none`, `operator`, `admin`)
  - `required`

## Classification posture
- User-fixable validation issues become `user-action-required` and terminal-not-retryable until corrected.
- Retryable operational failures (timeout/connectivity/capacity/output anomalies) carry retry-safe retry guidance and optional `retryAfterMs`.
- Pending backend recovery conditions are represented as `backend-recovery-pending` with operator escalation.
- Non-retryable platform/operator faults are represented as `terminal-not-retryable` with explicit escalation category.

## Reuse across layers
- Application normalization:
  - `src/application/image-workflows/ports/ImageManipulationFailureNormalization.ts`
  - emits `recovery` guidance on normalized execution failures.
- Shared API contracts:
  - `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
  - allows run failure DTOs to include retry/recovery/escalation payloads.
- Studio presenter contracts:
  - `src/ui/shared/images/ImageStudioPresenterContracts.ts`
  - derives surface recovery hints from resilience snapshots, avoiding UI-only retry logic.

## Boundary and extension rules
- Keep retry/recovery logic in shared/application contract seams, not adapter-only error strings or UI copy.
- Resilience conditions remain canonical operability truth; recovery contracts translate that truth into action guidance.
- New categories should extend enums/contracts first, then be consumed by adapters/services/presenters.

## Tests
- `src/shared/contracts/image-workflows/tests/ImageManipulationRetryRecoveryContracts.test.ts`
- `src/application/image-workflows/tests/ImageManipulationFailureNormalization.test.ts`
- `src/shared/contracts/image-workflows/tests/ImageRunApiContracts.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageRunApiSchemaContracts.test.ts`
- `src/ui/shared/tests/ImageStudioPresenterContracts.test.ts`
