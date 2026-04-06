# AI Companion: Persistent Platform Domain Boundaries

## Purpose

Story 13.1.1 formalizes authoritative persistence boundaries across core platform domains so repository work remains domain-first and port-first.

## Canonical files

- `src/domain/platform/PlatformPersistenceBoundaries.ts`
- `src/domain/platform/tests/PlatformPersistenceBoundaries.test.ts`
- `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- `src/application/common/tests/PlatformPersistenceBoundaryPorts.test.ts`
- `docs/architecture/persistent-platform-domain-boundaries.md`

## Core boundary stance

- Authoritative server host is the single control-plane write authority.
- Domain/application layers define aggregates and repository targets.
- Infrastructure adapters implement those targets; they do not define business boundaries.
- Authoritative write models are distinct from query/read projections.

## Core domains covered

- identity
- workspaces
- authorization
- nodes
- storage
- assets
- runs
- security (internal CA + trust material references)
- secrets
- sessions
- audit

## Story 13.1.1 contract additions

- `IPlatformRunRecordRepository` in `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- `IPlatformAuditEventRepository` in `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- Shared mutation context/idempotency helper for future adapters:
  - `PlatformPersistenceMutationContext`
  - `normalizePlatformPersistenceOperationKey(...)`

## Story 13.1.2 contract additions

- Source-layer identity repository ports now exist for authoritative user/session persistence and query access:
  - `src/application/identity/ports/IIdentityLookupRepository.ts`
  - `src/application/identity/ports/IIdentityPersistenceRepository.ts`
  - `src/application/identity/ports/ICredentialMaterialRepository.ts`
  - `src/application/identity/ports/IIdentitySessionRepository.ts`
  - `src/application/identity/ports/IIdentitySessionTokenMaterialRepository.ts`
  - `src/application/identity/ports/IdentityRepositoryPorts.ts`
- Query/write split is explicit for credential material, sessions, and session-token material via dedicated query/write sub-interfaces.
- Shared identity persistence DTO contracts are now source-layer and reusable by adapters:
  - `src/shared/dto/identity/IdentityPersistenceDtos.ts`
- Contract tests added:
  - `src/application/identity/tests/IdentityRepositoryPortsContracts.test.ts`
  - `src/shared/dto/identity/tests/IdentityPersistenceDtos.test.ts`

## Story 13.1.3 shared persistence DTO/schema/mapper additions

- Common persistence metadata + mutation contracts:
  - `src/shared/dto/persistence/PersistenceBoundaryDtos.ts`
- Reusable mapper boundary contracts + replay parsing helper:
  - `src/shared/dto/persistence/PersistenceMapperBoundary.ts`
- New shared persistence DTO coverage for remaining core domains:
  - workspaces: `src/shared/dto/workspaces/WorkspacePersistenceDtos.ts`
  - storage: `src/shared/dto/storage/StoragePersistenceDtos.ts`
  - platform runs + audit: `src/shared/dto/platform/PlatformPersistenceDtos.ts`
- Shared persistence schema primitives + parse helper:
  - `src/shared/schemas/persistence/PersistenceSchemaPrimitives.ts`
- New schema contracts for migration/validation-ready persistence payloads:
  - `src/shared/schemas/workspaces/WorkspacePersistenceSchemaContracts.ts`
  - `src/shared/schemas/storage/StoragePersistenceSchemaContracts.ts`
  - `src/shared/schemas/platform/PlatformPersistenceSchemaContracts.ts`
- Added contract tests for new DTOs/schemas/mapper boundaries:
  - `src/shared/dto/persistence/tests/PersistenceBoundaryDtos.test.ts`
  - `src/shared/dto/persistence/tests/PersistenceMapperBoundary.test.ts`
  - `src/shared/dto/workspaces/tests/WorkspacePersistenceDtos.test.ts`
  - `src/shared/dto/storage/tests/StoragePersistenceDtos.test.ts`
  - `src/shared/dto/platform/tests/PlatformPersistenceDtos.test.ts`
  - `src/shared/schemas/persistence/tests/PersistenceSchemaPrimitives.test.ts`
  - `src/shared/schemas/workspaces/tests/WorkspacePersistenceSchemaContracts.test.ts`
  - `src/shared/schemas/storage/tests/StoragePersistenceSchemaContracts.test.ts`
  - `src/shared/schemas/platform/tests/PlatformPersistenceSchemaContracts.test.ts`

## Story 13.2.2 concrete adapter baseline for identity/workspaces/authorization

- Concrete persistence adapters now exist for the first major authoritative storage slice under:
  - `src/infrastructure/persistence/identity/`
  - `src/infrastructure/persistence/workspaces/`
  - `src/infrastructure/persistence/authorization/`
- Identity adapter coverage includes:
  - user identity + provider-link persistence/lookup
  - credential material persistence/query
  - session + session-token persistence/query
  - trusted-device and pairing lifecycle persistence
- Workspace adapter coverage includes:
  - workspace tenancy records
  - workspace membership and role-assignment lifecycle records
  - invitation lifecycle records
  - workspace authorization snapshot read support
- Authorization adapter coverage includes:
  - role assignment persistence + replay-safe mutation handling
  - sharing grant persistence + subject/resource keyed lookup
  - resource policy metadata persistence + soft-delete lifecycle handling
- Authoritative server host wiring now uses SQLite identity persistence adapters from `src/infrastructure/persistence/identity` so application identity ports are backed by the migration-ready adapter path.
- Adapter verification coverage is in:
  - `src/infrastructure/persistence/identity/tests/SqliteIdentityPersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/identity/tests/SqliteTrustedDevicePersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/workspaces/tests/SqliteWorkspacePersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/authorization/tests/SqliteAuthorizationPersistenceAdapter.test.ts`

## Story 13.2.3 concrete adapter slice for nodes/storage/assets/runs/audit

- SQLite-backed concrete adapters now cover the next authoritative metadata slice under:
  - `src/infrastructure/persistence/nodes/`
  - `src/infrastructure/persistence/storage/`
  - `src/infrastructure/persistence/assets/`
  - `src/infrastructure/persistence/platform/`
- Node persistence adapter coverage includes:
  - approval status lifecycle, trust-state transitions, and revocation metadata
  - capability profile persistence (`enabledCapabilities`, scheduler support, concurrency hints)
  - enrollment request lifecycle and pending-review lookup patterns
- Storage persistence adapter coverage includes:
  - storage instance lifecycle state + backend metadata
  - access policy metadata and encryption/security policy fields
  - replay-safe mutation handling for create/save operations
- Logical asset persistence adapter coverage includes:
  - ownership/visibility metadata, lifecycle state, and version lineage
  - logical source relationships (lineage links + generated-output source metadata)
  - upload-session persistence for protected ingest flows
- New cross-domain platform adapter coverage includes:
  - `IPlatformRunRecordRepository` via `SqlitePlatformPersistenceAdapter`:
    - run-kind/status/source references, workspace/user tenancy references, revisioned status timeline truth
    - metadata persistence intended for orchestration/scheduling control-plane fields (without runtime-execution payload ownership)
    - replay-safe create/save mutations and list-query filters for admin/orchestration views
  - `IPlatformAuditEventRepository` via `SqlitePlatformPersistenceAdapter`:
    - append-only audit-event persistence across identity/workspace/authorization/nodes/storage/assets/runs/security/secrets/sessions/system domains
    - queryable filters for kind, actor, workspace, user, target, and time-window review flows
    - replay-safe append semantics via normalized operation keys
- Adapter verification coverage now includes:
  - `src/infrastructure/persistence/nodes/tests/SqliteNodeTrustPersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/storage/tests/SqliteStorageInstancePersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/assets/tests/SqliteAssetPersistenceAdapter.test.ts`
  - `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Mapper guidance for contributors

- Keep mapper implementations in infrastructure, but drive them from shared DTO + schema contracts.
- Validate persistence payloads with shared schema parse helpers before returning cross-layer records.
- Keep tenancy/audit/version metadata explicit on authoritative records; do not infer this from adapter context alone.
- Represent sensitive fields explicitly through `PersistenceSensitiveFieldDescriptor` and avoid exposing plaintext secrets/tokens outside infrastructure.
- Normalize idempotency operation keys and parse replay snapshots through shared mapper helpers instead of ad hoc JSON parsing.

## Ownership rules to preserve

- Workspace owns tenancy/membership lifecycle.
- Authorization owns policy/grant metadata and decision inputs.
- Storage owns storage-instance lifecycle/policy.
- Assets own logical asset lifecycle and upload-session records.
- Runs own execution status timeline and terminal truth.
- Security owns CA/certificate/trust-material lifecycle records.
- Secrets own scope/version metadata and encrypted material references.
- Sessions own auth session status/expiry/revocation truth.
- Audit owns append-only event ledger records.

