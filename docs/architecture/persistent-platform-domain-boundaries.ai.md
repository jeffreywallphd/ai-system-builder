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

## Story 13.2.4 transaction coordination baseline

- New shared application transaction boundary contract:
  - `src/application/common/ports/PlatformTransactionPorts.ts`
- Identity repository composition now supports optional transaction manager injection:
  - `src/application/identity/ports/IdentityRepositoryPorts.ts`
- Register-local-account use case now supports grouped identity + credential persistence through a clean boundary:
  - `src/application/identity/use-cases/RegisterLocalAccountUseCase.ts`
- Concrete SQLite transaction coordinator and adapter participation:
  - `src/infrastructure/persistence/sqlite/SqliteTransactionCoordinator.ts`
  - `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
  - `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter.ts`
- Added verification coverage:
  - `src/application/common/tests/PlatformTransactionPorts.test.ts`
  - `application/identity/tests/RegisterLocalAccountUseCase.test.ts`
  - `src/infrastructure/persistence/sqlite/tests/SqliteTransactionCoordinator.test.ts`
  - `src/infrastructure/persistence/identity/tests/SqliteIdentityPersistenceAdapter.test.ts`

## Story 13.3.1 shared identifier/timestamp/versioning baseline

- Shared persistence infrastructure now provides reusable helpers for:
  - stable identifier token normalization + scoped id generation,
  - canonical UTC mutation timestamp resolution,
  - optimistic-concurrency revision checks + increment behavior,
  - workspace/user/node/platform tenancy metadata factory creation.
- New shared modules:
  - `src/shared/persistence/PersistenceIdentifiers.ts`
  - `src/shared/persistence/PersistenceTimestamps.ts`
  - `src/shared/persistence/PersistenceVersioning.ts`
  - `src/shared/persistence/PersistenceTenancyMetadataFactory.ts`
- New adapter-facing infrastructure seam:
  - `src/infrastructure/persistence/common/PersistenceMutationMetadata.ts`
- Concrete adapter integration now uses shared mutation metadata conventions in:
  - `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
  - `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
- Domain-specific mutation operation-key normalizers for identity/authorization/node trust now route through one shared persistence normalizer.
- Added contract and behavior coverage:
  - `src/shared/persistence/tests/PersistenceIdentifiers.test.ts`
  - `src/shared/persistence/tests/PersistenceTimestamps.test.ts`
  - `src/shared/persistence/tests/PersistenceVersioning.test.ts`
  - `src/shared/persistence/tests/PersistenceTenancyMetadataFactory.test.ts`
  - `src/infrastructure/persistence/common/tests/PersistenceMutationMetadata.test.ts`

## Story 13.3.2 reusable persistence mapper/query helper utilities

- New shared infrastructure persistence helpers now provide:
  - lookup normalization + optional JSON payload parsing + tenancy metadata projection:
    - `src/infrastructure/persistence/common/PersistenceMapperUtilities.ts`
  - reusable SQL query filter + paging construction:
    - `src/infrastructure/persistence/common/SqliteQueryHelpers.ts`
  - tenancy-scope filter composition helpers:
    - `src/infrastructure/persistence/common/PersistenceTenancyScopeQuery.ts`
  - common safe repository base behavior for mutation error wrapping, paging, and timestamp fallback:
    - `src/infrastructure/persistence/common/SafeSqliteRepositoryBase.ts`
- Concrete adapters now consume shared repository/query helpers to reduce duplicated persistence concern logic:
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
  - `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter.ts`
  - `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
  - `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetPersistenceAdapter.ts`
- Platform persistence mapper now reuses shared mapper helper utilities for tenancy conversion + JSON object parsing:
  - `src/infrastructure/persistence/platform/PlatformPersistenceMapper.ts`
- Added utility coverage:
  - `src/infrastructure/persistence/common/tests/PersistenceMapperUtilities.test.ts`
  - `src/infrastructure/persistence/common/tests/SqliteQueryHelpers.test.ts`
  - `src/infrastructure/persistence/common/tests/PersistenceTenancyScopeQuery.test.ts`
  - `src/infrastructure/persistence/common/tests/SafeSqliteRepositoryBase.test.ts`

## Story 13.3.3 redaction-safe persistence diagnostics and error translation

- New cross-cutting persistence failure modules now provide stable application-safe failure shaping:
  - `src/infrastructure/persistence/PersistenceFailure.ts`
  - `src/infrastructure/persistence/PersistenceErrorTranslation.ts`
- New infrastructure logging helpers now provide default persistence diagnostic redaction:
  - `src/infrastructure/logging/PersistenceRedaction.ts`
  - `src/infrastructure/logging/PersistenceDiagnosticsLogger.ts`
- `SafeSqliteRepositoryBase` now translates raw mutation exceptions into structured persistence failures and emits sanitized diagnostics, including:
  - stable persistence failure codes for conflict/concurrency/unavailable/not-found/permission/invalid/internal classes,
  - retryable metadata for application error-handling decisions,
  - redaction-safe logging that strips prompt content, secret/token values, and filesystem/database paths by default.
- SQLite adapters that already extend `SafeSqliteRepositoryBase` now inherit this behavior consistently.
- Added test coverage:
  - `src/infrastructure/persistence/tests/PersistenceErrorTranslation.test.ts`
  - `src/infrastructure/logging/tests/PersistenceRedaction.test.ts`
  - `src/infrastructure/persistence/common/tests/SafeSqliteRepositoryBase.test.ts`

## Story 13.4.1 application-use-case persistence wiring

- Core mutation use cases now execute multi-record writes through shared transaction boundaries rather than uncoordinated sequential persistence:
  - `src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase.ts`
  - `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
  - `src/application/nodes/use-cases/RejectNodeEnrollmentUseCase.ts`
- Authoritative server runtime wiring now injects transaction-capable repository adapters so production flows use transactional orchestration:
  - `hosts/server/IdentityServerHost.ts`
- Node trust SQLite persistence adapter now exposes the shared transaction-manager contract for application-layer coordination:
  - `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
- Transactional orchestration coverage additions:
  - `application/identity/tests/ChangeLocalPasswordCredentialUseCase.test.ts`
  - `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`

## Story 13.4.2 host startup and service-composition persistence wiring

- Authoritative host startup now composes persistent platform services during the bootstrap `persistence` stage through:
  - `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- Shared runtime bootstrap now executes deterministic migration hooks for identity/workspaces/authorization/nodes/storage/assets/platform/security/secrets prior to feature registration:
  - `createAuthoritativePersistenceMigrationHooks(...)`
- Feature registration now injects startup-composed persistent services directly into runtime host startup so authoritative delivery flows consume composition-root owned adapters:
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
  - `hosts/server/IdentityServerHost.ts`
- Authoritative required host service coverage now includes explicit persistence bootstrap/repository/transaction/helper service registrations:
  - `src/infrastructure/config/HostServiceRegistrationCatalog.ts`

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

