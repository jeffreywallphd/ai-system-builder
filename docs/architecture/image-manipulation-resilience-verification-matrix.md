# Feature 8 / Epic 8.4 Story 8.4.1: Image Manipulation Resilience Verification Matrix

## Scope
This story adds representative end-to-end or high-level verification for production-relevant degraded and failure conditions across the image manipulation vertical slice.

Coverage is intentionally matrix-based, not combinatorial-exhaustive.

## Verification posture
- Assert authoritative state and normalized outcomes.
- Assert retry/recovery guidance semantics where applicable.
- Avoid backend-local or UI-local assumptions.
- Keep architecture boundaries intact (application contracts remain source of truth).

## Representative matrix
| Scenario | Expected authoritative behavior | Primary coverage |
| --- | --- | --- |
| invalid upload request | request rejected early with invalid-request contract | `src/infrastructure/api/studio-shell/tests/ImageManipulationFailurePaths.integration.test.ts` |
| incompatible saved system/runtime context | persistence blocked with runtime-configuration diagnostics and recoverable guidance | `src/infrastructure/api/studio-shell/tests/ImageManipulationFailurePaths.integration.test.ts` |
| no eligible backend node | readiness degraded/blocked with node-eligibility reason and resilience condition | `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts` |
| transient dispatch failure | failed persistence outcome remains coherent, failure classified to dispatch stage, retryable guidance preserved | `src/infrastructure/api/studio-shell/tests/ImageManipulationFailurePaths.integration.test.ts` |
| cancelled run | terminal blocked persistence path with explicit cancellation guidance and non-retryable diagnostic | `src/infrastructure/api/studio-shell/tests/ImageManipulationFailurePaths.integration.test.ts` |
| missing output collection after completion | recoverable failure with polling/output-collection diagnostics and coherent run-history state | `src/infrastructure/api/studio-shell/tests/ImageManipulationFailurePaths.integration.test.ts` |
| preview-generation delay/failure | pending-generation and temporarily-unavailable preview outcomes remain explicit and normalized | `src/application/image-assets/tests/ImageAssetPreviewContentUseCases.test.ts` |
| protected retrieval unavailability | retrieval returns content-unavailable with normalized temporarily-unavailable resilience details | `src/application/image-assets/tests/GetImageAssetOriginalContentUseCase.test.ts` |

## Expected confidence signal
This matrix catches regressions that would otherwise make the slice fragile under real conditions:
- early validation failures no longer leak into deep execution paths,
- workflow/run/result state stays coherent even when outputs are missing or runtime calls fail,
- cancellation and retryability semantics remain explicit,
- preview/retrieval degradation remains actionable without hidden local fallbacks.

## Notes
- These tests complement existing contract-level tests (taxonomy/resilience/recovery contracts) by exercising cross-layer behavior at integration/high-level seams.
- Additional scenarios should extend this matrix only when they introduce a materially different failure class.

## Cross-feature maintenance
- Keep this matrix aligned with `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md` when resilience-sensitive operational behavior changes.
- If a story adds a new failure class or recovery branch, update:
  - the matrix row(s),
  - the corresponding contract/operational guidance docs,
  - and the targeted integration/high-level tests that prove the new class.
