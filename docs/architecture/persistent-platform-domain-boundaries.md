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
- Contract tests:
  - `src/domain/platform/tests/PlatformPersistenceBoundaries.test.ts`
  - `src/application/common/tests/PlatformPersistenceBoundaryPorts.test.ts`
  - `src/application/identity/tests/IdentityRepositoryPortsContracts.test.ts`
  - `src/shared/dto/identity/tests/IdentityPersistenceDtos.test.ts`

## Result

Repository implementation targets are now explicit before deeper adapter work, with authoritative write-vs-read model boundaries aligned to tenancy, trust, storage, and authoritative-server architecture principles.

