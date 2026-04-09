# AI Companion: Execution Readiness Node Availability Checks

## Story scope

Story 5.3.4 upgrades execution-readiness answers from backend-only health to authoritative run-aware readiness that includes actual node eligibility and availability.
Story 5.4.3 adds audit capture for node-selection outcomes used by readiness and assignment workflows.

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
- Human doc: `docs/architecture/execution-readiness-node-availability-checks.md`

## Core delivery

- `GetImageManipulationExecutionReadinessUseCase` now calls node-selection services after backend checks.
- Readiness responses now include structured `nodeAvailability` state and reason summaries.
- Readiness explicitly reports when a request is backend-valid but has no eligible node right now.
- Runtime query API and transport schemas now project this node-aware readiness surface.

## Outcome semantics

- `readyForExecution=true` requires both backend compatibility and at least one eligible/routable execution node.
- No candidate nodes: `execution-node-candidates-unavailable` with `nodeAvailability.state=unavailable`.
- Candidates exist but none eligible: `execution-node-no-eligible-match` with `nodeAvailability.state=constrained`.
- Backend-blocking validation keeps node evaluation fail-closed with `nodeAvailability.state=unknown`.

## Boundary posture

- Eligibility truth stays in node-domain/application services.
- Readiness composition stays in application layer.
- API/schema surfaces expose normalized contracts only.
- Node-selection decisions now emit audit events from application services with run/workspace context and selected-node outcome.
- Sensitive connection/configuration details are redacted by the execution-node audit port before authoritative recording.
