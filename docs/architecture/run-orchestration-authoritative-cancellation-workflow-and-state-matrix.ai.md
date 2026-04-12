# AI Companion: Run Orchestration Authoritative Cancellation Workflow and State Matrix

## Story scope
Story 16.3.1 implements authoritative cancellation behavior for queued and in-flight runs with explicit lifecycle progression, queue coordination, backend signaling seams, and auditable outcomes.

## Canonical doc
- `docs/architecture/run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md`

## Implemented seams
- Cancellation signaling port:
  - `src/application/runs/ports/RunExecutionCancellationPorts.ts`
- Cancellation authorization port:
  - `src/application/runs/ports/RunMutationAuthorizationPorts.ts`
- Application cancellation orchestration:
  - `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- Backend API cancellation entry:
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- Identity HTTP cancellation route:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - runtime + image-run aliases:
    - `POST /api/v1/runtime/runs/:runId/cancel`
    - `POST /api/v1/image-runs/:runId/cancel`
- Host composition wiring:
  - `src/hosts/server/IdentityServerHost.ts`

## State matrix summary
- `queued`, `assignment-pending`, and `assigned` cancel paths become explicit terminal cancellation outcomes.
- `dispatching` and `running` paths become explicit `cancelling` outcomes with backend signaling attempted through cancellation ports.
- Terminal states (`completed`, `failed`, `cancelled`) return explicit no-op cancellation outcomes.

## Guardrails
- Cancellation signaling is decoupled behind a port and never invoked directly from transport handlers.
- Cancellation authorization is enforced in the application use case via mutation-authorization ports, not only at API boundaries.
- Cancellation request/result visibility remains explicit via canonical run cancellation state plus run audit events.
- Queue claim release and queue finalization are coordinated from the cancellation use case instead of transport/infrastructure shortcuts.

## Degraded cancellation semantics
- `running` and `dispatching` cancellation remains best-effort; backend signal outcomes can be `not-supported`, `rejected`, or `failed`.
- Degraded signaling does not fabricate terminal cancellation; lifecycle remains `cancelling` until authoritative execution updates resolve terminal state.
- Denied cancellation attempts are explicit, auditable rejected outcomes with no lifecycle mutation.
