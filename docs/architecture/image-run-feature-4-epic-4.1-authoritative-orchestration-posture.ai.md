# AI Companion: Feature 4 / Epic 4.1 Authoritative Image-Run Orchestration Posture

## Story scope
Story 4.1.5 documents the authoritative orchestration posture for image manipulation runs so studio execution intent always routes through run submission, validation, queueing, lifecycle management, cancellation, and execution-result handoff.

## Canonical human doc
- `docs/architecture/image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md`

## Canonical seams
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
- `src/infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter.ts`

## Posture summary
- Image execution intent must enter through authoritative run submission, not direct studio-to-backend execution calls.
- Submission readiness remains first-class (policy, asset bindings, workflow/system validity, backend dependency, compatibility findings).
- Authoritative run records are durable lifecycle truth before dispatch starts.
- Queue admission, dispatch handoff, progress ingestion, and cancellation stay orchestration-owned in application/use-case seams.
- ComfyUI remains a backend adapter behind ports; provider payloads/statuses are normalized before leaving infrastructure.
- Output collection is a handoff seam for future result persistence and lineage materialization.

## Layer boundary rules
- Domain/shared contracts own lifecycle legality, status vocabulary, invariants, and public transport-safe contracts.
- Application owns run orchestration decisions and progression over ports.
- Infrastructure owns transport/persistence/adapter mechanics and normalization only.
- Hosts wire composition and route-family coverage; they do not redefine run policy.

## Explicit guardrails
- Direct UI/studio dispatch to Comfy transport clients is prohibited.
- Transport handlers and adapters must not mutate lifecycle directly outside authoritative use cases.
- Temporary backend output handles are not canonical output identity.

## Follow-on compatibility
- Node-assignment and scheduler features extend queue/claim/dispatch seams without changing submission authority.
- Result persistence extends output-handoff and logical-reference seams without redesigning run lifecycle contracts.
- Monitoring/replay extends canonical run status/event contracts across desktop and thin-client surfaces.

## Story 4.4.2 studio integration update
- Image Manipulation Studio run launch now uses authoritative runtime run APIs through `RuntimeOperationsService` (shared runtime control client) rather than direct `startSystemExecution` launch calls.
- Studio runtime UX state now follows normalized run lifecycle labels: `validating`, `queued`, `running`, `failed`, `completed`, `cancelled`.
- Monitoring and cancellation in the image editor now operate on authoritative run identifiers from submission responses.
- Persistence handoff remains after authoritative terminal status, preserving downstream result integration seams without reworking studio launch/monitoring architecture.
