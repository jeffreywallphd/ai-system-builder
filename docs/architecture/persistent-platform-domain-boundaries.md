# Persistent Platform Domain Boundaries

This note documents Story 13.1.1 boundary decisions for authoritative persistence in AI Loom.

The goal is to keep repository implementation aligned to domain/application contracts instead of drifting into table-first design.

## Boundary principles

- The authoritative server host is the single write authority for control-plane data.
- Persistence adapters are infrastructure concerns; aggregate boundaries and repository contracts live in `src/domain` and `src/application/*/ports`.
- Tenancy and trust concerns are explicit in each boundary (`platform`, `workspace`, `user`, `node`, or mixed).
- Authoritative write models are not replaced by UI-local, transport-local, or cache-derived state.
- Read models are projections derived from authoritative writes and do not own lifecycle transitions.

## Core aggregate persistence boundaries

### Identity
- Authoritative write aggregates:
  - identity user + provider link lifecycle
  - credential material history
- Repository targets:
  - `src/application/identity/ports/IIdentityPersistenceRepository`
  - `src/application/identity/ports/IIdentityLookupRepository`
  - `src/application/identity/ports/ICredentialMaterialRepository`
- Authoritative write model:
  - identity aggregate records
- Read models:
  - account administration summaries

### Workspaces
- Authoritative write aggregates:
  - workspace tenancy aggregate
  - workspace membership
  - workspace role assignment
  - workspace invitation lifecycle
- Repository targets:
  - `src/application/workspaces/ports/IWorkspaceRepository`
  - `src/application/workspaces/ports/IWorkspaceMembershipRepository`
  - `src/application/workspaces/ports/IWorkspaceRoleAssignmentRepository`
  - `src/application/workspaces/ports/IWorkspaceInvitationRepository`
- Authoritative write model:
  - workspace and membership lifecycle records
- Read models:
  - workspace administration views

### Authorization
- Authoritative write aggregates:
  - role assignments
  - sharing grants
  - resource policy metadata
- Repository targets:
  - `src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository`
  - `src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository`
  - `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository`
- Authoritative write model:
  - policy/grant metadata records
- Read models:
  - effective-access policy decision projections

### Nodes
- Authoritative write aggregates:
  - node trust identity
  - node enrollment request lifecycle
- Repository targets:
  - `src/application/nodes/ports/INodeTrustIdentityPersistenceRepository`
  - `src/application/nodes/ports/INodeEnrollmentRequestPersistenceRepository`
- Authoritative write model:
  - node trust and enrollment records
- Read models:
  - node inventory and pending enrollment review views

### Storage
- Authoritative write aggregates:
  - storage instance lifecycle and policy
- Repository targets:
  - `src/application/storage/ports/IStorageInstanceRepository`
- Authoritative write model:
  - storage instance records
- Read models:
  - access summaries and operational capability inspection views

### Assets
- Authoritative write aggregates:
  - asset metadata/lifecycle aggregate
  - asset upload session aggregate
- Repository targets:
  - `src/application/assets/ports/IAssetRepository`
  - `src/application/assets/ports/IAssetUploadSessionRepository`
- Authoritative write model:
  - asset and upload-session records
- Read models:
  - asset discovery/detail/preview projections

### Runs
- Authoritative write aggregates:
  - cross-domain run ledger entries (workflow, agent, system)
- Repository targets:
  - `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts#IPlatformRunRecordRepository`
- Authoritative write model:
  - run status timeline and terminal truth records
- Read models:
  - run observability summary/detail projections
- Story 13.1.1 addition:
  - formal contract introduced for run persistence boundary target

### Security (CA + trust material)
- Authoritative write aggregates:
  - certificate authority root metadata
  - issued certificate metadata
  - trust material references
  - certificate lifecycle history
- Repository targets:
  - `src/application/security/ports/ICertificateAuthorityRootPersistenceRepository`
  - `src/application/security/ports/IIssuedCertificatePersistenceRepository`
  - `src/application/security/ports/ITrustMaterialReferencePersistenceRepository`
  - `src/application/security/ports/ICertificateLifecycleEventPersistenceRepository`
- Authoritative write model:
  - certificate authority and certificate lifecycle records
- Read models:
  - trust/certificate introspection projections

### Secrets
- Authoritative write aggregates:
  - secret metadata record
  - secret version lineage
  - re-encryption operation record
- Repository targets:
  - `src/application/security/ports/SecretServicePorts.ts#ISecretRecordPersistenceRepository`
  - `src/application/security/ports/SecretServicePorts.ts#ISecretReEncryptionOperationRepository`
