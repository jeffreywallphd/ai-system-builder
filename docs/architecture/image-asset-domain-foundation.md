# Image Asset Domain Foundation

This note documents Story 1.1.1 for the image manipulation vertical slice: a dedicated logical image asset domain model with explicit invariants for workspace tenancy, ownership, storage binding, visibility/sharing posture, and lifecycle safety.

## Canonical files

- `src/domain/image-assets/ImageAssetDomain.ts`
- `src/domain/image-assets/tests/ImageAssetDomain.test.ts`

## Domain model

`ImageAsset` is a protected logical resource and does not expose raw filesystem paths. The model includes:

- logical identity and tenancy: `assetId`, `workspaceId`, optional `ownerUserId`
- storage attachment: `storageInstanceId`, optional logical `storageBindingReference` (`storage-instance://...`)
- media/file identity: `mediaType`, `originalFilename`, `normalizedFilename`, `sizeBytes`, `fingerprint`
- protection metadata: `visibility`, `sharingPolicy`
- audit metadata: `createdBy`, `lastModifiedBy`, `createdAt`, `updatedAt`
- lifecycle/status metadata: `lifecycle.status` plus status-specific timestamps/actors
- lineage-ready metadata: optional `lineage.upstreamAssetIds`, `lineage.sourceRunId`, `lineage.generationOperationId`

The model supports both:

- uploaded source images (`originKind=uploaded-source`)
- generated output images (`originKind=generated-result`)

## Invariant posture

Implemented invariants include:

- supported media types must be from the image allowlist (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/bmp`, `image/tiff`, `image/avif`, `image/heic`, `image/heif`)
- non-empty required ownership/storage references (`workspaceId`, `storageInstanceId`, etc.)
- private visibility requires `ownerUserId`
- visibility and sharing policy mode must align (`private->owner-only`, `workspace->workspace-members`, `shared->explicit`, `published->published`)
- shared/published visibility requires explicit sharing policy identity
- normalized filenames cannot encode path separators
- storage binding references must stay logical (`storage-instance://...`) and cannot be raw filesystem paths
- fingerprint algorithm/digest formats are validated
- lifecycle metadata must match status-specific requirements
- lifecycle transitions are explicit and safe (`ingesting -> available|failed|deleted`, etc.), with deleted as terminal

## Architecture boundary posture

- Domain-only: no HTTP, React, Electron, filesystem APIs, or ComfyUI runtime details.
- Image assets are modeled as logical protected resources for authoritative API and policy enforcement layers.
- The model is lineage-ready for future run orchestration and generated-output traceability without redesign.
