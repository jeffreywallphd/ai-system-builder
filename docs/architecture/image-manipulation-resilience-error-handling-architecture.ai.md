# AI Companion: Image Slice Resilience and Error-Handling Architecture

## Source of truth
- Canonical human doc:
  - `docs/architecture/image-manipulation-resilience-error-handling-architecture.md`
- Canonical implementation seams:
  - `src/shared/contracts/image-workflows/ImageManipulationValidationFailureTaxonomy.ts`
  - `src/shared/contracts/image-workflows/ImageManipulationResilienceStateContracts.ts`
  - `src/shared/contracts/image-workflows/ImageManipulationRetryRecoveryContracts.ts`
  - `src/application/image-workflows/ports/ImageManipulationFailureNormalization.ts`
  - `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
  - `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
  - `src/ui/shared/images/ImageStudioPresenterContracts.ts`

## Why this exists
- Story 8.1.4 needs one architecture note that composes Feature 8 contract work into one cross-layer operational model.
- The image slice already has taxonomy (8.1.1), resilience-state contracts (8.1.2), and retry/recovery contracts (8.1.3); this note defines how they are applied end-to-end.
- Required posture: harden failure behavior without reintroducing local shortcuts or boundary leaks.

## Canonical posture
- Taxonomy defines failure meaning.
- Resilience snapshot defines operability/degraded truth.
- Retry/recovery contracts define action guidance.
- Application normalization and readiness services assemble these envelopes.
- API contracts transport them consistently.
- Presenter surfaces consume them for user-safe messaging and explicit next-step guidance.

## Flow summary
1. Adapter/backend signals and diagnostics enter application ports.
2. Application derives normalized failure + resilience + recovery envelopes.
3. `ImageRunApiContracts` carries those envelopes through read/status/detail DTOs.
4. Studio presenter maps envelopes into `loading|empty|error|ready|degraded` UX states with advanced diagnostics hidden by default.

## Guardrails
- No UI-local retry policy.
- No adapter-local taxonomy truth.
- No raw backend payloads as primary user messaging.
- Keep run/result identity and recovery state authoritative via API/persistence surfaces.

## Related docs
- `docs/architecture/image-manipulation-validation-failure-taxonomy-foundation.md`
- `docs/architecture/image-manipulation-resilience-state-contracts.md`
- `docs/architecture/image-manipulation-retry-recovery-escalation-contracts.md`
- `docs/architecture/image-manipulation-studio-resilience-messaging-conventions.md`
- `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md`
- `docs/architecture/image-manipulation-studio-feature-7-ux-composition-posture.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`
