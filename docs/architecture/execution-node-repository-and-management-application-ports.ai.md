# AI Companion: Execution Node Repository and Management Application Ports

## Story scope

Story 5.1.3 introduces application-layer repository and service ports for execution-node registration, query, health/capability refresh, eligibility evaluation, availability management, and scheduling selection hints.
Story 5.2.1 adds authoritative application use cases for registering and activating execution nodes for image backend hosting.
Story 5.2.2 adds concrete SQLite persistence + status-history recording for execution-node records.
Story 5.2.3 adds adapter-backed execution-node health/capability refresh orchestration through existing image execution adapter seams.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/ports/ExecutionNodeManagementAuthorizationPorts.ts`
- `src/application/nodes/use-cases/ExecutionNodeManagementUseCaseShared.ts`
- `src/application/nodes/use-cases/RegisterExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/ActivateExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/RefreshExecutionNodeBackendStateUseCase.ts`
- `src/application/nodes/tests/ExecutionNodeManagementPorts.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementUseCases.test.ts`
- `src/application/nodes/tests/RefreshExecutionNodeBackendStateUseCase.test.ts`
- Human doc: `docs/architecture/execution-node-repository-and-management-application-ports.md`

## Core delivery

- Adds `IExecutionNodeRepository` with explicit create/read/update/list seams for execution-node metadata and operational state.
- Adds typed query and mutation contracts (`ExecutionNodeListQuery`, `ExecutionNodeMutationContext`, `ExecutionNodeMutationResult`).
- Adds dedicated service ports for:
  - health refresh
  - capability refresh
  - eligibility evaluation
  - availability changes
  - selection hints
- Adds grouped dependency shape (`ExecutionNodeManagementServicePorts`) for higher-level orchestration consumers.
- Adds `RefreshExecutionNodeBackendStateUseCase` that:
  - invokes backend status probes through `IImageManipulationExecutionCapabilityPort`,
  - normalizes backend observations to execution-node health + backend readiness contracts,
  - persists refreshed capability and health state via `IExecutionNodeRepository`,
  - classifies refresh posture as `healthy | degraded | unavailable | incompatible | stale | unknown`.

## Consumer posture

These ports are intended for authoritative run orchestration, scheduling, node-admin controls, and backend refresh workflows. They avoid coupling to adapter-specific probe formats or studio-local execution shortcuts.

## Boundary posture

- Backend-family agnostic interface shapes.
- Compatible with trust/approval/certificate-managed node lifecycle expansion.
- Supports future policy-aware and multi-node scheduling without rewriting application contracts.
- Reuses Feature 3/4 normalized adapter boundaries instead of introducing UI-side or orchestration-side direct backend probing.

## Story 5.2.1 delivery

- Adds `RegisterExecutionNodeUseCase` for durable, validated execution-node registration with duplicate guardrails.
- Adds `ActivateExecutionNodeUseCase` for approved/trusted/certificate-backed activation to routable `active` posture.
- Adds shared use-case error/outcome and mutation-context helpers in `ExecutionNodeManagementUseCaseShared.ts`.
- Adds optional authorization extension seam (`ExecutionNodeManagementAuthorizationHook`) to keep policy controls extensible.
- Adds behavior tests covering valid registration, invalid/duplicate submissions, activation success, and activation-policy/posture rejection paths.

## Story 5.2.2 persistence note

- Concrete adapter: `src/infrastructure/persistence/nodes/SqliteExecutionNodeRepository.ts`
- Migration schema: `src/infrastructure/persistence/nodes/SqliteExecutionNodePersistenceMigrations.ts`
- Mapper isolation boundary: `src/infrastructure/persistence/nodes/ExecutionNodePersistenceMapper.ts`
- Operational history table: `execution_node_status_history`

## Story 5.2.3 normalization notes

- stale probe observations (`maxStatusAgeMs`) persist as node `health=unknown` and backend readiness `unknown`
- unavailable backend probes transition active nodes to activation `unavailable` with health `unavailable`
- incompatible readiness is represented as degraded health with backend readiness `unknown` + explicit reason metadata
