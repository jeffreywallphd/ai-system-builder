# AI Companion: Image Manipulation Resilience Verification Matrix

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-resilience-verification-matrix.md`
- Primary verification seams:
  - `src/infrastructure/api/studio-shell/tests/ImageManipulationFailurePaths.integration.test.ts`
  - `src/application/image-assets/tests/ImageAssetPreviewContentUseCases.test.ts`
  - `src/application/image-assets/tests/GetImageAssetOriginalContentUseCase.test.ts`
  - `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`

## Why this exists
- Story 8.4.1 requires representative resilience verification across the image manipulation slice under degraded/failure conditions.
- Feature 8 hardening is complete only when failure behavior is verifiably coherent end to end.

## Matrix intent
- Cover representative failure classes:
  - invalid upload,
  - incompatible saved system/runtime context,
  - no eligible backend node,
  - transient dispatch failure,
  - cancelled run,
  - missing output collection,
  - preview-generation delay/failure,
  - protected retrieval unavailability.
- Assert normalized outcomes and recovery posture, not backend-local payload assumptions.

## Guardrails
- Keep authoritative contracts as source of truth.
- Preserve run/result/history coherence under failure.
- Keep retryability and user/operator guidance explicit.
- Avoid hidden local fallback behavior.

## Maintenance rule
- When new resilience-sensitive failure classes are added, update this matrix and `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md` together.
