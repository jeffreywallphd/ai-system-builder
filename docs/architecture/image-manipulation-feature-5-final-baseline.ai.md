# AI Companion: Feature 5 Final Baseline for Node-Based Execution and Backend Management

## Purpose

Provide implementation-truth completion verification for Feature 5 so Feature 6 and later scheduling/admin work extend stable node-management and orchestration seams without reviving implicit local backend assumptions.

## Canonical source doc

- `docs/architecture/image-manipulation-feature-5-final-baseline.md`

## Completion posture summary

- Execution backends are now explicit trusted execution-node resources with canonical trust, activation, health, capability, and availability posture.
- Node registration, activation, backend refresh, and administrative availability overrides are authoritative application workflows.
- Run readiness and queued dispatch now rely on reusable node eligibility and deterministic node-selection services.
- Public management/readiness APIs expose normalized node inventory and backend-availability state through shared contracts.
- Node management and selection/readiness actions publish redacted audit events through best-effort sinks.

## Canonical seams

- `src/domain/nodes/ExecutionNodeDomain.ts`
- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- `src/application/nodes/ports/ExecutionNodeManagementAuditPorts.ts`
- `src/application/nodes/use-cases/RegisterExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/ActivateExecutionNodeUseCase.ts`
- `src/application/nodes/use-cases/RefreshExecutionNodeBackendStateUseCase.ts`
- `src/application/nodes/use-cases/SetExecutionNodeAvailabilityOverrideUseCase.ts`
- `src/application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService.ts`
- `src/application/nodes/use-cases/ImageRunExecutionNodeSelectionService.ts`
- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
- `src/infrastructure/api/nodes/ExecutionNodeManagementBackendApi.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/ExecutionNodeManagementAuthoritativeApiRoutes.ts`
- `src/infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink.ts`

## Guardrails to preserve

- Direct studio-to-ComfyUI or implicit local-sidecar execution paths are prohibited.
- Transport handlers and adapters must not bypass authoritative node trust/eligibility/selection services.
- Run orchestration owns lifecycle and dispatch progression; node services provide routing eligibility inputs.
- Backend probe payloads remain adapter detail and must not become control-plane truth.

## Follow-on integration dependencies

- Feature 6 (result persistence/preview/lineage): consume authoritative run + execution-node linkage without leaking adapter handles or backend-local paths.
- Later scheduling/admin work: extend policy/arbitration and admin UX through current reason-bearing eligibility/selection and management API seams.

## Known limits to keep explicit

- Deterministic eligible-first selection is a production-safe baseline, not full capacity-aware optimization.
- Backend readiness freshness remains bounded by current probe cadence/telemetry.
- Advanced multi-node quota, reservation-window, and broader fleet balancing policies remain deferred.

## Verification anchors

- `src/domain/nodes/tests/ExecutionNodeDomain.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementUseCases.test.ts`
- `src/application/nodes/tests/ExecutionNodeManagementSqliteIntegration.test.ts`
- `src/application/nodes/tests/ImageRunNodeEligibilityEvaluationService.test.ts`
- `src/application/nodes/tests/ImageRunExecutionNodeSelectionService.test.ts`
- `src/application/image-workflows/tests/GetImageManipulationExecutionReadinessUseCase.test.ts`
- `src/application/runs/tests/ProcessQueuedRunDispatchUseCase.integration.test.ts`
- `src/infrastructure/api/nodes/tests/ExecutionNodeManagementBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerExecutionNodeManagement.test.ts`
- `src/infrastructure/audit/tests/AuthoritativeSecurityAuditAdapters.test.ts`
