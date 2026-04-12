# Feature 8 / Epic 8.2 Story 8.2.1: Image Asset Validation and Retrieval Hardening (AI)

Canonical human doc: `docs/architecture/image-asset-validation-retrieval-hardening.md`

## Scope

Harden image asset ingestion + protected retrieval so malformed/unsupported/stale inputs fail early and consistently through Feature 8 shared failure semantics.

## Implemented seams

- Boundary validation hardening:
  - `ImageAssetCreationUseCaseContracts.ts`:
    - strict fingerprint algorithm + digest validation.
  - `GetImageAssetPreviewContentUseCaseContracts.ts`:
    - strict preview representation + preferred media-type validation.
- Corruption/mismatch detection:
  - `FinalizeImageAssetUploadUseCase.ts`:
    - signature detection fallback via magic bytes when `file-type` is unavailable.
- Shared failure normalization:
  - `ImageAssetFailureNormalization.ts`:
    - canonical helper for taxonomy classification + retry/recovery + resilience attachment.
- Retrieval/stale handling:
  - `OpenImageAssetPreviewContentUseCase.ts`:
    - stale preview token -> explicit invalid-state/user-action-required failure.
  - `ImageAssetManagementBackendApi.ts`:
    - upload session expiry enforced for ingest and finalize.
    - invalid request and storage failure paths include normalized failure envelope.

## Normalization contract

Use `error.details.imageManipulationFailure` as the canonical normalized envelope for asset ingestion/retrieval failures:

- `classification` (`ImageManipulationValidationFailureTaxonomy`)
- `recovery` (`ImageManipulationRetryRecoveryContracts`)
- optional `resilience` snapshot (`ImageManipulationResilienceStateContracts`)

This keeps controller/UI error handling from defining independent taxonomy/retry logic.

## Behavior outcomes

- Unsupported fingerprint/media/preferred preview types are rejected early.
- Corrupted uploads detectable by signature/magic-bytes fail as explicit conflicts.
- Missing reference and token staleness become explicit invalid-state/unavailable outcomes.
- Ingestion and retrieval failure details now carry consistent Feature 8 taxonomy + recovery metadata.

## Tests updated

- `src/application/image-assets/tests/InitiateImageAssetCreationUseCase.test.ts`
- `src/application/image-assets/tests/FinalizeImageAssetUploadUseCase.test.ts`
- `src/application/image-assets/tests/GetImageAssetOriginalContentUseCase.test.ts`
- `src/application/image-assets/tests/ImageAssetPreviewContentUseCases.test.ts`
- `src/infrastructure/api/image-assets/tests/ImageAssetManagementBackendApi.test.ts`
