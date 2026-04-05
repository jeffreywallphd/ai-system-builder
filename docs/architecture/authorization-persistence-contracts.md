# Authorization Persistence Contracts

This note documents Story 4.1.7 (Feature 4 / Epic 4.1) and Story 4.2.1 (Feature 4 / Epic 4.2): migration-ready contracts plus the production SQLite persistence adapter for authorization role assignments, sharing grants, and resource policy metadata.

## Canonical artifacts

- `src/shared/dto/authorization/AuthorizationPersistenceDtos.ts`
- `src/shared/dto/authorization/tests/AuthorizationPersistenceDtos.test.ts`
- `src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository.ts`
- `src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository.ts`
- `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository.ts`
- `src/application/authorization/ports/AuthorizationPolicyPersistencePorts.ts`
- `src/application/authorization/tests/AuthorizationPolicyPersistencePortsContracts.test.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceMigrations.ts`
- `src/infrastructure/persistence/authorization/AuthorizationPersistenceMapper.ts`
- `src/infrastructure/persistence/authorization/SqliteAuthorizationPersistenceAdapter.ts`
- `src/infrastructure/persistence/authorization/tests/AuthorizationPersistenceMapper.test.ts`
- `src/infrastructure/persistence/authorization/tests/SqliteAuthorizationPersistenceAdapter.test.ts`

## Scope and intent

- Define persistence-facing record contracts without committing to a specific storage adapter.
- Establish repository expectations for idempotent writes, revision-aware updates, and query shapes needed by policy enforcement paths.
- Keep semantics explicit for revocation and soft-deletion so future migration scripts and adapters can preserve lifecycle history.

## Contract summary

`AuthorizationPersistenceDtos.ts` introduces:

- audit and mutation envelopes:
  - `AuthorizationPersistenceAuditStamp`
  - `AuthorizationPersistenceWriteContext`
  - `AuthorizationPersistenceMutationEnvelope`
  - `AuthorizationPersistenceMutationResult<TRecord>`
- record shapes:
  - `AuthorizationRoleAssignmentPersistenceRecord`
  - `AuthorizationSharingGrantPersistenceRecord`
  - `AuthorizationResourcePolicyMetadataPersistenceRecord`
- lookup query shapes:
  - role-assignment lookups by workspace, actor, scope, role, and resource tuple
  - sharing-grant lookups by resource tuple, workspace, and sharing subject dimensions
  - resource-policy metadata lookups by resource tuple, workspace, owner, and visibility
- mutation input shapes:
  - upsert/revoke for role assignments
  - upsert/revoke for sharing grants
  - upsert/soft-delete for resource policy metadata

## Semantics locked by contract

- idempotency:
  - mutation operations carry a required `operationKey` for replay-safe adapter behavior.
- optimistic concurrency:
  - mutation envelopes can include `expectedRevision` to support compare-and-swap behavior in future adapters.
- lifecycle handling:
  - role assignments and sharing grants model revocation timestamps.
  - resource policy metadata models soft deletion (`deletedAt`, `deletedByUserIdentityId`) for migration-safe tombstones.
- lookup indexing hints:
  - helper functions expose deterministic key formats for resource tuple and sharing subject lookup keys.

## Repository seam expectations

Application ports define separate persistence responsibilities:

- `IAuthorizationRoleAssignmentPersistenceRepository`
- `IAuthorizationSharingGrantPersistenceRepository`
- `IAuthorizationResourcePolicyMetadataPersistenceRepository`

`AuthorizationPolicyPersistencePorts` groups these repositories for future application services that orchestrate authorization administration and migration flows.

## SQLite production adapter (Story 4.2.1)

The production persistence adapter lives under `src/infrastructure/persistence/authorization` and implements all three authorization persistence repositories in one workspace-local SQLite adapter:

- `SqliteAuthorizationPersistenceAdapter`:
  - role assignment `find/list/upsert/revoke`,
  - sharing grant `find/list/upsert/revoke`,
  - resource policy metadata `find/list/upsert/soft-delete`.
- `AuthorizationPersistenceMapper`:
  - isolates row-shape parsing and record-shape mapping,
  - handles sharing-subject and permission-list serialization boundaries.
- `SqliteAuthorizationPersistenceMigrations`:
  - defines versioned schema and indexes,
  - keeps all authorization SQL centralized in infrastructure.

### Schema notes

Schema version table:

- `authorization_repository_migrations`

Authorization state tables:

- `authorization_role_assignments`
- `authorization_sharing_grants`
- `authorization_resource_policy_metadata`

Idempotency/replay table:

- `authorization_mutation_replays`

Key behavior captured in schema + adapter:

- workspace-aware and resource-tuple-aware lookup indexes for policy-evaluation reads,
- explicit revocation fields for role assignments and sharing grants,
- soft-delete fields for resource policy metadata,
- replay-safe `operation_key` storage for idempotent mutation handling,
- revision field persistence with compare-and-swap style `expectedRevision` checks.

### Migration guidance

- Migrations run lazily on first adapter use.
- Version tracking is persisted in `authorization_repository_migrations`.
- New migrations must append to `AUTHORIZATION_PERSISTENCE_MIGRATIONS` and increment `AUTHORIZATION_PERSISTENCE_SCHEMA_VERSION`.
- Do not modify previously shipped migration SQL blocks; add a new versioned migration instead.
- Keep authorization persistence SQL in the authorization infrastructure module to avoid ad hoc SQL in application/use-case layers.

## Test coverage

- `AuthorizationPersistenceDtos.test.ts` validates key derivation and operation-key normalization assumptions.
- `AuthorizationPolicyPersistencePortsContracts.test.ts` validates:
  - idempotent/replay-safe mutation expectations,
  - workspace/actor/resource lookup behavior,
  - sharing-grant revocation filtering,
  - resource-policy metadata soft-delete filtering.

These tests intentionally use in-memory adapters to lock contract semantics before SQLite adapter implementation.
