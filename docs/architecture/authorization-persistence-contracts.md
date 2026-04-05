# Authorization Persistence Contracts

This note documents Story 4.1.7 (Feature 4 / Epic 4.1): migration-ready persistence contracts for authorization role assignments, sharing grants, and resource policy metadata.

## Canonical artifacts

- `src/shared/dto/authorization/AuthorizationPersistenceDtos.ts`
- `src/shared/dto/authorization/tests/AuthorizationPersistenceDtos.test.ts`
- `src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository.ts`
- `src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository.ts`
- `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository.ts`
- `src/application/authorization/ports/AuthorizationPolicyPersistencePorts.ts`
- `src/application/authorization/tests/AuthorizationPolicyPersistencePortsContracts.test.ts`

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

## Test coverage

- `AuthorizationPersistenceDtos.test.ts` validates key derivation and operation-key normalization assumptions.
- `AuthorizationPolicyPersistencePortsContracts.test.ts` validates:
  - idempotent/replay-safe mutation expectations,
  - workspace/actor/resource lookup behavior,
  - sharing-grant revocation filtering,
  - resource-policy metadata soft-delete filtering.

These tests intentionally use in-memory adapters to lock contract semantics before SQLite adapter implementation.