- Authoritative write model:
  - secret record/version/material references
- Read models:
  - metadata-only secret lookup/list projections

### Sessions
- Authoritative write aggregates:
  - authenticated identity session lifecycle
  - session token material validity
- Repository targets:
  - `src/application/identity/ports/IIdentitySessionRepository`
  - `src/application/identity/ports/IIdentitySessionTokenMaterialRepository`
- Authoritative write model:
  - session status/expiry/revocation records
- Read models:
  - authenticated principal/session resolution projections

### Audit
- Authoritative write aggregates:
  - append-only platform audit ledger
- Repository targets:
  - `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts#IPlatformAuditEventRepository`
- Authoritative write model:
  - append-only audit event records
- Read models:
  - filtered audit-review/reporting projections
- Story 13.1.1 addition:
  - formal contract introduced for cross-domain audit persistence target

## Cross-domain ownership rules

- Workspace owns tenancy membership state; authorization consumes membership context but owns policy outcomes.
- Storage owns instance lifecycle/policy; assets and runs reference logical storage targets without owning storage records.
- Node trust owns node approval/trust lifecycle; internal CA owns certificate issuance/revocation history.
- Secrets own scope/key/version metadata; security encryption/adapters own key wrapping mechanics.
- Sessions are identity-owned lifecycle records; transport/auth guards consume session-read outcomes only.
- Audit is append-only and cross-domain; domain services emit events but do not own audit persistence schema.

## Contract baseline introduced in code

- Domain boundary catalog:
  - `src/domain/platform/PlatformPersistenceBoundaries.ts`
- Application boundary ports for newly formalized targets:
  - `src/application/common/ports/PlatformPersistenceBoundaryPorts.ts`
- Story 13.1.2 repository contract additions:
  - `src/application/identity/ports/IIdentityLookupRepository.ts`
  - `src/application/identity/ports/IIdentityPersistenceRepository.ts`
  - `src/application/identity/ports/ICredentialMaterialRepository.ts`
  - `src/application/identity/ports/IIdentitySessionRepository.ts`
  - `src/application/identity/ports/IIdentitySessionTokenMaterialRepository.ts`
  - `src/application/identity/ports/IdentityRepositoryPorts.ts`
- Shared identity persistence DTO boundary for repository contracts:
  - `src/shared/dto/identity/IdentityPersistenceDtos.ts`
- Story 13.1.3 shared persistence DTO/schema/mapper boundary additions:
  - common persistence metadata + mutation contracts:
    - `src/shared/dto/persistence/PersistenceBoundaryDtos.ts`
  - common mapper boundary contracts and replay helper:
    - `src/shared/dto/persistence/PersistenceMapperBoundary.ts`
  - workspace persistence DTO contracts:
    - `src/shared/dto/workspaces/WorkspacePersistenceDtos.ts`
  - storage persistence DTO contracts:
    - `src/shared/dto/storage/StoragePersistenceDtos.ts`
  - cross-domain platform run/audit persistence DTO contracts:
    - `src/shared/dto/platform/PlatformPersistenceDtos.ts`
  - reusable persistence schema primitives:
    - `src/shared/schemas/persistence/PersistenceSchemaPrimitives.ts`
  - workspace persistence schema contracts:
    - `src/shared/schemas/workspaces/WorkspacePersistenceSchemaContracts.ts`
  - storage persistence schema contracts:
    - `src/shared/schemas/storage/StoragePersistenceSchemaContracts.ts`
  - platform run/audit persistence schema contracts:
    - `src/shared/schemas/platform/PlatformPersistenceSchemaContracts.ts`
- Contract tests:
  - `src/domain/platform/tests/PlatformPersistenceBoundaries.test.ts`
  - `src/application/common/tests/PlatformPersistenceBoundaryPorts.test.ts`
  - `src/application/identity/tests/IdentityRepositoryPortsContracts.test.ts`
  - `src/shared/dto/identity/tests/IdentityPersistenceDtos.test.ts`
  - `src/shared/dto/persistence/tests/PersistenceBoundaryDtos.test.ts`
  - `src/shared/dto/persistence/tests/PersistenceMapperBoundary.test.ts`
  - `src/shared/dto/workspaces/tests/WorkspacePersistenceDtos.test.ts`
  - `src/shared/dto/storage/tests/StoragePersistenceDtos.test.ts`
  - `src/shared/dto/platform/tests/PlatformPersistenceDtos.test.ts`
  - `src/shared/schemas/persistence/tests/PersistenceSchemaPrimitives.test.ts`
  - `src/shared/schemas/workspaces/tests/WorkspacePersistenceSchemaContracts.test.ts`
  - `src/shared/schemas/storage/tests/StoragePersistenceSchemaContracts.test.ts`
  - `src/shared/schemas/platform/tests/PlatformPersistenceSchemaContracts.test.ts`

