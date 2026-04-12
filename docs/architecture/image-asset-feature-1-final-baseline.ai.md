# AI Companion: Feature 1 Final Baseline for Image Asset Ingestion

## Purpose

Provide implementation-truth readiness notes for the Feature 1 image asset foundation that downstream workflow binding and ComfyUI integration must depend on.

## Completion summary

- Feature 1 is server-authoritative for image upload, metadata/list/detail reads, protected original content, and preview access.
- Image assets are logical protected resources (`image-asset:*`) with workspace/user policy context and managed storage coordinates.
- Studio ingestion accepts canonical source image asset ids and preserves lineage without path-based bypasses.

## Canonical seams

- `src/domain/image-assets/ImageAssetDomain.ts`
- `src/application/image-assets/ports/IImageAssetRepository.ts`
- `src/application/image-assets/ports/ImageAssetStoragePort.ts`
- `src/application/image-assets/use-cases/InitiateImageAssetCreationUseCase.ts`
- `src/application/image-assets/use-cases/FinalizeImageAssetUploadUseCase.ts`
- `src/application/image-assets/use-cases/GetImageAssetOriginalContentUseCase.ts`
- `src/application/image-assets/use-cases/RequestImageAssetPreviewContentUseCase.ts`
- `src/application/image-assets/use-cases/OpenImageAssetPreviewContentUseCase.ts`
- `src/infrastructure/api/image-assets/ImageAssetManagementBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/studio-shell/StudioShellBackendApi.ts`
- `docs/architecture/image-asset-feature-1-final-baseline.md`

## E2E readiness coverage to keep green

- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerImageAssetManagement.test.ts`
- `src/infrastructure/api/studio-shell/tests/ReferenceImageUploadFlow.test.ts`
- `src/infrastructure/api/studio-shell/tests/ReferenceImageFaceIdDatasetFlow.test.ts`
- `src/infrastructure/api/image-assets/tests/ImageAssetManagementBackendApi.test.ts`
- `src/infrastructure/storage/image-assets/tests/ManagedImageAssetStorageAdapter.test.ts`

## Known limits and required next-step assumptions

- Preview derivation is still fallback-first (original-as-preview + pending/unavailable signaling), not full generated-preview pipelines.
- Feature 2+ must keep authoritative API mediation for all image input/output resolution and never reintroduce local path authority.
- ComfyUI integration must consume canonical asset ids and dataset lineage references.

## Explicit follow-on debt

1. Add generated preview derivation/caching lifecycle behind existing preview contracts.
2. Add richer image binary retention/archival automation tied to lifecycle states.
3. Add expanded ingestion operational telemetry and host-mode diagnostics.
4. Expand multi-actor sharing/reuse flows beyond owner-centric recent listing defaults.
