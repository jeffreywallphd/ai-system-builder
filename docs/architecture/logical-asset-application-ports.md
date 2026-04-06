# Logical Asset Application Ports and Service Contracts

This note documents Story 10.1.3 (Feature 10 / Epic 10.1): the application-layer contracts and service boundaries for protected logical asset operations.

## Canonical artifacts

- `src/application/assets/use-cases/AssetServiceContracts.ts`
- `src/application/assets/use-cases/index.ts`
- `src/application/assets/ports/IAssetRepository.ts`
- `src/application/assets/ports/AssetAuthorizationPort.ts`
- `src/application/assets/ports/AssetContentPort.ts`
- `src/application/assets/ports/AssetPreviewPort.ts`
- `src/application/assets/ports/AssetMediaPort.ts`
- `src/application/assets/ports/AssetAuditPort.ts`
- `src/application/assets/ports/index.ts`
- `src/shared/contracts/assets/AssetTransportContracts.ts`
- `src/shared/dto/assets/AssetTransportDtos.ts`
- `src/application/assets/tests/AssetServiceContracts.test.ts`
- `src/shared/contracts/assets/tests/AssetTransportContracts.test.ts`
- `src/shared/dto/assets/tests/AssetTransportDtos.test.ts`

## Scope and intent

- Establish explicit application use-case contracts for logical asset operations.
- Keep asset interactions scoped to workspace/user/operation context, not ad hoc filesystem helpers.
- Ensure callers use logical identifiers (`assetId`, `storageInstanceId`, `objectKey`) for all operations.
- Define ports for authorization, content grant/finalization, preview/media lookup, and audit emission.
- Provide shared API-safe payload contracts for transport and event projection.

## Use-case contract coverage

`AssetServiceContracts` now defines request/result contracts for:

- register asset
- get asset by id
- list assets with scoped filters
- finalize upload into an asset version
- authorize protected download content access
- resolve preview asset bindings
- register generated output asset + lineage links
- archive asset and delete asset lifecycle operations

Error/result envelopes mirror established application service patterns (`ok`/`error` with stable codes).

## Port boundaries

`src/application/assets/ports` now includes dedicated interfaces for:

- `IAssetRepository` (persistence)
- `IAssetAuthorizationPort` (policy and access resolution)
- `IAssetContentPort` (upload finalization and protected read grants)
- `IAssetPreviewPort` + `IAssetMediaPort` (preview/media integration seams)
- `AssetAuditSink` and event payload contracts (audit recording)

This prevents higher layers from bypassing use-case boundaries with direct content/path access behavior.

## Validation posture

Application request validators normalize and enforce:

- required actor/workspace/mutation context identifiers
- bounded pagination fields
- positive duration/count inputs
- logical object-key semantics (reject absolute/drive-prefixed/traversal/windows-separator path forms)

These checks keep filesystem-specific concerns out of public use-case contracts while preserving domain invariants.

## Shared transport/event contracts

`AssetTransportContracts` + `AssetTransportDtos` now provide:

- asset summary/detail DTOs
- download authorization DTO projection
- preview resolution DTO projection
- audit event payload DTO projection
- DTO-to-application request normalization helpers

Payloads remain API-safe and infrastructure-agnostic.

## Test coverage

- `AssetServiceContracts.test.ts` validates application request normalization and boundary rejection cases.
- `AssetTransportContracts.test.ts` validates transport projection shape and path-safe download payload behavior.
- `AssetTransportDtos.test.ts` validates DTO normalization into application-layer contract inputs.

## Boundary posture

- Dependencies remain inward-pointing (domain + application contracts first).
- Shared contracts/DTOs avoid leaking backend-specific adapter concerns.
- Future API handlers can integrate against stable logical asset interfaces without redesign.

