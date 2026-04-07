# AI Companion: Run Orchestration Authoritative Cancellation Workflow and State Matrix

## Story scope
Story 16.3.1 implements authoritative cancellation behavior for queued and in-flight runs with explicit lifecycle progression, queue coordination, backend signaling seams, and auditable outcomes.

## Canonical doc
- `docs/architecture/run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md`

## Implemented seams
- Cancellation signaling port:
  - `src/application/runs/ports/RunExecutionCancellationPorts.ts`
- Application cancellation orchestration:
  - `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- Backend API cancellation entry:
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- Identity HTTP cancellation route:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition wiring:
  - `src/hosts/server/IdentityServerHost.ts`

## State matrix summary
- `queued`, `assignment-pending`, and `assigned` cancel paths become explicit terminal cancellation outcomes.
- `dispatching` and `running` paths become explicit `cancelling` outcomes with backend signaling attempted through cancellation ports.
- Terminal states (`completed`, `failed`, `cancelled`) return explicit no-op cancellation outcomes.

## Guardrails
- Cancellation signaling is decoupled behind a port and never invoked directly from transport handlers.
- Cancellation request/result visibility remains explicit via canonical run cancellation state plus run audit events.
- Queue claim release and queue finalization are coordinated from the cancellation use case instead of transport/infrastructure shortcuts.
