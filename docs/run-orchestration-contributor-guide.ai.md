# AI Companion: Run Orchestration Contributor Guide

## Purpose
Quick workflow for extending queue selection, node assignment, dispatch, progress ingestion, and completion/failure finalization without breaking authoritative control-plane boundaries.

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
- `docs/architecture/run-orchestration-scheduling-architecture-extension-guidance.md`
- `docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`
- `docs/architecture/run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md`
- `docs/architecture/run-orchestration-scheduling-deterministic-candidate-arbitration.md`
- `docs/architecture/run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md`
- `docs/architecture/run-orchestration-scheduling-node-availability-and-eligibility-refresh.md`

## Required workflow
- Update shared run contracts/schemas first.
- Update shared scheduling policy contracts/schemas first (`SchedulingPolicyEvaluationContracts` + `SchedulingPolicyEvaluationSchemaContracts`).
- Keep lifecycle legality in `src/domain/runs/RunDomain.ts`.
- Add scheduler/assignment/dispatch/update behavior in `src/application/runs/use-cases/*` and ports.
- Add persistence/adapter/transport wiring only after application behavior is correct.
- Keep operational logging/metrics hooks in dedicated run observability seams (`RunOrchestrationObservability*`) rather than mixing log shaping into run-domain transitions.
- Keep host route-family/backend registration composition aligned.

## Scheduler extension guidance
- Build policy above reservation-backed queue selection.
- Keep canonical scheduling policy concepts in `src/domain/scheduling/SchedulingDomain.ts`.
- Keep scheduling decision-pipeline contracts in `src/application/scheduling/*`.
- Add new policy checks as pluggable rules through `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts` and `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`.
- Keep arbitration behavior explicit in `RolePrioritySchedulingArbitration.ts` (or an explicit replacement module) with deterministic fallback ordering.
- Keep affinity preference handling in `SchedulingPlacementAffinityPreference.ts`; keep hard denials in rule modules.
- Reuse node eligibility + assignment policy seams.
- Preserve claim release behavior for ineligible node-targeted selections.
- Keep deterministic queue ordering and reservation TTL semantics.

## Dispatch extension guidance
- Build canonical command first.
- Add backend mapping only through `IRunExecutionBackendAdapter` + router registration.
- Route all outcomes through authoritative dispatch-result handling.

## Cancellation extension guidance
- Keep cancellation orchestration in `RequestAuthoritativeRunCancellationUseCase`.
- Add backend cancellation integration only behind `IRunExecutionCancellationSignalPort`.
- Keep lifecycle-position-dependent outcomes explicit (terminal cancel, cancelling request, terminal no-op).
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
