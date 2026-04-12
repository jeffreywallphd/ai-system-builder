# Execution Node Repository and Management Application Ports

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.1: Execution Node Domain, Capability Model, and Management Contracts
- Epic 5.2: Node Registration, Persistence, Health, and Capability Management
- Story 5.1.3: Define repository and service ports for node registration, query, and management
- Story 5.2.1: Implement node registration and activation use cases for image execution backends
- Story 5.2.2: Implement concrete persistence for execution-node records and status history
- Story 5.2.3: Implement adapter-backed health/capability refresh services for execution nodes
- Story 5.2.4: Implement execution-node query and listing use cases for operational and readiness surfaces
- Story 5.2.5: Implement node enable/disable and availability override use cases

## Purpose

Define application-layer port seams so execution nodes are registered, queried, refreshed, and managed through authoritative services instead of studio-local or adapter-local side effects.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/ports/ExecutionNodeManagementAuthorizationPorts.ts`
- `src/application/nodes/use-cases/ExecutionNodeManagementUseCaseShared.ts`
- `src/application/nodes/use-cases/RegisterExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/ActivateExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/RefreshExecutionNodeBackendStateUseCase.ts`
- `src/application/nodes/use-cases/GetExecutionNodeDetailUseCase.ts`
- `src/application/nodes/use-cases/ListExecutionNodesUseCase.ts`
- `src/application/nodes/use-cases/SetExecutionNodeAvailabilityOverrideUseCase.ts`
- `src/application/nodes/tests/ExecutionNodeManagementPorts.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementUseCases.test.ts`
- `src/application/nodes/tests/RefreshExecutionNodeBackendStateUseCase.test.ts`
- `src/application/nodes/tests/ExecutionNodeQueryUseCases.test.ts`
- `src/application/nodes/tests/SetExecutionNodeAvailabilityOverrideUseCase.test.ts`

## Repository port responsibilities

`IExecutionNodeRepository` is the persistence boundary for execution-node resources and includes:

- registration and canonical save (`registerExecutionNode`, `saveExecutionNode`)
- read surfaces (`findExecutionNodeById`, `listExecutionNodes`)
- targeted state update seams:
  - `updateExecutionNodeHealth`
  - `updateExecutionNodeCapabilities`
  - `updateExecutionNodeAvailability`
  - `updateExecutionNodeOperationalAvailability`

`ExecutionNodeListQuery` supports filters needed by orchestration and admin contexts (capability, backend family, target support, activation/health posture, trust posture, deployment tags, and freshness windows) without coupling to any concrete storage engine.

## Service port responsibilities

`ExecutionNodeManagementServicePorts` groups five authoritative service seams:

- `healthRefresh` (`IExecutionNodeHealthRefreshServicePort`)
  - applies probe observations into canonical node health state
- `capabilityRefresh` (`IExecutionNodeCapabilityRefreshServicePort`)
  - updates backend-family capability/readiness metadata from refresh observations
- `eligibility` (`IExecutionNodeEligibilityEvaluationServicePort`)
  - evaluates routing compatibility and returns explicit `eligible | unavailable | incompatible` decisions
- `availability` (`IExecutionNodeAvailabilityManagementServicePort`)
  - applies explicit activation/health availability transitions with mutation context
- `selectionHints` (`IExecutionNodeSelectionHintsServicePort`)
  - returns ranked routing hints with reason codes for scheduling and dispatch preparation

## Story 5.2.3 refresh behavior

`RefreshExecutionNodeBackendStateUseCase` adds authoritative backend-backed refresh for registered execution nodes by reusing the normalized adapter seam from image execution (`IImageManipulationExecutionCapabilityPort`).

The refresh flow:

- resolves the durable execution-node record from `IExecutionNodeRepository`
- invokes adapter-backed backend status probing through the capability port
- normalizes backend status into canonical execution-node health/capability contracts
- persists refreshed health/capability state through repository update seams

The normalized refresh classification covers:

- `healthy`
- `degraded`
- `unavailable`
- `incompatible`
- `stale`
- `unknown`

State handling highlights:

- stale probe observations (`maxStatusAgeMs`) persist as node `health=unknown` and backend readiness `unknown`
- unavailable probes transition active nodes to activation `unavailable` with `health=unavailable`
- incompatible probe posture is retained as degraded node health + backend readiness `unknown` with explicit reason metadata
- capability refresh keeps canonical `image-manipulation` execution target support while preserving non-probed capability arrays

## Intended consumers

These ports are designed for:

- run-orchestration scheduling/input assembly services
- node-assignment and dispatch-preparation use cases
- authoritative node administration APIs (enable/disable/degrade maintenance actions)
- backend-family refresh orchestrators (health/capability probes)

## Boundary posture

- Interfaces are backend-family neutral; ComfyUI is supported as data, not as a hardcoded dependency.
- Trust/approval/certificate constraints remain compatible with existing node-trust domain contracts.
- Scheduling and policy engines consume explicit eligibility/selection outputs through ports, not adapter internals.
- User identity concerns remain outside these ports; mutation context references actor ids only for auditable orchestration.

## Story 5.2.1 use-case behavior

`RegisterExecutionNodeUseCase` and `ActivateExecutionNodeUseCase` provide the authoritative application entry points for execution-node inventory onboarding and activation:

- registration:
  - validates required identity/display metadata, endpoint references, backend family capabilities, and node capability profile through `createExecutionNodeRecord(...)`
  - rejects duplicate node ids before persistence
  - persists durable execution-node records through `IExecutionNodeRepository.registerExecutionNode(...)`
  - returns internal DTO-ready summary shape for management/readiness surfaces
- activation:
  - requires existing node record + approved/trusted posture + certificate reference
  - validates lifecycle transition to active execution status through domain transition rules
  - persists activated state through `IExecutionNodeRepository.saveExecutionNode(...)`
  - defaults activated health posture to `ready` (with optional override)
- policy/trust extensibility:
  - both use cases accept optional `ExecutionNodeManagementAuthorizationHook` checks so approval/security policies can be tightened without changing core orchestration seams

These use cases keep execution node inventory management explicit and authoritative, decoupled from hidden startup assumptions or adapter-local side effects.

## Story 5.2.2 persistence note

Concrete SQLite persistence for `IExecutionNodeRepository` now lives in:

- `src/infrastructure/persistence/nodes/SqliteExecutionNodeRepository.ts`
- `src/infrastructure/persistence/nodes/SqliteExecutionNodePersistenceMigrations.ts`
- `src/infrastructure/persistence/nodes/ExecutionNodePersistenceMapper.ts`

Durable operational history for health/capability/availability updates is recorded in `execution_node_status_history` and documented in `docs/architecture/execution-node-persistence-and-status-history.md`.

## Story 5.2.4 query and listing behavior

`GetExecutionNodeDetailUseCase` and `ListExecutionNodesUseCase` now provide authoritative execution-node read surfaces for operational inventory and studio readiness messaging consumers.

Query/list behavior:

- backed by persisted execution-node metadata through `IExecutionNodeRepository` (no ad hoc adapter probing)
- optional authorization hooks for visibility policy integration:
  - `assertCanGetExecutionNodeDetail(...)`
  - `assertCanQueryExecutionNodes(...)`
- list filtering supports:
  - backend families and execution targets
  - approval/trust/activation/health status filters
  - capability presence (`requiredCapabilitiesAnyOf`)
  - remote-scheduling and certificate requirements
  - deployment-tag and recent-activity windows (`lastSeenAfter`/`lastSeenBefore`)
  - practical enabled/disabled selector (`enabled`) derived from activation posture
  - practical availability selector (`available`) derived from activation + health posture
  - explicit administrative availability-override mode filter (`operationalAvailabilityModes`)
  - backend readiness state filter (`backendReadinessStates`)
- outputs are projected into internal DTO-ready summary/detail models that can feed later admin-lite/admin and readiness UI/API surfaces.

## Story 5.2.5 availability override behavior

`SetExecutionNodeAvailabilityOverrideUseCase` adds authoritative operational controls that are distinct from probe-observed backend health/readiness:

- supported actions: `enable`, `disable`, `suppress`
- `suppress` requires `suppressedUntil` and is intended for temporary routing suppression windows
- durability: override mode/timestamps are persisted on execution-node records and exposed via query/detail read models
- authorization: optional `assertCanOverrideExecutionNodeAvailability(...)` hook enforces policy boundaries
- state validation: revoked nodes cannot be overridden; malformed suppress windows are rejected

Separation from probe behavior:

- backend probe refresh (`RefreshExecutionNodeBackendStateUseCase`) continues to update observed health/readiness posture
- administrative override state is stored separately and is not cleared or rewritten by probe refreshes
- eligibility and practical availability checks now honor both:
  - observed backend/node state (activation + health + readiness)
  - administrative operational override (`enabled|disabled|suppressed`)
