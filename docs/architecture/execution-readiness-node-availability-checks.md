# Execution Readiness Node Availability Checks

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.3: Node Eligibility, Run Assignment Seams, and Backend Selection Logic
- Story 5.3.4: Implement authoritative execution-readiness checks that include node availability
- Story 5.4.3: Integrate audit events for execution-node assignment/readiness actions

## Purpose

Expose an authoritative run-aware readiness answer for image execution that includes both backend capability health and current execution-node availability/eligibility.

## Implemented files

- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
- `src/application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService.ts`
- `src/application/nodes/use-cases/ImageRunExecutionNodeSelectionService.ts`
- `src/application/nodes/ports/ExecutionNodeManagementAuditPorts.ts`
- `src/infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`
- `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
- `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`

## Authoritative readiness behavior

`GetImageManipulationExecutionReadinessUseCase` now composes:

1. backend capability health + operation/contract support checks,
2. node selection evaluation against current node inventory and eligibility rules.

Readiness output includes `nodeAvailability` with:

- `state`: `available | constrained | unavailable | unknown`
- inventory counts (`candidateNodeCount`, `eligibleNodeCount`, `unavailableNodeCount`, `incompatibleNodeCount`)
- selected node id when routable
- top blocking and transient availability reason codes for explainability
- stable `reasonCode` when no candidate/eligible node exists

## Distinguishing failure classes

The readiness surface now separates these cases with explicit machine-readable signals:

- backend/capability invalid: readiness issues such as `operation-kind-unsupported`, `translation-contract-version-unsupported`
- workflow/backend valid but no routable node now: `execution-node-no-eligible-match` + `nodeAvailability.state=constrained`
- no candidate node inventory now: `execution-node-candidates-unavailable` + `nodeAvailability.state=unavailable`

This provides launch/readiness messaging that can differentiate validation problems from node-availability problems.

## Boundary posture

- Node trust/capability/availability truth remains in node-domain and node-application services.
- Execution readiness remains an application-layer orchestrator, not a UI heuristic.
- API/transport layers only project normalized readiness contracts.
- Adapter probe payloads remain adapter-owned and do not bypass application eligibility logic.
- Readiness and assignment node-selection outcomes are now audited from application services with run/workspace context.
- Audit publication follows best-effort non-blocking semantics with sensitive connection/configuration detail redaction.
