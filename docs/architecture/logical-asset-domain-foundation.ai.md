# AI Companion: Logical Asset Domain Foundation

## Purpose

Story 10.1.1 establishes the first production logical-asset domain model for protected asset access.

## Canonical files

- `src/domain/assets/AssetDomain.ts`
- `src/domain/assets/tests/AssetDomain.test.ts`
- `src/shared/dto/assets/AssetDtos.ts`
- `src/shared/dto/assets/tests/AssetDtos.test.ts`

## Core model

- `Asset` is a workspace-scoped logical resource with:
  - optional owner user identity
  - explicit visibility and sharing-policy reference posture
  - storage-instance binding
  - immutable version chain metadata
  - lifecycle posture (`active`, `archived`, `deleted`)
- `AssetLocationRef` and `StorageInstanceRef` are logical references only; no raw path fields.
- `ContentDescriptor` carries MIME/size/checksum metadata required for secure file handling and auditing.

## Key invariants

- workspace ownership is always required; owner user is optional.
- private visibility requires owner user metadata.
- workspace-owned assets cannot be private.
- shared/published visibility requires sharing policy references.
- private/workspace visibility cannot include sharing policy references.
- storage references must use canonical `storage-instance://<id>` form.
- location object keys reject filesystem-like absolute/drive-prefixed/path-traversal values.
- versions are contiguous (`1..n`) with latest revision as `currentVersionId`.
- all versions must remain bound to the same storage instance as the asset.
- lifecycle transitions and archived/deleted metadata combinations are strictly enforced.

## Boundary posture

- domain layer has no transport/framework/filesystem code.
- DTO mirrors are in `src/shared/dto/assets`, not in the domain module.
- this slice enables future API/application layers to expose authoritative logical asset operations without leaking local paths.
