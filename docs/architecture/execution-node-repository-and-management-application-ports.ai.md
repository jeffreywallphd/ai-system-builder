# AI Companion: Execution Node Repository and Management Application Ports

## Story scope

Story 5.1.3 introduces application-layer repository and service ports for execution-node registration, query, health/capability refresh, eligibility evaluation, availability management, and scheduling selection hints.
Story 5.2.1 adds authoritative application use cases for registering and activating execution nodes for image backend hosting.
Story 5.2.2 adds concrete SQLite persistence + status-history recording for execution-node records.
Story 5.2.3 adds adapter-backed execution-node health/capability refresh orchestration through existing image execution adapter seams.
Story 5.2.4 adds authoritative execution-node query/list use cases for operational inventory and studio readiness consumers.
Story 5.2.5 adds authoritative execution-node availability override controls (enable/disable/suppress) that remain separate from backend probe observations.

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

## Story 5.2.4 query/list notes

- Adds `GetExecutionNodeDetailUseCase` for authoritative get-by-id reads backed by persisted execution-node records.
- Adds `ListExecutionNodesUseCase` for filtered inventory reads backed by `IExecutionNodeRepository.listExecutionNodes(...)`.
- List filtering supports:
  - backend family and execution target
  - trust/approval/activation/health posture
  - capability presence (`requiredCapabilitiesAnyOf`)
  - remote-scheduling and certificate requirements
  - deployment tags
  - freshness windows (`lastSeenAfter`, `lastSeenBefore`)
  - practical enabled/disabled and availability selectors
  - explicit operational availability override-mode selectors (`enabled|disabled|suppressed`)
  - backend readiness-state selectors (`ready|degraded|unavailable|unknown`)
- Both query use cases enforce optional authorization seams through
  `ExecutionNodeManagementAuthorizationHook.assertCanQueryExecutionNodes(...)` and
  `ExecutionNodeManagementAuthorizationHook.assertCanGetExecutionNodeDetail(...)`.
- Responses are projected into internal DTO-ready summaries/details suitable for admin/operational inventory and execution-readiness surfaces.

## Story 5.2.5 override notes

- New use case: `SetExecutionNodeAvailabilityOverrideUseCase`.
- Supports authoritative actions: `enable`, `disable`, `suppress` (temporary with `suppressedUntil`).
- Persisted separately from probe-observed backend state on execution-node records (`availabilityOverride*` fields).
- Optional authorization seam: `assertCanOverrideExecutionNodeAvailability(...)`.
- Revoked nodes are rejected for override updates.
- Eligibility/readiness consumers can now honor both backend observations and operational policy overrides without conflating them.
