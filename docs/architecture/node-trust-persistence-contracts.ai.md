# AI Companion: Node Trust Persistence Contracts

## Purpose

Quick baseline for Story 5.1.2 and Story 5.1.3 node-trust persistence contracts and SQLite adapter implementation (Feature 5 / Epic 5.1), extended by Story 5.4.3 node trust audit recording persistence.

## Canonical files

- `src/shared/dto/nodes/NodeTrustPersistenceDtos.ts`
- `src/shared/schemas/nodes/NodeTrustPersistenceSchemaContracts.ts`
- `src/application/nodes/ports/INodeTrustIdentityPersistenceRepository.ts`
- `src/application/nodes/ports/INodeEnrollmentRequestPersistenceRepository.ts`
- `src/application/nodes/ports/NodeTrustPersistencePorts.ts`
- `src/application/nodes/tests/NodeTrustPersistencePortsContracts.test.ts`
- `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceMigrations.ts`
- `src/infrastructure/persistence/nodes/NodeTrustPersistenceMapper.ts`
- `src/infrastructure/persistence/nodes/SqliteNodeTrustPersistenceAdapter.ts`
- `src/infrastructure/persistence/nodes/SqliteNodeTrustAuditRecorder.ts`
- `src/infrastructure/persistence/nodes/tests/NodeTrustPersistenceMapper.test.ts`
- `src/infrastructure/persistence/nodes/tests/SqliteNodeTrustPersistenceAdapter.test.ts`
- `src/infrastructure/persistence/nodes/tests/SqliteNodeTrustAuditRecorder.test.ts`

## Core persistence model

- Node identity trust record:
  - identity + lifecycle state (`approvalStatus`, `trustState`)
  - capability profile and deployment tags
  - certificate reference metadata
  - revocation envelope metadata
  - last-seen heartbeat metadata
- Node enrollment request record:
  - request status lifecycle
  - requested/reviewed metadata
  - capability and deployment metadata proposed during enrollment

## Query/read posture

- Pending enrollments:
  - `findPendingEnrollmentRequestByNodeId(...)`
  - `NodeTrustPersistenceQueryPresets.pendingEnrollmentRequestStatuses`
- Active nodes:
  - `activeOnly` + `NodeTrustPersistenceQueryPresets.activeNodeTrustStates`
- Revoked nodes:
  - `trustStates` + `includeRevoked`
- Capability-scoped and deployment-tag-scoped node listings:
  - `capabilityAnyOf`, `deploymentTagAnyOf`
  - deterministic lookup-key helpers for future indexes/materialized projections

## Capability profile normalization

- Canonical capability values:
  - `ui`
  - `api`
  - `scheduler`
  - `executor`
  - `storage-access`
  - `preview-worker`
- Persistence-layer profile validation enforces required capability combinations and scheduling/concurrency guardrails from the domain model.
- Legacy persisted capability values from earlier stories are normalized to canonical capability values during row mapping.

## Boundary notes

- No infrastructure/SQL details are exposed in application/domain layers.
- Node trust persistence is split into two ports:
  - node identity trust mutations/queries
  - enrollment request mutations/queries
- Mutation envelopes require idempotency `operationKey` and support `expectedRevision` for optimistic-concurrency adapters.
- SQLite adapter uses transactional upserts with immutable creation metadata and mutation replay snapshots in `node_trust_mutation_replays`.
- Capability and deployment-tag lookups are materialized in normalized tables to keep admin/orchestration query paths index-friendly.
- Node trust audit events now persist to `node_trust_audit_events` through `SqliteNodeTrustAuditRecorder`, keyed for actor/node/time governance queries.

## Tests in this slice

- `src/shared/dto/nodes/tests/NodeTrustPersistenceDtos.test.ts`
- `src/shared/schemas/nodes/tests/NodeTrustPersistenceSchemaContracts.test.ts`
- `src/application/nodes/tests/NodeTrustPersistencePortsContracts.test.ts`
- `src/infrastructure/persistence/nodes/tests/NodeTrustPersistenceMapper.test.ts`
- `src/infrastructure/persistence/nodes/tests/SqliteNodeTrustPersistenceAdapter.test.ts`
