# Feature 5 Final Baseline: Node-Based Execution and Backend Management

This document records Feature 5 completion for the image manipulation vertical slice and locks the implementation-truth baseline for Epic 5.4 Story 5.4.4.

Feature 5 is the point where execution environments become explicit, trusted, and policy-aware execution nodes. This baseline is the required foundation before Feature 6 (result persistence, preview generation, and lineage) and richer multi-node administration/scheduling layers are expanded.

## Feature 5 verification summary

Feature 5 is complete for node-based execution and backend management in the image slice:

- execution backends are represented as explicit execution-node records with trust, activation, health, and capability posture
- node capability metadata and compatibility contracts are canonical routing inputs for image-run eligibility
- node registration, activation, backend refresh, and availability override flows are authoritative application behavior behind ports
- run readiness and queued dispatch use node eligibility and deterministic selection services instead of implicit local backend assumptions
- authoritative API surfaces expose node inventory, readiness, eligibility, and backend availability through normalized contracts
- audit hooks capture node management and assignment/readiness actions with redaction-safe details

## Canonical node domain and management model

Core node-domain and application seams:

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

Domain posture:

- node identity/trust/activation/readiness are authoritative control-plane data, not adapter-local state
- backend family capability and compatibility findings are normalized domain outputs for orchestration policy
- user identity/session and run lifecycle ownership remain separate domains from node trust and backend adapter details

## Authoritative node-management and execution routing flow locked by Feature 5

1. Node onboarding and lifecycle use cases create and mutate execution-node records through repository ports.
2. Backend capability/health probes are ingested through backend-refresh seams and normalized into canonical node state.
3. Administrative availability overrides (`enable`, `disable`, `suppress`) apply as explicit control-plane posture.
4. Run readiness and run-to-node eligibility evaluate required backend/capability/target constraints against current node posture.
5. Deterministic selection chooses an eligible node or returns explicit no-placement outcomes.
6. Queue assignment and dispatch preparation consume the selected/ranked node outcomes through authoritative orchestration seams.
7. Backend adapters execute after orchestration assignment decisions; adapter transport details do not own placement or trust policy.

## API integration and audit posture

Authoritative API seams:

- node management backend API:
  - `src/infrastructure/api/nodes/ExecutionNodeManagementBackendApi.ts`
- route family:
  - `src/infrastructure/transport/http-server/authoritative-route-families/ExecutionNodeManagementAuthoritativeApiRoutes.ts`
- shared contracts/schemas:
  - `src/shared/contracts/nodes/ExecutionNodeManagementApiContracts.ts`
  - `src/shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts.ts`
- principal endpoints:
  - `GET /api/v1/execution-nodes`
  - `GET /api/v1/execution-nodes/:nodeId`
  - `POST /api/v1/execution-nodes/:nodeId/availability`
  - `GET /api/v1/execution-nodes/readiness`
  - `GET /api/v1/execution-nodes/eligibility`
  - `GET /api/v1/execution-nodes/backends/availability`

Audit seams:

- application audit contracts:
  - `src/application/nodes/ports/ExecutionNodeManagementAuditPorts.ts`
- infrastructure sink:
  - `src/infrastructure/audit/AuthoritativeExecutionNodeManagementAuditSink.ts`

Audit posture:

- node management and selection/readiness actions publish best-effort governance events
- sensitive connection/configuration fields are redacted before sink publication
- audit failures do not break authoritative management or orchestration workflows

## Architectural boundaries and assumptions

- direct studio-to-ComfyUI or implicit local-sidecar execution shortcuts are prohibited
- transport handlers authenticate/validate/map requests but do not implement node trust/eligibility policy
- run orchestration owns queue assignment and dispatch lifecycle; node services provide eligibility/selection inputs
- backend adapters own protocol translation and probing, not trust posture or assignment decisions
- capability/readiness contracts are adapter-agnostic and must remain stable for backend-family expansion

## Follow-on integration dependencies

### Feature 6: Result persistence, preview, and lineage

Feature 6 must:

- consume authoritative execution-node linkage already attached to run orchestration/finalization seams
- preserve node identity as lineage context (`executionNodeId`) without leaking adapter-local handles
- keep persistence and preview pipelines downstream of authoritative run/node routing decisions
- avoid reintroducing backend-path or local-runtime assumptions into result identity contracts

### Later administration and scheduling expansions

Follow-on work should:

- extend policy/arbitration modules for multi-node, quota/capacity, and deployment-profile-aware scheduling
- preserve deterministic reason-bearing eligibility/selection outputs for operator explainability
- reuse node management APIs/audit hooks for richer administration UX rather than adding adapter-direct admin paths
- keep certificate/trust lifecycle hardening in node-trust/security seams, not in run transport handlers

## Known limits and intentional non-goals

Known limits in this baseline:

- selection strategy is intentionally deterministic eligible-first and not yet resource-capacity optimized
- backend refresh/readiness remains bounded by current probe cadence and adapter-provided telemetry
- availability overrides are administrative controls, not full fleet scheduling governance policy
- broad multi-node balancing, reservation windows, and advanced quota scheduling remain deferred

Intentional non-goals for Feature 5:

- implementing result persistence, preview derivation, or lineage graph ownership (Feature 6 scope)
- implementing distributed control-plane federation across remote clusters
- introducing UI- or adapter-owned trust/eligibility policy pathways that bypass authoritative services

## Verification coverage and cross-references

Primary regression and integration coverage:

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

Related architecture and contributor docs:

- `docs/architecture/execution-node-domain-model-image-backend-hosting.md`
- `docs/architecture/execution-node-capability-compatibility-contracts.md`
- `docs/architecture/execution-node-repository-and-management-application-ports.md`
- `docs/architecture/execution-node-persistence-and-status-history.md`
- `docs/architecture/execution-node-run-to-node-eligibility-evaluation.md`
- `docs/architecture/execution-node-initial-selection-strategy.md`
- `docs/architecture/execution-readiness-node-availability-checks.md`
- `docs/architecture/execution-node-management-readiness-authoritative-apis.md`
- `docs/architecture/image-manipulation-node-based-execution-posture.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`
- `docs/run-orchestration-contributor-guide.md`
