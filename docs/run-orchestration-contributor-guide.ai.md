# AI Companion: Run Orchestration Contributor Guide

## Purpose
Quick workflow for extending queue selection, node assignment, dispatch, progress ingestion, and terminal finalization without breaking authoritative control-plane boundaries.

## Human doc
- `docs/run-orchestration-contributor-guide.md`
- `docs/architecture/run-orchestration-operational-visibility-projections.md`
- `docs/architecture/run-orchestration-startup-recovery-reconciliation.md`
- `docs/architecture/run-orchestration-scheduling-policy-domain-model.md`
- `docs/architecture/run-orchestration-scheduling-policy-shared-contracts.md`
- `docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.md`
- `docs/architecture/run-orchestration-scheduling-role-priority-first-release.md`
- `docs/architecture/run-orchestration-scheduling-hybrid-node-local-interactive-protection.md`
- `docs/architecture/run-orchestration-scheduling-required-capability-affinity-eligibility.md`
- `docs/architecture/run-orchestration-scheduling-decision-reason-capture.md`
- `docs/architecture/run-orchestration-scheduling-visibility-projections.md`
- `docs/architecture/run-orchestration-scheduling-admin-controls.md`
- `docs/architecture/run-orchestration-scheduling-audit-operational-hooks.md`
- `docs/architecture/run-orchestration-scheduling-realtime-event-publication.md`
- `docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.md`
- `docs/architecture/run-orchestration-scheduling-deployment-profile-policy-seams.md`
- `docs/architecture/run-orchestration-scheduling-architecture-extension-guidance.md`
- `docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`
- `docs/architecture/run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md`
- `docs/architecture/run-orchestration-scheduling-deterministic-candidate-arbitration.md`
- `docs/architecture/run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md`
- `docs/architecture/run-orchestration-scheduling-node-availability-and-eligibility-refresh.md`
- `docs/architecture/run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md`
- `docs/architecture/image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`

## Required workflow
- Update shared run contracts/schemas first.
- Update shared scheduling policy contracts/schemas first (`SchedulingPolicyEvaluationContracts` + `SchedulingPolicyEvaluationSchemaContracts`).
- Keep lifecycle legality in `src/domain/runs/RunDomain.ts`.
- Add scheduler/assignment/dispatch/update behavior in `src/application/runs/use-cases/*` and ports.
- Keep the initial image queue-to-dispatch seam in `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`.
- Add persistence/adapter/transport wiring only after application behavior is correct.
- Keep operational logging/metrics hooks in dedicated run observability seams (`RunOrchestrationObservability*`) rather than mixing log shaping into run-domain transitions.
- Keep host route-family/backend registration composition aligned.
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
  - `src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`

## Scheduler extension guidance
- Build policy above reservation-backed queue selection.
- Keep canonical scheduling policy concepts in `src/domain/scheduling/SchedulingDomain.ts`.
- Keep scheduling decision-pipeline contracts in `src/application/scheduling/*`.
- Add new policy checks as pluggable rules through `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts` and `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`.
- Keep arbitration behavior explicit in `RolePrioritySchedulingArbitration.ts` (or an explicit replacement module) with deterministic fallback ordering.
- Keep affinity preference handling in `SchedulingPlacementAffinityPreference.ts`; keep hard denials in rule modules.
- Reuse node eligibility + assignment policy seams.
- Reuse image-run node eligibility + deterministic selection seams before dispatch claim (`IImageRunNodeEligibilityEvaluationServicePort` + `IImageRunExecutionNodeSelectionServicePort`).
- Preserve claim release behavior for ineligible node-targeted selections.
- Keep deterministic queue ordering and reservation TTL semantics.

