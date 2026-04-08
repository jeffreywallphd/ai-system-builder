# Feature 4 / Epic 4.1: Authoritative Run-Orchestration Posture for Image Runs

This note documents Story 4.1.5 for the image manipulation slice: image execution must flow through authoritative run submission and orchestration instead of direct studio-to-backend execution calls.

## Purpose

Define the implementation-truth architecture posture for image runs so downstream work (node assignment, result persistence, and multi-surface monitoring) extends stable seams rather than introducing side-channel execution paths.

## Canonical seams in this slice

Feature 1-3 image seams that image runs build on:

- `src/domain/assets/ImageAssetDomain.ts`
- `src/domain/image-workflows/ImageWorkflowDomain.ts`
- `src/domain/systems/ImageSystemDomain.ts`
- `src/application/image-workflows/ports/ImageManipulationExecutionPorts.ts`
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`

Feature 4 / Epic 4.1 run seams that now own image run control-plane behavior:

- `src/domain/runs/ImageRunDomain.ts`
- `src/domain/runs/RunDomain.ts`
- `src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessContracts.ts`
- `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
- `src/shared/schemas/image-workflows/ImageRunApiSchemaContracts.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/use-cases/CreateAuthoritativeRunUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- `src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`

## Authoritative orchestration flow for image manipulation

1. Studio submits intent through authoritative run/API contracts.
2. Submission validation resolves policy eligibility, workflow/system readiness, input asset binding validity, and backend-readiness dependencies.
3. Accepted submissions create durable authoritative run records before execution starts.
4. Orchestration owns queue admission and dispatch preparation; execution adapters do not self-admit work.
5. Execution handoff uses application-layer run/execution ports and adapter-neutral command contracts.
6. Provider-specific updates are normalized into canonical run lifecycle/progress/failure/result envelopes.
7. Cancellation is requested as an authoritative run transition with queue/dispatch coordination, then bridged to backend cancellation ports.
8. Output discovery is handed off as run-scoped notifications for later persistence and lineage materialization.

## Relationship of systems, workflows, assets, and adapters in run execution

- `ImageSystemDefinition` is the saved runnable configuration and workflow binding anchor.
- `ImageWorkflowDefinition` defines typed execution contract and template/version semantics.
- Logical assets are canonical run input/output references (`asset:*` and run-safe logical output references), not provider file handles.
- Run orchestration composes those resources into an authoritative run record and lifecycle.
- ComfyUI stays an infrastructure execution adapter behind application ports; it is never the lifecycle source of truth.

## Status normalization posture

- Image-run lifecycle truth is domain-owned in `ImageRunDomain` and generic lifecycle legality in `RunDomain`.
- Transport and UI consume normalized statuses and progress snapshots, not provider-native queue/history status strings.
- Failure summaries remain user-safe and backend-neutral; provider diagnostics stay in internal metadata/observability seams.
- Event replay/read projections use canonical run event/status contracts so desktop and thin clients converge on one status model.

## Layer ownership boundaries

Domain and shared contracts:

- Own lifecycle legality, invariants, run identity/scope, and canonical status vocabulary.
- Own public DTO/schema contracts and rejection of leaked backend/path internals.

Application layer:

- Own submission validation orchestration, authoritative run creation, queue/dispatch/cancel orchestration, and execution update ingestion.
- Depend on ports (`ImageRunOrchestrationPorts`, execution ports, persistence ports), not concrete transports/adapters.

Infrastructure and host layers:

- Implement repositories, queue mechanics, execution adapters, transport handlers, and host composition.
- Map provider/runtime behavior into canonical run contracts without redefining lifecycle policy.

## Non-negotiable guardrails for this slice

- Direct studio-to-ComfyUI (or any execution backend) start/progress/cancel flows are prohibited.
- Transport handlers must not write run lifecycle state directly outside authoritative application use cases.
- Execution adapters must not become queue/lifecycle authorities.
- Result persistence remains a downstream handoff seam; temporary backend output handles are not canonical asset identity.

## Extension posture for later features

- Node assignment and scheduling extend queue claim/reservation and dispatch preparation seams already defined in run orchestration.
- Result persistence and lineage extend output handoff notifications and logical reference contracts without changing submission/dispatch boundaries.
- Multi-surface monitoring extends canonical run status/event/read-model contracts rather than provider-specific telemetry payloads.

## Related architecture notes

- `docs/architecture/image-asset-feature-1-final-baseline.md`
- `docs/architecture/image-workflow-system-persistence-and-repositories.md`
- `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- `docs/architecture/image-run-api-event-contracts.md`
- `docs/architecture/image-run-orchestration-application-ports.md`
- `docs/architecture/run-submission-validation-policy-eligibility.md`
- `docs/architecture/run-authoritative-creation-persistence-workflow.md`
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`
