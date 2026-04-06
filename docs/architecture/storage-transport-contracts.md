# Storage Transport Contracts

This note documents Story 9.1.3 (Feature 9 / Epic 9.1): shared storage transport contracts, DTOs, and validation rules for host/API/UI boundaries.
Story 9.1.5 extends this transport surface with a structured storage access summary model.

## Canonical artifacts

- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/contracts/storage/tests/StorageTransportContracts.test.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/dto/storage/tests/StorageTransportDtos.test.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`

## Scope and intent

- Establish a stable, API/UI-ready storage transport contract surface for create/update/list/detail flows.
- Keep storage metadata consistent across layers without exposing persistence rows or runtime filesystem wiring.
- Ensure server-safe redaction for sensitive references and future-compatible redaction metadata.

## DTO coverage

- `CreateStorageInstanceRequestDto` and `CreateStorageInstanceResponseDto`
- `UpdateStorageInstanceRequestDto` and `UpdateStorageInstanceResponseDto`
- `ListStorageInstancesRequestDto` and `ListStorageInstancesResponseDto`
- `GetStorageInstanceDetailRequestDto` and `GetStorageInstanceDetailResponseDto`
- shared summary/detail payloads:
  - `StorageInstanceSummaryDto`
  - `StorageInstanceDetailDto`
  - internal projection shapes:
    - `StorageInternalInstanceSummaryDto`
    - `StorageInternalInstanceDetailDto`

## Metadata modeled in transport

- backend and lifecycle posture: backend type, lifecycle state, creation/update timestamps
- display metadata: display name, description, tags, labels, visual metadata extensions
- policy metadata: policy id, retention/size constraints, label metadata, encryption posture (without leaking key references), and explicit security/lifecycle policy controls:
  - encryption mode and key scope
  - content encryption requirement
  - preview and worker decryption allowances
  - retention-expiry hook metadata (`retentionExpiryAction`, optional `purgeGracePeriodDays`)
- access metadata: mode/scope plus permission summary booleans for read/write/policy/lifecycle operations
- access metadata (Story 9.1.5): ownership/workspace context, effective action permissions, allowed actions, and policy-restricted capabilities
- replication/sync metadata: replication mode/config, sync health state, optional last-sync indicators

## Redaction and non-leakage posture

- Public detail payloads use `sensitiveRedaction` metadata, not raw sensitive references.
- Internal detail payloads may carry sensitive reference ids for server-side projection only.
- Projection helper `toStorageInstanceDetailDto(...)` strips sensitive ids and emits stable redaction summaries.
- DTOs and schema contracts do not include raw filesystem path fields.

## Validation posture

`StorageTransportSchemaContracts.ts` provides strict zod validation for request/response payloads with typed parse failures:

- replication coherence checks (`none` vs `async-mirror` vs `sync-mirror`)
- policy metadata contradiction checks (for example no-encryption mode cannot require content encryption, retention-expiry hooks must match retention settings)
- required-field and identifier-format validation
- metadata label safety checks for redaction-safe keys
- pagination bounds for list queries
- admin-safe detail validation (for example, read-only access cannot advertise write capability)
- access-summary coherence checks:
  - `allowedActions` must align to effective permissions marked `allowed`
  - access ownership/workspace metadata must match detail identity fields
  - read-only access cannot advertise metadata update action as allowed
- strict object schemas rejecting unknown payload keys
- deterministic create-policy defaults at schema boundary for omitted security/lifecycle metadata fields

Validation parse helpers expose typed failures through `StorageTransportSchemaValidationError`.

## Versioning approach

- Contract-level redaction metadata is versioned by `StorageTransportContractVersions` (current: `storage-transport/v1`).
- Version markers are surfaced where compatibility matters (`sensitiveRedaction.contractVersion`) without requiring per-payload envelope version wrappers.

## Boundary posture

- Shared storage transport contracts depend on domain enums only; no persistence or SDK types are exposed.
- Storage transport payloads are suitable for HTTP, IPC, and UI state adapters.
- Internal and admin-safe DTO projections are explicit to prevent accidental exposure of infrastructure/security-sensitive fields.