## Story 13.2.2 concrete identity/workspace/authorization adapter baseline

- Concrete adapter modules for domain-authoritative persistence now live under:
  - `src/infrastructure/persistence/identity/`
  - `src/infrastructure/persistence/workspaces/`
  - `src/infrastructure/persistence/authorization/`
- Core adapter coverage includes:
  - identity user + provider-link persistence and lookup
  - credential material and session/session-token persistence
  - trusted-device and pairing persistence for identity trust workflows
  - workspace tenancy, membership, role assignment, and invitation persistence
  - authorization role assignment, sharing grant, and resource policy metadata persistence
- Authoritative host runtime wiring now uses concrete SQLite identity adapters from `src/infrastructure/persistence/identity` (not legacy filesystem identity adapters), keeping application ports backed by the migration-ready persistence path.
- Adapter tests for this baseline live in:
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

## Story 13.2.4 transaction coordination and unit-of-work support

- Shared transaction boundary port for application-layer use cases:
  - `src/application/common/ports/PlatformTransactionPorts.ts`
- Identity repository bundle now supports optional transaction coordination injection:
  - `src/application/identity/ports/IdentityRepositoryPorts.ts`
- Register-local-account use case now groups identity + credential-material writes through the shared transaction boundary when configured:
  - `src/application/identity/use-cases/RegisterLocalAccountUseCase.ts`
