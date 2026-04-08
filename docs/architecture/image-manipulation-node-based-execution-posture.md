# Feature 5 / Epic 5.1: Node-Based Execution Posture for the Image Slice

## Story alignment

- Feature 5: Node-Based Execution and Backend Management
- Epic 5.1: Execution Node Domain, Capability Model, and Management Contracts
- Story 5.1.5: Document the node-based execution posture for the image manipulation slice

## Purpose

Capture the architecture posture that makes image execution node-based, authoritative, and policy-ready so future scheduling, trust, and multi-node work extends stable seams rather than reviving implicit local-sidecar assumptions.

## Relationship to prior Feature 5 notes

This note composes earlier Story 5.1 docs and avoids restating their full contract detail:

- `execution-node-domain-model-image-backend-hosting.md`
- `execution-node-capability-compatibility-contracts.md`
- `execution-node-repository-and-management-application-ports.md`
- `execution-node-management-readiness-api-contracts.md`
- `image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md`

## Canonical seams for this posture

Execution-node and compatibility domain seams:

- `src/domain/nodes/ExecutionNodeDomain.ts`
  - `ExecutionNodeRecord`
  - `evaluateImageExecutionNodeEligibility(...)`
  - `evaluateImageExecutionNodeCompatibility(...)`

Node-management application seams:

- `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
  - `IExecutionNodeRepository`
  - `ExecutionNodeManagementServicePorts`
  - `IExecutionNodeEligibilityEvaluationServicePort`
  - `IExecutionNodeSelectionHintsServicePort`

Image readiness and orchestration-facing seams:

- `src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts`
- `src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts`
- `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`

Shared API/schema seam for admin and readiness visibility:

- `src/shared/contracts/nodes/ExecutionNodeManagementApiContracts.ts`
- `src/shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts.ts`

Runtime composition seam:

- `src/hosts/server/IdentityServerHost.ts`

## Node-based execution posture (image slice)

Image execution is routed to an approved execution node through authoritative services. ComfyUI remains a backend adapter implementation, not a control-plane authority.

Practical implications:

1. Runs do not execute because a local backend happens to be present.
2. Runs execute only when canonical node eligibility and readiness checks pass.
3. Backend-family capability metadata is treated as authoritative routing input.
4. UI and transport surfaces consume normalized readiness and eligibility summaries instead of probing backend adapters directly.
5. Scheduling and dispatch extensions must consume node-management and compatibility seams, not backend internals.

## How execution nodes relate to systems, workflows, and runs

- Workflow and system definitions declare what execution characteristics are required.
- Run submission/readiness uses those requirements to evaluate whether execution is queue-eligible and backend-ready.
- Execution-node compatibility determines where a run may be routed (`compatible` and `routable`) using trust, activation, health, backend-family support, and capability requirements.
- Orchestration and scheduling consume those outcomes; backend adapters execute only after assignment/dispatch decisions are made.

## Layer ownership boundaries

Domain and application ownership:

- node identity, trust-linked posture, lifecycle/readiness invariants, and compatibility logic
- authoritative eligibility and selection-hint service contracts
- run submission/readiness decisions that gate queue admission and routability

Adapter, probe, and host ownership:

- backend-family probes and transport interactions
- mapping probe outcomes into canonical health/capability refresh observations
- host wiring/composition that registers authoritative services and adapters

Explicit boundary rule:

- Adapter probe payloads or transport-native backend status terms must not become the source of truth for run eligibility, run lifecycle, or node trust posture.

## ComfyUI posture in this model

- ComfyUI is represented as backend-family capability metadata on execution nodes.
- ComfyUI readiness contributes to eligibility/availability outcomes through canonical contracts.
- ComfyUI transport clients/adapters do not own admission, eligibility, queue, or trust policy decisions.

## Future-safe extension assumptions

This posture intentionally preserves clean seams for:

- multi-node and hybrid-node placement
- policy-driven scheduling and affinity controls
- richer trust posture and certificate lifecycle integration
- backend-family expansion beyond ComfyUI without API/contract redesign

## Prohibited shortcuts

- Direct studio-to-ComfyUI execution for authoritative image runs is prohibited.
- Treating local runtime presence as implicit authorization/eligibility is prohibited.
- Embedding node eligibility policy inside transport handlers or backend adapters is prohibited.
- Returning raw adapter probe payloads as public management/readiness truth is prohibited.
