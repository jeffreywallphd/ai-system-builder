# Feature 8 / Epic 8.1 Story 8.1.4: Image Slice Resilience and Error-Handling Architecture

## Story alignment

- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.1: Cross-Layer Validation and Failure Taxonomy Foundation
- Story 8.1.4: Document the resilience and error-handling architecture for the image manipulation slice

## Purpose

Define one implementation-truth architecture for how validation failures, runtime/storage failures, degraded backend conditions, retry/recovery guidance, user messaging, and diagnostics flow across the image manipulation vertical slice.

This story hardens the existing slice (Features 1-7) without breaking clean architecture boundaries and without reintroducing renderer-local or adapter-local shortcuts.

## Canonical seams in this story

Shared cross-layer contracts:

- `src/shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy.ts`
- `src/shared/contracts/image-workflows/ImageManipulationResilienceStateContracts.ts`
- `src/shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts.ts`
- `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`

Application normalization and readiness orchestration:

- `src/application/image-workflows/ports/ImageManipulationFailureNormalization.ts`
- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`

UI presenter composition seams:

- `src/ui/shared/images/ImageStudioPresenterContracts.ts`
- `src/ui/shared/images/ImageStudioUxCopy.ts`

## Architecture model: failure and resilience responsibilities

### 1. Taxonomy is failure meaning

`ImageManipulationValidationFailureTaxonomy` is the canonical model for issue layer, issue kind, disposition, degraded semantics, resolution actor, and stable issue codes.

Ownership:

- Shared contracts define taxonomy vocabulary and code shapes.
- Infrastructure adapters may provide raw signals, but not category truth.
- Application and API layers consume taxonomy classifications as the product-level failure language.

### 2. Resilience state is operability truth

`ImageManipulationResilienceStateContracts` models whether the slice is currently healthy, degraded, partial, blocked, pending recovery, temporarily unavailable, or unavailable.

Ownership:

- Application services produce resilience conditions and snapshots from readiness/execution signals.
- API DTOs carry resilience envelopes for read/status/detail surfaces.
- UI presenters render degraded/blocked/pending states from these envelopes instead of inventing local state taxonomies.

### 3. Retry/recovery is action guidance

`ImageManipulationRetryRecoveryContracts` translates taxonomy/resilience inputs into explicit action posture (`automatic`, `manual`, `user-action-required`, `backend-recovery-pending`, `terminal-not-retryable`) and escalation hints.

Ownership:

- Shared derivation helpers own retry/recovery policy semantics.
- Application normalization and presenter mapping consume derived guidance.
- UI copy explains guidance; it does not define retry eligibility logic.

## Canonical flow: infrastructure -> application -> API -> presenter

1. Infrastructure execution/readiness adapters surface backend and node outcomes as bounded diagnostics and status signals.
2. Application services normalize those outcomes:
   - `normalizeImageManipulationExecutionFailure(...)` classifies and sanitizes execution failures, then attaches recovery contracts.
   - `GetImageManipulationExecutionReadinessUseCase` derives readiness issues, node-availability posture, and resilience snapshots.
3. Shared API contracts transport normalized failure, recovery, and resilience envelopes through `ImageRunApiContracts` DTOs.
4. Studio presenter contracts map the API/interaction state to user-facing surface states (`loading|empty|error|ready|degraded`) while keeping technical details in advanced diagnostics.

This keeps failure behavior deterministic across run operations, status reads, and studio UX surfaces.

## Degraded backend and partial-availability posture

The slice explicitly distinguishes:

- invalid request/configuration (`validation` kind, usually user-fixable),
- operational faults (`operational` kind, may be retryable or terminal),
- degraded but still usable states,
- blocked/unavailable states that prevent launch/progression.

Examples represented by current contracts:

- backend reachable but degraded,
- no eligible execution node for an otherwise valid request,
- preview or retrieval temporarily unavailable after run completion,
- partial output anomalies where outputs exist but collection is incomplete.

These are represented as resilience conditions and recovery guidance, not collapsed into one generic "error" bucket.

## Boundary rules (required)

- Do not define failure taxonomy in adapter-specific error strings, HTTP handler branches, or component-local conditionals.
- Do not place retry policy in UI button handlers or copy maps.
- Do not treat raw backend/provider payloads as user-facing truth.
- Keep diagnostics sanitized and bounded; primary UX uses safe summaries while advanced diagnostics stay hidden by default.
- Keep run/history/result identity authoritative through API and persisted records; never replace with local path-based shortcuts.

## Placement guide for future Feature 8 stories

When extending resilience/error handling:

- Add or extend failure meaning in shared taxonomy/resilience/recovery contracts first.
- Map new infrastructure signals into those contracts in application normalization/use cases.
- Extend API DTO/schema surfaces only after contract semantics are stable.
- Extend presenter/view-model projections for messaging and actions last.

This preserves clean boundaries while keeping cross-layer behavior aligned.

## References (compose, do not duplicate)

Feature 8 foundations:

- `docs/architecture/image-manipulation-validation-failure-taxonomy-foundation.md`
- `docs/architecture/image-manipulation-resilience-state-contracts.md`
- `docs/architecture/image-manipulation-retry-recovery-escalation-contracts.md`
- `docs/architecture/image-manipulation-studio-resilience-messaging-conventions.md`

Features 1-7 baseline and integration posture:

- `docs/architecture/image-asset-feature-1-final-baseline.md`
- `docs/architecture/image-workflow-system-definition-layer.md`
- `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`
- `docs/architecture/execution-node-domain-model-image-backend-hosting.md`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`