## Queue/reservation/arbitration integration map
- Queue leasing remains in `SelectAssignmentReadyRunsUseCase` + `IRunOrchestrationQueuePersistenceRepository`.
- Initial simplified queue-to-dispatch orchestration remains in `ProcessQueuedRunDispatchUseCase` (selection -> claim -> dispatch).
- Scheduling snapshot assembly and policy evaluation remain in `AssembleAuthoritativeSchedulingInputUseCase` + `EvaluateAuthoritativeSchedulingDecisionPipelineUseCase`.
- Assignment materialization and temporary hold lifecycle remain in `MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase`.
- Node-claim finalization conflict semantics remain in `ClaimRunForNodeDispatchPreparationUseCase`.
- Dispatch outcome reservation settlement remains in `HandleRunDispatchResultUseCase`.
- Preserve explicit outcomes as contract behavior: duplicate-assignment conflicts, explicit no-placement defer/release, hold acquire/conflict/release, and dispatch release/requeue/finalize settlement.
- Add future capacity/quota/reservation-window policy logic in scheduling/arbitration modules, not transport handlers or dispatch adapters.

## Dispatch extension guidance
- Build canonical command first.
- Add backend mapping only through `IRunExecutionBackendAdapter` + router registration.
- Route all outcomes through authoritative dispatch-result handling.

## Progress/finalization guidance
- Keep completion/failure/cancellation finalization in `FinalizeRunExecutionOutcomeUseCase`.
- Preserve explicit terminal summary hints (`outputAvailability`, `terminalQuality`) so future result-persistence/lineage work can classify partial/degraded outcomes through typed metadata instead of backend-specific payload inspection.

## Cancellation extension guidance
- Keep cancellation orchestration in `RequestAuthoritativeRunCancellationUseCase`.
- Add backend cancellation integration only behind `IRunExecutionCancellationSignalPort`.
- Keep cancellation authorization in application seams through `IAuthoritativeRunMutationAuthorizationPort` (`src/application/runs/ports/RunMutationAuthorizationPorts.ts`), not only transport/API checks.
- authoritative registration seam: `src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`
- Comfy cancellation bridge: `src/infrastructure/execution/runs/ComfyUiRunExecutionCancellationSignalAdapter.ts`
- Keep lifecycle-position-dependent outcomes explicit (terminal cancel, cancelling request, terminal no-op).
- Keep degraded signaling semantics explicit (`not-supported`/`rejected`/`failed`) while lifecycle remains authoritative (`cancelling`) until execution updates finalize.
- Keep queue claim release/finalization coordination in application seams, not transport handlers.

## Retry/rerun extension guidance
- Keep retry eligibility + lineage orchestration in `RequestAuthoritativeRunRetryUseCase`.
- Keep retry implementation as authoritative resubmission through validation/creation use cases.
- Preserve linkage via `retry.previousRunId`, incremented attempt counters, and explicit retry reason when present.
- Keep source-run history immutable; retries create derived runs instead of mutating historical truth.
- Return explicit ineligible semantics for non-retry-eligible states.

## Startup recovery guidance
- Keep startup reconciliation in `RecoverRunOrchestrationStartupStateUseCase`.
- Preserve guarded stale-assigned requeue semantics behind queue persistence support.
- Keep stale dispatching/running transitions explicit and auditable.
- Record manual-follow-up outcomes explicitly when safe automatic recovery is unavailable.

## Prohibited patterns
- Bypassing reservation claim semantics is prohibited.
- Bypassing authoritative node claim use case before dispatch is prohibited.
- Dispatching directly from transport handlers is prohibited.
- Mutating run lifecycle directly from infrastructure adapters is prohibited.
- Embedding scheduling policy logic in UI/transport/persistence/dispatch adapters is prohibited.
- Bypassing execution-update ingestion validation for lifecycle/progress writes is prohibited.
- Bypassing authoritative submission validation + creation for retried runs is prohibited.
- Emitting unsanitized prompts/secrets/raw paths/backend payloads in orchestration diagnostics is prohibited.

## Regression hardening check
- Keep integrated lifecycle regression coverage healthy in `src/application/runs/tests/RunOrchestrationLifecycleRegression.integration.test.ts` to catch cross-seam drift across submission, queueing, assignment, dispatch, progress, completion, cancellation/retry checks, recovery, and visibility contracts.
- Include scheduling hardening checks for duplicate-intent suppression (`MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase`), no-placement defer/backoff outcomes, and scheduling-admin schema validation.

## Deferred scheduling edges
- Single-assignment recommendation per scheduling pass remains current scope.
- Quotas, reservation windows/calendars, and richer resource arbitration remain deferred.
- Deployment-profile governance variants remain seam-only.
