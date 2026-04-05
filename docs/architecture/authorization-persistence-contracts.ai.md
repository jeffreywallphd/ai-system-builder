# AI Companion: Authorization Persistence Contracts

## Purpose

Story 4.1.7 defines migration-ready persistence contracts for authorization records, and Story 4.2.1 delivers the production SQLite adapter implementing those contracts.

## Canonical files

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

## Core contracts

- Mutation + audit seams:
  - write context (`actorUserIdentityId`, `occurredAt`, correlation metadata)
  - idempotency + revision envelope (`operationKey`, optional `expectedRevision`)
  - normalized mutation result (`changed`, `wasReplay`, `record`)
- Record seams:
  - role assignment persistence record (scope-aware workspace/resource fields + revocation metadata)
  - sharing grant persistence record (resource tuple + sharing subject + revocation/expiry metadata)
  - resource policy metadata persistence record (visibility/sharing mode + soft-delete metadata)
- Lookup seams:
  - workspace-aware and actor-aware role assignment queries
  - resource/subject-aware sharing queries
  - resource/workspace/visibility-aware resource policy metadata queries

## Contract expectations

- Adapters must treat `operationKey` as replay-safe idempotency input.
- Adapters should support compare-and-swap style updates using `expectedRevision`.
- Revocation and soft deletion are explicit lifecycle states, not hard-delete assumptions.
- Deterministic key helpers are provided for:
  - resource tuple lookup keys
  - sharing subject lookup keys

## Production adapter notes (Story 4.2.1)

- The SQLite adapter centralizes authorization persistence logic under `src/infrastructure/persistence/authorization`.
- Mapper utilities isolate row parsing and DTO/domain-shape mapping so database details do not leak into application code.
- Versioned migrations are reproducible and tracked through `authorization_repository_migrations`.
- Schema tables:
  - `authorization_role_assignments`
  - `authorization_sharing_grants`
  - `authorization_resource_policy_metadata`
  - `authorization_mutation_replays`
- Adapter behavior includes:
  - idempotent replay via `operationKey`,
  - optimistic concurrency via `expectedRevision`,
  - revocation and soft-delete lifecycle persistence,
  - workspace/actor/resource/subject keyed query paths used by policy evaluation and admin flows.

## Migration guidance

- Run migrations only via adapter initialization.
- Append-only migration policy: add a new migration version instead of editing prior versions.
- Keep persistence SQL in the authorization infrastructure module; avoid SQL in use cases or application services.

## Verification posture

- DTO tests validate helper/key assumptions and operation-key normalization behavior.
- Port contract tests validate expected repository behavior with in-memory implementations:
  - idempotent mutation flow
  - workspace/actor/resource filtering
  - sharing-grant revocation filtering
  - resource-policy soft-delete filtering

This gives upcoming SQLite migration/adapter work stable interfaces without redesigning authorization persistence semantics.
