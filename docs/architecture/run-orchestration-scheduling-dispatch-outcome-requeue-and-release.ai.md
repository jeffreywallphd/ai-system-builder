# AI Companion: Scheduling-Aware Dispatch Outcome Requeue and Reservation Release

## Story scope
Story 17.2.6 integrates scheduler-aware queue settlement into dispatch result handling so accepted and failed-start outcomes do not leave stale reservation state or disconnected scheduling behavior.

## Human doc
- `docs/architecture/run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md`

## Implemented files
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/tests/HandleRunDispatchResultUseCase.test.ts`

## Core delivery
- Dispatch-result handling now emits explicit queue-settlement actions:
  - `running-reservation-released`
  - `failed-start-requeued`
  - `terminal-finalized`
- Accepted dispatch outcomes now clear assignment reservation claim ownership instead of leaving stale scheduler claim metadata during running execution.
- Retryable failed-to-start outcomes now requeue assigned runs back to queued scheduling evaluation when retry budget remains and guarded requeue support exists.
- Non-retryable (or non-requeueable) failed starts retain terminal failed finalization behavior.

## Guardrails
- Scheduling policy remains upstream and explainable; dispatch-result handling only settles selected assignment reservation lifecycle.
- Queue-state mutation stays in queue persistence seams, not transport adapters.
- Canonical lifecycle legality remains domain-constrained (`RunDomain`) with explicit retry-pending to queued progression for requeue paths.

## Related ADRs
- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md`
