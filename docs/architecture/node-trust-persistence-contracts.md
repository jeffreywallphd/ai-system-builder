# Node Trust Persistence Contracts

This note documents Story 5.1.2 and Story 5.1.3 (Feature 5 / Epic 5.1): production-ready node trust persistence contracts and their SQLite implementation for node identities and enrollment requests.

## Canonical artifacts

- `src/shared/dto/nodes/NodeTrustPersistenceDtos.ts`
- `src/shared/dto/nodes/tests/NodeTrustPersistenceDtos.test.ts`
- `src/shared/schemas/nodes/NodeTrustPersistenceSchemaContracts.ts`
- `src/shared/schemas/nodes/tests/NodeTrustPersistenceSchemaContracts.test.ts`
- `src/application/nodes/ports/INodeTrustIdentityPersistenceRepository.ts`
- `src/application/nodes/ports/INodeEnrollmentRequestPersistenceRepository.ts`
- `src/application/nodes/ports/NodeTrustPersistencePorts.ts`
- `src/application/nodes/tests/NodeTrustPersistencePortsContracts.test.ts`
- `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceMigrations.ts`
- `src/infrastructure/persistence/nodes/NodeTrustPersistenceMapper.ts`
- `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
- `src/infrastructure/persistence/nodes/tests/NodeTrustPersistenceMapper.test.ts`
- `src/infrastructure/persistence/nodes/tests/SqliteNodeTrustPersistenceAdapter.test.ts`

## Scope and intent

- Define persistence-facing contracts for node trust and enrollment workflows without selecting a concrete storage adapter.
- Preserve explicit lifecycle state for approval, trust, enrollment status, revocation, and heartbeat observability.
- Keep query shapes and lookup keys indexing-friendly for common administration views and future scheduler/runtime checks.

## Contract summary

`NodeTrustPersistenceDtos.ts` introduces:

- shared mutation/audit contracts:
  - `NodeTrustPersistenceAuditStamp`
  - `NodeTrustPersistenceWriteContext`
  - `NodeTrustPersistenceMutationEnvelope`
  - `NodeTrustPersistenceMutationResult<TRecord>`
- node trust record contracts:
  - `NodeIdentityPersistenceRecord`
  - `NodeCapabilityProfilePersistenceRecord`
  - `NodeCertificateReferencePersistenceRecord`
  - `NodeLastSeenPersistenceRecord`
  - `NodeRevocationPersistenceRecord`
- enrollment record contracts:
  - `NodeEnrollmentRequestPersistenceRecord`
- query contracts:
  - `NodeIdentityPersistenceLookupQuery`
  - `NodeEnrollmentRequestPersistenceLookupQuery`
- mutation input contracts:
  - node registration
  - node approval status updates
  - certificate reference updates
  - capability profile updates
  - revocation updates
  - last-seen heartbeat updates
  - enrollment request save and status transition updates
- deterministic lookup helpers:
  - `toNodeCapabilityLookupKey`
  - `toNodeDeploymentTagLookupKey`
  - `toNodeTrustStateLookupKey`
  - `NodeTrustPersistenceQueryPresets`

## Repository seam expectations

Application ports define two explicit persistence responsibilities:

- `INodeTrustIdentityPersistenceRepository`:
  - register node identity trust records,
  - find/list nodes by trust, capability, and deployment metadata,
  - update approval, certificate, capability profile, revocation, and heartbeat fields.
- `INodeEnrollmentRequestPersistenceRepository`:
  - persist enrollment requests,
  - list/find requests including pending-by-node lookups,
  - transition enrollment status with review metadata.

`NodeTrustPersistencePorts` bundles both seams for use-case composition while keeping domain/application boundaries free of infrastructure detail.

## Query/index posture

Contracts are shaped for high-frequency query paths:

- pending enrollments:
  - `NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses`
  - `findPendingEnrollmentRequestByNodeId(...)`
- active nodes:
  - `activeOnly` with `NodeTrustPersistenceQueryPresets.activeNodeTrustStates`
- revoked nodes:
  - `trustStates` + `includeRevoked`
- nodes by capability and deployment tags:
  - `capabilityAnyOf`, `deploymentTagAnyOf`
  - deterministic key helpers for index projection/materialized views.

## Schema validation contracts

`NodeTrustPersistenceSchemaContracts.ts` adds zod-backed schema validation for persistence records and parse helpers:

- `NodeIdentityPersistenceRecordSchema`
- `NodeEnrollmentRequestPersistenceRecordSchema`
- `parseNodeIdentityPersistenceRecord(...)`
- `parseNodeEnrollmentRequestPersistenceRecord(...)`

Validation locks core persistence invariants at the schema boundary:

- trusted records require approved status + certificate reference.
- revoked trust state requires revocation metadata.
- approved/rejected enrollment records require review timestamps.

## SQLite adapter implementation notes

- Schema is versioned with `node_trust_repository_migrations` and currently pinned at version `1`.
- Core tables:
  - `node_trust_identities`
  - `node_enrollment_requests`
  - `node_trust_mutation_replays`
- Normalized lookup tables for query efficiency:
  - `node_trust_identity_capabilities`
  - `node_trust_identity_deployment_tags`
- Adapter behavior:
  - supports idempotent mutation replay keyed by `operationKey`,
  - enforces optimistic-concurrency via `expectedRevision`,
  - preserves immutable creation metadata on updates,
  - updates capability/deployment lookup projections transactionally with node identity writes.
- Mapper utilities perform schema-validated row-to-record and record-to-row conversion so infrastructure does not bypass node trust invariants.

## Test coverage

- `NodeTrustPersistenceDtos.test.ts` validates key derivation and operation-key normalization.
- `NodeTrustPersistenceSchemaContracts.test.ts` validates schema-level invariants and typed validation failures.
- `NodeTrustPersistencePortsContracts.test.ts` validates repository contract behavior for:
  - registration,
  - pending enrollment lookup,
  - approval/certificate/heartbeat updates,
  - revocation filtering and active/revoked list semantics.
- `NodeTrustPersistenceMapper.test.ts` validates mapper normalization and record/row conversion contracts.
- `SqliteNodeTrustPersistenceAdapter.test.ts` validates migrations, replay/revision semantics, node lifecycle persistence, enrollment lifecycle transitions, and query filtering behavior.
