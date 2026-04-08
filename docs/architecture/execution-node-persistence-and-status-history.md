# Execution Node Persistence and Status History

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.2: Node Registration, Persistence, Health, and Capability Management
- Story 5.2.2: Implement concrete persistence for execution-node records and status history
- Story 5.2.5: Persist authoritative execution-node availability overrides (enable/disable/suppress)

## Purpose

Provide an authoritative, durable persistence layer for execution-node metadata and operational state so node-backed image execution can be audited, queried, and extended for admin/scheduling workflows.

## Canonical implementation map

- Repository adapter:
  - `src/infrastructure/persistence/nodes/SqliteExecutionNodeRepository.ts`
- SQLite migration schema:
  - `src/infrastructure/persistence/nodes/SqliteExecutionNodePersistenceMigrations.ts`
- Persistence mapper boundary:
  - `src/infrastructure/persistence/nodes/ExecutionNodePersistenceMapper.ts`
- Composition/migration hook integration:
  - `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- Coverage tests:
  - `src/infrastructure/persistence/nodes/tests/SqliteExecutionNodeRepository.test.ts`
  - `src/application/nodes/tests/ExecutionNodeManagementSqliteIntegration.test.ts`
  - `src/application/nodes/tests/ExecutionNodePersistenceDocumentation.test.ts`

## Persistence structures

The execution-node schema introduces durable record, lookup, replay, and history surfaces:

- `execution_node_records`
  - canonical execution-node record with normalized activation/health/trust/approval posture, capability profile metadata, backend-family capability metadata, endpoint metadata, deployment tags, metadata map, and administrative availability override fields (`availability_override_mode`, `availability_override_suppressed_until`, `availability_override_reason`, `availability_override_updated_at`).
- `execution_node_capabilities_lookup`
  - normalized node-capability lookup for `requiredCapabilitiesAnyOf` filtering.
- `execution_node_deployment_tags_lookup`
  - normalized deployment-tag lookup for admin/scheduling targeting filters.
- `execution_node_backend_families_lookup`
  - normalized backend-family lookup for eligible backend routing queries.
- `execution_node_execution_targets_lookup`
  - normalized execution-target lookup for target-specific routability filtering.
- `execution_node_mutation_replays`
  - replay-safe mutation operation snapshots keyed by operation key.
- `execution_node_status_history`
  - durable operational history entries for:
    - registration
    - save/state updates
    - health refresh
    - capability refresh
    - availability transitions

## Query and mutation behavior

`SqliteExecutionNodeRepository` implements `IExecutionNodeRepository` with:

- `findExecutionNodeById` and `listExecutionNodes` over canonical records + normalized lookup tables.
- replay-safe `registerExecutionNode` and `saveExecutionNode` mutation paths.
- targeted update paths:
  - `updateExecutionNodeHealth`
  - `updateExecutionNodeCapabilities`
  - `updateExecutionNodeAvailability`
  - `updateExecutionNodeOperationalAvailability`
- optimistic-concurrency checks using `expectedRevision` against persisted revisions.
- history append semantics that preserve activation/health/backend-summary/availability snapshots for later admin and scheduling analysis.

Persistence mapping remains isolated in `ExecutionNodePersistenceMapper.ts` so persistence rows do not leak into domain/application API contracts.

Probe interaction posture:

- backend probe refresh paths continue updating observed health/readiness fields
- administrative availability overrides are persisted separately on node records
- probe refresh updates do not clear/overwrite administrative override state

## Migration impact

Execution-node persistence schema version is `2`.

Migration `v2` extends `execution_node_records` with durable operational availability override columns and supporting index coverage for admin/query filtering. Execution-node migration hooks are registered in authoritative startup composition as domain `execution-nodes` with migration table `execution_node_repository_migrations`.

## Boundary posture

- Node trust identity and execution-node operational inventory remain separate persistence concerns.
- User identity and authorization stay outside execution-node row contracts; mutation context tracks actor identity only.
- Backend adapter details remain encoded as backend capability metadata, not hardcoded adapter-specific schema columns.
- Status-history rows are additive and append-oriented, enabling future admin timeline and audit integration work.
