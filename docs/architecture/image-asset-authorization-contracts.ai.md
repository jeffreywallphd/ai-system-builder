# AI Companion: Image Asset Authorization Contracts

## Purpose

Story 1.1.2 defines reusable authorization contracts for image asset access so image workflows can call authoritative policy evaluation seams instead of embedding ad hoc visibility logic.

## Canonical files

- `src/shared/contracts/assets/ImageAssetAuthorizationContracts.ts`
- `src/shared/contracts/assets/tests/ImageAssetAuthorizationContracts.test.ts`
- `docs/architecture/image-asset-authorization-contracts.md`

## Access action contract

`ImageAssetAccessActions` defines stable actions for image asset authorization checks:

- `create`
- `view-metadata`
- `download-original`
- `request-preview`
- `update-metadata`
- `archive`
- `delete`
- `attach-to-run`

`resolveImageAssetRequiredPermission(...)` maps these to existing catalog permissions (`asset.create`, `asset.read`, `asset.update`, `asset.delete`) so image assets reuse platform authorization semantics instead of creating image-only permission islands.

## Visibility, sharing, and ownership policy input

`ImageAssetAuthorizationResourceContext` captures policy-relevant resource metadata:

- workspace scope and logical image asset id
- ownership scope (`user-private` or `workspace`)
- optional owner user identity (required only for `user-private`)
- visibility (`private`, `workspace`, `shared`, `published`)
- sharing policy mode and optional policy identity/version
- publication posture (`isPublishedCapable`, `publishedAt`)

`createImageAssetAuthorizationResourceContext(...)` enforces invariants aligned with platform sharing posture:

- private -> owner-only, no explicit sharing policy id
- workspace -> workspace-members, no explicit sharing policy id
- shared -> explicit mode + sharing policy id required
- published -> published mode + sharing policy id + published capability metadata
- workspace-owned assets are supported (`ownershipScope=workspace`, no owner id)

## Policy evaluation request seam

`toImageAssetPolicyDecisionEvaluationRequest(...)` builds an application authorization request that image use cases can submit through existing authorization ports:

- create checks map to workspace capability targets (`workspace-capability`, `capabilityResourceType=image-asset`)
- existing asset checks map to resource instance targets (`asset:image-asset:<assetId>`)
- actor identity remains explicit (`actorUserIdentityId` or `actorServiceId`)

This keeps image asset use cases policy-driven while preserving the authoritative central evaluator pipeline.
