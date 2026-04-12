# Image Asset Authorization Contracts

This note documents Story 1.1.2 for the image manipulation vertical slice: reusable contracts for evaluating access to protected image assets using the platform authorization model.

## Canonical files

- `src/shared/contracts/assets/ImageAssetAuthorizationContracts.ts`
- `src/shared/contracts/assets/tests/ImageAssetAuthorizationContracts.test.ts`

## Access action model

Image asset authorization checks are now represented by explicit reusable actions:

- `create`
- `view-metadata`
- `download-original`
- `request-preview`
- `update-metadata`
- `archive`
- `delete`
- `attach-to-run`

These actions map to existing platform permission keys through `resolveImageAssetRequiredPermission(...)`:

- `asset.create`
- `asset.read`
- `asset.update`
- `asset.delete`

This avoids introducing image-specific authorization islands.

## Policy input context model

`ImageAssetAuthorizationResourceContext` provides a normalized policy input shape for image resources:

- resource identity: `assetId`, `workspaceId`
- ownership: `ownershipScope` (`user-private` | `workspace`), optional `ownerUserIdentityId`
- visibility and sharing posture: `visibility`, `sharingPolicyMode`, optional `sharingPolicyId` / version
- publication posture: `isPublishedCapable`, optional `publishedAt`

Supported ownership and sharing cases include:

- user-private image assets in a workspace
- workspace-owned image assets in a workspace
- explicitly shared image assets (policy id required)
- published image assets (published mode/capability metadata required)

## Authorization evaluation request contract

`toImageAssetPolicyDecisionEvaluationRequest(...)` turns image access requests into authoritative authorization evaluation requests:

- create actions become workspace capability checks (`workspace-capability`, `capabilityResourceType=image-asset`)
- resource actions become protected resource checks (`resource-instance` against `asset:image-asset:<assetId>`)

This allows image use cases to depend on authorization ports/contracts without embedding policy logic in controllers, UI, or feature services.
