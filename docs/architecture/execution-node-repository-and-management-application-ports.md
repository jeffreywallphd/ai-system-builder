# Execution Node Repository and Management Application Ports

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.1: Execution Node Domain, Capability Model, and Management Contracts
- Epic 5.2: Node Registration, Persistence, Health, and Capability Management
- Story 5.1.3: Define repository and service ports for node registration, query, and management
- Story 5.2.1: Implement node registration and activation use cases for image execution backends

## Purpose

Define application-layer port seams so execution nodes are registered, queried, refreshed, and managed through authoritative services instead of studio-local or adapter-local side effects.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/ports/ExecutionNodeManagementAuthorizationPorts.ts`
- `src/application/nodes/use-cases/ExecutionNodeManagementUseCaseShared.ts`
- `src/application/nodes/use-cases/RegisterExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/ActivateExecutionNodeUseCase.ts`
- `src/application/nodes/tests/ExecutionNodeManagementPorts.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementUseCases.test.ts`

## Repository port responsibilities

`IExecutionNodeRepository` is the persistence boundary for execution-node resources and includes:

- registration and canonical save (`registerExecutionNode`, `saveExecutionNode`)
- read surfaces (`findExecutionNodeById`, `listExecutionNodes`)
- targeted state update seams:
  - `updateExecutionNodeHealth`
  - `updateExecutionNodeCapabilities`
  - `updateExecutionNodeAvailability`

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
