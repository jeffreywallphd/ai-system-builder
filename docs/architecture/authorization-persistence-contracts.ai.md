# AI Companion: Authorization Persistence Contracts

## Purpose

Story 4.1.7 defines migration-ready persistence contracts for authorization records before infrastructure adapters are implemented.

## Canonical files

- `src/shared/dto/authorization/AuthorizationPersistenceDtos.ts`
- `src/shared/dto/authorization/tests/AuthorizationPersistenceDtos.test.ts`
- `src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository.ts`
- `src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository.ts`
- `src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository.ts`
- `src/application/authorization/ports/AuthorizationPolicyPersistencePorts.ts`
- `src/application/authorization/tests/AuthorizationPolicyPersistencePortsContracts.test.ts`

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

## Verification posture

- DTO tests validate helper/key assumptions and operation-key normalization behavior.
- Port contract tests validate expected repository behavior with in-memory implementations:
  - idempotent mutation flow
  - workspace/actor/resource filtering
  - sharing-grant revocation filtering
  - resource-policy soft-delete filtering

This gives upcoming SQLite migration/adapter work stable interfaces without redesigning authorization persistence semantics.
