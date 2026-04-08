# Feature 1 Final Baseline: Image Asset Ingestion and Storage Foundation

This document records completion status for Feature 1 in the image manipulation vertical slice and defines the production-readiness baseline required before workflow binding and ComfyUI execution integration move forward.

## Baseline status

Feature 1 is implemented as an authoritative, policy-aware image asset foundation:

- image uploads create logical protected resources (`image-asset:*`) instead of file-path identities
- upload bytes are written through managed storage adapters and finalized through image-asset lifecycle use cases
- metadata/list/detail and protected original/preview content retrieval are served through server APIs
- workspace ownership and actor identity context are carried through policy checks and audit hooks
- studio ingestion accepts canonical source image asset identifiers and keeps lineage references on dataset records

## Main user-visible ingestion flow

The flow expected by users and downstream image-runtime features is:

1. Upload image through authoritative image-asset create/upload/complete APIs.
2. Load recent image assets in studio from authoritative list APIs.
3. Select a recent asset and open original bytes through protected original-content APIs.
4. Re-ingest the selected image into studio dataset bindings via studio-shell APIs.
5. Continue with workflow/runtime selection using dataset records that preserve canonical source asset lineage.

## End-to-end verification coverage

Primary high-level coverage:

- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerImageAssetManagement.test.ts`
  - API -> storage -> persistence integration for create/upload/finalize/get/list/original/preview
  - authorization denial behavior for protected metadata/content access
  - audit and storage-redaction invariants
  - studio reuse path: protected original retrieval -> studio ingestion with canonical `image-asset:*` id
- `src/infrastructure/api/studio-shell/tests/ReferenceImageUploadFlow.test.ts`
  - studio-side upload admission and dataset selection behavior
- `src/infrastructure/api/studio-shell/tests/ReferenceImageFaceIdDatasetFlow.test.ts`
  - input/reference dataset binding ingestion and canonical source image references

Contract and slice-level support coverage:

- `src/application/image-assets/tests/*.test.ts`
- `src/infrastructure/api/image-assets/tests/ImageAssetManagementBackendApi.test.ts`
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`
- `src/infrastructure/persistence/image-assets/tests/SqliteImageAssetPersistenceAdapter.test.ts`

## No mock-only or placeholder-only path posture

Feature 1 runtime paths are not mock-only:

- production-oriented HTTP integration tests use real image-asset use cases, SQLite persistence adapters, and managed storage adapters
- protected-content retrieval tests read bytes through storage-backed streams instead of fixture-only data transforms
- studio ingestion tests assert canonical asset lineage and dataset selection without local filesystem bypasses

Test doubles remain in unit tests only for isolated contract/error coverage and do not represent production execution paths.

## Known limits and extension points

Known limits (explicit):

- preview generation currently supports original-as-preview fallback and status signaling (`available`, `pending-generation`, `unavailable`); derivative preview generation pipelines are future work
- image-asset retrieval APIs are integrated, but workflow execution engines do not yet bind directly to image-asset preview derivation pipelines
- retention, archival automation, and quota-driven lifecycle policy for image binary content are not yet fully expanded

Stable extension points:

- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/ports/ImageAssetAuditPort.ts`
- `src/application/image-assets/use-cases/RequestImageAssetPreviewContentUseCase.ts`
- `src/application/image-assets/use-cases/OpenImageAssetPreviewContentUseCase.ts`
- `src/infrastructure/api/image-assets/ImageAssetManagementBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

## Prerequisites for Feature 2 and later slice work

Feature 2+ workflow/run integration should assume:

- all image inputs and outputs must continue to resolve through authoritative image/studio APIs
- workflow/runtime binding must use canonical image asset identifiers and dataset lineage fields
- ComfyUI or other execution adapters must not introduce local path authority for source/reference assets
- policy enforcement and audit capture must remain active on metadata and protected content retrieval paths

## Explicit follow-on technical debt

1. Add derivative preview materialization pipeline (thumbnail/gallery generation cache + lifecycle invalidation) behind existing preview contracts.
2. Add storage lifecycle automation for archival/retention/cleanup policies tied to image-asset lifecycle states.
3. Expand operational diagnostics for image-asset ingestion throughput/failure aggregation across host modes.
4. Add broader multi-actor workspace sharing scenarios for studio recent-asset reuse UX beyond owner-centric default listing.
