# AI Companion: Logical Asset Application Ports and Service Contracts

## Purpose

Story 10.1.3 defines the application-layer service boundaries for protected logical asset operations so callers use explicit use-case contracts rather than ad hoc path/file utilities.

## Canonical files

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

## Service-contract scope

Application use-case contracts now explicitly cover:

- asset registration
- asset lookup by id
- scoped asset listing
- upload finalization
- protected download authorization
- preview lookup
- generated output registration with lineage links
- logical archive and logical delete lifecycle operations

All requests are workspace-scoped and actor-scoped through explicit request context types.

## Port boundaries

In addition to repository persistence contracts, the application layer now defines dedicated ports for:

- authorization decisions (`IAssetAuthorizationPort`)
- protected content handling (`IAssetContentPort`)
- preview/media resolution (`IAssetPreviewPort`, `IAssetMediaPort`)
- audit recording (`AssetAuditSink`)

These keep authorization/storage/media/audit behavior adapter-boundary-safe and prevent filesystem coupling in use-case contracts.

## Path-safe request validation

`AssetServiceContracts` includes application-level validation helpers that normalize request payloads and reject filesystem-like object keys (absolute, drive-prefixed, path-traversal, or Windows-separator forms).

This preserves logical storage semantics (`storageInstanceId` + `objectKey`) at the application boundary.

## Shared API/event payload contracts

`AssetTransportContracts` and `AssetTransportDtos` provide stable projection contracts for:

- summary/detail asset payloads
- download authorization payloads
- preview-resolution payloads
- asset audit event payloads

Transport payloads carry logical IDs and storage references only; infrastructure-only path/location internals are not exposed.

## Test coverage in this slice

- Application request validation tests for registration/list/finalize/download/generated-output flows.
- Shared transport contract tests for summary/detail projection, path-safe download authorization payload checks, and audit event payload mapping.
- Shared DTO tests that verify DTO->application normalization and validation bridging.

## Boundary posture

- Dependencies point inward: use-case contracts depend on domain types and application ports, not adapter specifics.
- Shared DTO/contracts do not include filesystem path APIs or backend-specific adapter objects.
- Higher layers can integrate on logical asset ids, storage-instance refs, and scoped filters without redesign.

## Story 10.1.5 path-quarantine update

- Renderer-visible desktop model file operations now accept logical model paths relative to managed model roots, not raw absolute filesystem paths.
- Electron main process resolves those logical paths through an internal-only policy module (`electron/main/ModelFilePathPolicy.ts`) and rejects absolute/traversal/out-of-root inputs.
- Infrastructure adapters (`DesktopBridgeFileStorage`) quarantine absolute path handling behind internal translation logic so application/model services can keep existing abstractions without exposing raw path contracts at UI/IPC boundaries.

