# AI Companion: Execution Node Persistence and Status History

## Story scope

Story 5.2.2 delivers concrete SQLite persistence for execution-node inventory records and durable operational status/capability history.

## Human doc

- `docs/architecture/execution-node-persistence-and-status-history.md`

## Implemented files

- `src/infrastructure/persistence/nodes/SqliteExecutionNodeRepository.ts`
- `src/infrastructure/persistence/nodes/SqliteExecutionNodePersistenceMigrations.ts`
- `src/infrastructure/persistence/nodes/ExecutionNodePersistenceMapper.ts`
- `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- `src/infrastructure/persistence/nodes/tests/SqliteExecutionNodeRepository.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementSqliteIntegration.test.ts`
- `src/application/nodes/tests/ExecutionNodePersistenceDocumentation.test.ts`

## Core delivery

- Adds durable `execution_node_records` persistence for execution-node metadata.
- Adds lookup-table normalization for backend family, execution target, deployment tags, and enabled node capabilities.
- Adds replay-safe mutation handling in `execution_node_mutation_replays`.
- Adds append-oriented operational history in `execution_node_status_history` for registration/state save/health refresh/capability refresh/availability transitions.
- Wires migration hooks and service composition through authoritative persistence bootstrap.

## Boundary posture

- Persistence mapping is isolated in `ExecutionNodePersistenceMapper.ts`.
- Domain/application models remain free of SQLite row coupling.
- Node trust identity persistence and execution-node operational persistence remain separate concerns.
- History capture is durable and queryable to support future admin, scheduling, and audit correlation surfaces.
