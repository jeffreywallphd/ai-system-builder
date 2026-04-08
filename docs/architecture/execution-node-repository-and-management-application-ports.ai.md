# AI Companion: Execution Node Repository and Management Application Ports

## Story scope

Story 5.1.3 introduces application-layer repository and service ports for execution-node registration, query, health/capability refresh, eligibility evaluation, availability management, and scheduling selection hints.

## Implemented files

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/tests/ExecutionNodeManagementPorts.test.ts`
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

## Consumer posture

These ports are intended for authoritative run orchestration, scheduling, node-admin controls, and backend refresh workflows. They avoid coupling to adapter-specific probe formats or studio-local execution shortcuts.

## Boundary posture

- Backend-family agnostic interface shapes.
- Compatible with trust/approval/certificate-managed node lifecycle expansion.
- Supports future policy-aware and multi-node scheduling without rewriting application contracts.
