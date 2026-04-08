# Feature 8 / Epic 8.2 Story 8.2.1: Image Asset Ingestion and Retrieval Hardening

## Story alignment

- Feature 8: Validation, Error Handling, and Operational Resilience
- Epic 8.2: Application and Infrastructure Hardening for Validation and Recovery
- Story 8.2.1: Harden image asset ingestion and retrieval validation against malformed or unsupported input

## Purpose

Harden image asset ingestion and protected retrieval so malformed, unsupported, stale, or inconsistent requests fail early and predictably with normalized failure semantics.

## Canonical seams in this story

- Application validation and failure normalization:
  - `src/application/image-assets/use-cases/ImageAssetCreationUseCaseContracts.ts`
  - `src/application/image-assets/use-cases/ImageAssetUploadFinalizationUseCaseContracts.ts`
  - `src/application/image-assets/use-cases/GetImageAssetPreviewContentUseCaseContracts.ts`
  - `src/application/image-assets/use-cases/ImageAssetFailureNormalization.ts`
  - `src/application/image-assets/use-cases/FinalizeImageAssetUploadUseCase.ts`
  - `src/application/image-assets/use-cases/GetImageAssetOriginalContentUseCase.ts`
  - `src/application/image-assets/use-cases/RequestImageAssetPreviewContentUseCase.ts`
  - `src/application/image-assets/use-cases/OpenImageAssetPreviewContentUseCase.ts`
- API boundary mapping:
  - `src/infrastructure/api/image-assets/ImageAssetManagementBackendApi.ts`

## Hardened behavior baseline

1. Ingestion request validation is stricter at the application boundary:
- fingerprint algorithm and digest format/length are validated before persistence.
- unsupported/malformed media-type declarations are rejected with deterministic invalid-request outcomes.

2. Upload finalization performs stronger corruption checks:
- signature-based media-type detection is attempted with `file-type` and a deterministic magic-byte fallback.
- media-type mismatch, checksum mismatch, and size mismatch are treated as explicit conflicts.
- failed finalization keeps the asset in a durable failed lifecycle state (with best-effort cleanup metadata) instead of silent ambiguity.

3. Retrieval request validation is stricter:
- preview request `representation` and `preferredMediaTypes` are validated against supported contracts.
- stale or invalid preview tokens are surfaced as explicit invalid-state user-action-required failures.
- missing/mismatched persisted original references are explicit availability failures.

4. Stale request handling is explicit:
- upload session expiry is enforced for both ingest and finalize boundaries with explicit stale request details.
- stale retrieval/open requests require a new token/session instead of ambiguous not-found behavior.

## Failure normalization and recovery posture

Image asset ingestion/retrieval failures now attach a normalized `imageManipulationFailure` envelope in error details.

The envelope carries:

- `classification` from `ImageManipulationValidationFailureTaxonomy` (layer/kind/disposition/reason/user-fixability),
- `recovery` from `ImageManipulationRetryRecoveryContracts` (automatic/manual/user-action/terminal posture),
- optional `resilience` snapshot from `ImageManipulationResilienceStateContracts` for degraded/blocked/temporarily-unavailable states.

This keeps asset-slice failures aligned with the Feature 8 shared taxonomy and avoids controller/UI-local retry heuristics.

## Boundary posture

- Validation remains in application contracts/use cases, not UI-only guards.
- API maps canonical use-case outcomes instead of inventing independent failure meaning.
- Retrieval token staleness and storage availability mismatches are explicit, testable outcomes.

## Verification coverage

- Application tests:
  - `src/application/image-assets/tests/InitiateImageAssetCreationUseCase.test.ts`
  - `src/application/image-assets/tests/FinalizeImageAssetUploadUseCase.test.ts`
  - `src/application/image-assets/tests/GetImageAssetOriginalContentUseCase.test.ts`
  - `src/application/image-assets/tests/ImageAssetPreviewContentUseCases.test.ts`
- API tests:
  - `src/infrastructure/api/image-assets/tests/ImageAssetManagementBackendApi.test.ts`