- Concrete adapter participation now includes common transaction coordination in:
  - `src/infrastructure/persistence/sqlite/SqliteTransactionCoordinator.ts`
  - `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
  - `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter.ts`
- Coverage additions:
  - `src/application/common/tests/PlatformTransactionPorts.test.ts`
  - `application/identity/tests/RegisterLocalAccountUseCase.test.ts`
  - `src/infrastructure/persistence/sqlite/tests/SqliteTransactionCoordinator.test.ts`
  - `src/infrastructure/persistence/identity/tests/SqliteIdentityPersistenceAdapter.test.ts`

## Story 13.3.1 shared identifier/timestamp/versioning infrastructure

- Shared persistence infrastructure contracts now include canonical helpers for:
  - stable identifier token normalization and scoped id generation
  - canonical UTC timestamp resolution for mutation metadata
  - optimistic-concurrency revision checks and increment behavior
  - workspace/user/node/platform tenancy metadata factory functions
- New shared modules:
  - `src/shared/persistence/PersistenceIdentifiers.ts`
  - `src/shared/persistence/PersistenceTimestamps.ts`
  - `src/shared/persistence/PersistenceVersioning.ts`
  - `src/shared/persistence/PersistenceTenancyMetadataFactory.ts`
- New infrastructure mutation metadata seam for repository adapters:
  - `src/infrastructure/persistence/common/PersistenceMutationMetadata.ts`
- Concrete adapter integration now uses the shared mutation metadata conventions in:
  - `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
  - `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
- Operation-key normalization now routes through one shared persistence normalizer for:
  - identity persistence DTOs
  - authorization persistence DTOs
  - node trust persistence DTOs
- Added verification coverage:
  - `src/shared/persistence/tests/PersistenceIdentifiers.test.ts`
  - `src/shared/persistence/tests/PersistenceTimestamps.test.ts`
  - `src/shared/persistence/tests/PersistenceVersioning.test.ts`
  - `src/shared/persistence/tests/PersistenceTenancyMetadataFactory.test.ts`
  - `src/infrastructure/persistence/common/tests/PersistenceMutationMetadata.test.ts`

## Story 13.3.2 reusable mapper/query/pagination/tenancy helpers

- Shared persistence infrastructure utilities now include:
  - mapper helper utilities for lookup normalization, optional JSON payload parsing, and tenancy metadata/scope projection:
    - `src/infrastructure/persistence/common/PersistenceMapperUtilities.ts`
  - SQL query helper utilities for reusable filter construction and paging clause generation:
    - `src/infrastructure/persistence/common/SqliteQueryHelpers.ts`
  - tenancy-scope query helper utilities for workspace/user/node scoped filtering:
    - `src/infrastructure/persistence/common/PersistenceTenancyScopeQuery.ts`
  - safe repository base abstraction for common mutation error wrapping, paging, and mutation timestamp fallback:
    - `src/infrastructure/persistence/common/SafeSqliteRepositoryBase.ts`
- SQLite persistence adapters now reuse the shared repository/query helpers to reduce duplicate repository concern code:
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
  - `src/infrastructure/persistence/workspaces/SqliteWorkspacePersistenceAdapter.ts`
  - `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
  - `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
  - `src/infrastructure/persistence/assets/SqliteAssetPersistenceAdapter.ts`
- Platform mapper tenancy + JSON parsing now routes through shared persistence mapper helpers:
  - `src/infrastructure/persistence/platform/PlatformPersistenceMapper.ts`
- Added utility coverage:
  - `src/infrastructure/persistence/common/tests/PersistenceMapperUtilities.test.ts`
  - `src/infrastructure/persistence/common/tests/SqliteQueryHelpers.test.ts`
  - `src/infrastructure/persistence/common/tests/PersistenceTenancyScopeQuery.test.ts`
  - `src/infrastructure/persistence/common/tests/SafeSqliteRepositoryBase.test.ts`

## Story 13.3.3 redaction-safe persistence diagnostics and error translation

- Cross-cutting persistence failure contracts now include stable application-safe error types under:
  - `src/infrastructure/persistence/PersistenceFailure.ts`
  - `src/infrastructure/persistence/PersistenceErrorTranslation.ts`
- Shared persistence diagnostics logging now includes default redaction-safe helpers under:
  - `src/infrastructure/logging/PersistenceRedaction.ts`
  - `src/infrastructure/logging/PersistenceDiagnosticsLogger.ts`
- `SafeSqliteRepositoryBase` now translates raw mutation failures into structured `PersistenceFailure` errors, with:
  - stable failure codes (`conflict`, `concurrencyConflict`, `unavailable`, `notFound`, `permissionDenied`, `invalidRequest`, `internal`),
  - retryable classification metadata for application-level handling,
  - redaction-safe structured diagnostics logs that avoid leaking prompt text, secrets/tokens, and filesystem/database paths.
- SQLite adapters already inheriting `SafeSqliteRepositoryBase` now consume this cross-cutting behavior consistently without per-adapter error redaction duplication.
- Added verification coverage:
  - `src/infrastructure/persistence/tests/PersistenceErrorTranslation.test.ts`
  - `src/infrastructure/logging/tests/PersistenceRedaction.test.ts`
  - `src/infrastructure/persistence/common/tests/SafeSqliteRepositoryBase.test.ts`

## Story 13.4.1 application-use-case persistence wiring

- Core application mutation use cases now route multi-record persistence through shared transaction boundaries instead of uncoordinated sequential writes:
  - `src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase.ts`
  - `src/application/nodes/use-cases/ApproveNodeEnrollmentUseCase.ts`
  - `src/application/nodes/use-cases/RejectNodeEnrollmentUseCase.ts`
- Authoritative host wiring now injects transaction-capable repository adapters so runtime execution paths use the transactional boundary in production:
  - `hosts/server/IdentityServerHost.ts`
- Node trust SQLite persistence adapter now exposes the shared transaction-manager contract for use-case orchestration:
  - `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
- Added verification coverage for transactional orchestration behavior:
  - `application/identity/tests/ChangeLocalPasswordCredentialUseCase.test.ts`
  - `src/application/nodes/tests/NodeTrustApplicationUseCases.test.ts`

## Mapper responsibility guidance (Story 13.1.3)

- Mapper boundaries are adapter-local but contract-driven:
  - infrastructure row/document shapes stay in infrastructure mapper files,
  - shared DTO contracts in `src/shared/dto/*` define stable persistence record shapes that repository ports consume.
- Adapter mappers should validate shared persistence DTO payloads through shared schema parse helpers before returning records to application/domain layers.
- Sensitive fields must stay explicit in persistence records:
  - include token/hash/encrypted-field descriptors through `PersistenceSensitiveFieldDescriptor`,
  - never expose raw secret/key/token plaintext above infrastructure.
- Tenancy and audit metadata are mandatory for authoritative writes:
  - include `tenancy` metadata (`platform`/`workspace`/`user`/`node`/`mixed`),
  - include audit/version metadata so migrations and optimistic concurrency remain deterministic.
- Replay/idempotency behavior should route through normalized operation keys and typed mapper replay parsers instead of ad hoc JSON parsing in adapters.

## Result

Repository implementation targets are now explicit before deeper adapter work, with authoritative write-vs-read model boundaries aligned to tenancy, trust, storage, and authoritative-server architecture principles.

