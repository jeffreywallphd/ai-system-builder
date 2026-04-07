# AI Companion: Run Orchestration Queue, Assignment, and Dispatch Control Plane

## Story scope
Story 16.2.8 documents the implemented authoritative orchestration core so scheduler-policy work can evolve without breaking queue truth, assignment safety, dispatch boundaries, progress ingestion, or completion/failure finalization.

## Human doc
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`

## Canonical seams
- Queue/claim/finalization persistence: `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- Assignment policy and capability checks: `src/application/runs/ports/RunAssignmentEligibilityPorts.ts`
- Dispatch command and backend seam: `src/application/runs/ports/RunExecutionDispatchPorts.ts`
- Core orchestration use cases:
  - `SelectAssignmentReadyRunsUseCase`
  - `ClaimRunForNodeDispatchPreparationUseCase`
  - `BuildAssignedRunExecutionCommandUseCase`
  - `DispatchAssignedRunExecutionUseCase`
  - `HandleRunDispatchResultUseCase`
  - `IngestRunExecutionUpdateUseCase`
  - `FinalizeRunExecutionOutcomeUseCase`
- Lifecycle legality source of truth: `src/domain/runs/RunDomain.ts`

## Scheduling boundary
- Scheduling policy decides which lease-claimed run/node pair should be attempted.
- Dispatch orchestration only dispatches an already-assigned run through canonical command + backend adapter seams.
- Do not collapse scheduling and dispatch into one transport or adapter layer.

## Required invariants
- Reservation ownership is authoritative (`claimToken`, `claimedBy`, `claimExpiresAt`).
- Node assignment must remain conflict-safe (`already-assigned`, reservation/queue conflict outcomes).
- Terminal completed/failed runs must finalize queue state and release active assignment ownership.
- User-safe status/result fields and internal diagnostics must remain split.
- Node lifecycle/progress updates must reject sender mismatch and backend identity drift.

## Prohibited shortcuts
- Writing orchestration state directly in transport handlers is prohibited.
- Bypassing `ClaimRunForNodeDispatchPreparationUseCase` before dispatch is prohibited.
- Calling backend adapters without canonical execution-command building is prohibited.
- Applying lifecycle/progress updates outside `IngestRunExecutionUpdateUseCase` validation is prohibited.
- Re-defining lifecycle transition legality outside `RunDomain` is prohibited.
