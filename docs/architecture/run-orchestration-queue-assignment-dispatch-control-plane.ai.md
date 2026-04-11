# AI Companion: Run Orchestration Queue, Assignment, and Dispatch Control Plane

## Story scope
Story 16.2.8 documents the implemented authoritative orchestration core so scheduler-policy work can evolve without breaking queue truth, assignment safety, dispatch boundaries, progress ingestion, or completion/failure finalization.

## Human doc
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`

## Canonical seams
- Queue/claim/finalization persistence: `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- Assignment policy and capability checks: `src/application/runs/ports/RunAssignmentEligibilityPorts.ts`
- Image-run node eligibility/selection contracts: `src/application/nodes/ports/ExecutionNodeManagementPorts.ts`
- Dispatch command and backend seam: `src/application/runs/ports/RunExecutionDispatchPorts.ts`
- Core orchestration use cases:
  - `ProcessQueuedRunDispatchUseCase`
  - `SelectAssignmentReadyRunsUseCase`
  - `ImageRunNodeEligibilityEvaluationService`
  - `ImageRunExecutionNodeSelectionService`
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

## Initial image queue-to-dispatch pass
- `ProcessQueuedRunDispatchUseCase` is the initial image-slice coordinator for `queued` run dispatch.
- It composes reservation claim selection, run-to-node eligibility/selection, node-claim dispatch preparation, and backend dispatch through existing application seams.
- Lifecycle mutation remains domain-owned (`queued` -> `assigned` -> `dispatching` -> `running|failed`) and durable.
- Dispatch linkage is captured as durable dispatch-attempt metadata plus backend receipt ids for follow-on progress/result synchronization.
- Selection refusal remains explicit and structured (`stage=selection` plus selection outcome/reasons/candidate count) when no eligible node is available.
- Selection refusal releases reservation claims immediately so runs remain schedulable on later passes.

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

## Story 16.3.8 hardening baseline
- Integration regression coverage: `src/application/runs/tests/RunOrchestrationLifecycleRegression.integration.test.ts`.
- Node-aware queue-to-dispatch integration coverage: `src/application/runs/tests/ProcessQueuedRunDispatchUseCase.integration.test.ts`.
- Covered flow includes submission, queue admission, assignment selection, node claim, dispatch, progress ingestion, completion finalization, cancellation/retry policy checks, startup recovery, and run-query contract parsing.
- Duplicate assignment remains conflict-first (`already-assigned`) and is explicitly asserted.

## Deferred edges
- Advanced scheduler scoring/prioritization policy is deferred; reservation-backed queue semantics are the current stability boundary.
- Recovery automation remains intentionally guarded to safe deterministic cases; manual follow-up paths are explicit and auditable.
- Operator-only realtime event expansion beyond user-safe orchestration events is deferred until policy/audience expansion work.

## Related ADRs
- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
