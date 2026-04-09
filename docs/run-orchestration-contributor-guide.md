# Run Orchestration Contributor Guide

## Purpose

Provide an implementation checklist for contributors extending the authoritative queue/assignment/dispatch lifecycle and scheduler-policy behavior without breaking control-plane ownership boundaries.

## Canonical docs for this area

- `docs/architecture/run-orchestration-domain-foundation.md`
- `docs/architecture/run-orchestration-transport-contracts.md`
- `docs/architecture/run-orchestration-queue-assignment-selection.md`
- `docs/architecture/run-orchestration-node-capability-matching.md`
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
- `docs/architecture/run-orchestration-node-claim-dispatch-preparation.md`
- `docs/architecture/run-orchestration-execution-command-dispatch-seams.md`
- `docs/architecture/run-orchestration-dispatch-result-lifecycle-progression.md`
- `docs/architecture/run-orchestration-execution-heartbeat-progress-ingestion.md`
- `docs/architecture/run-orchestration-completion-failure-finalization.md`
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`
- `docs/architecture/run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md`
- `docs/architecture/run-orchestration-authoritative-retry-rerun-workflow-and-lineage.md`
- `docs/architecture/run-orchestration-startup-recovery-reconciliation.md`
- `docs/architecture/run-orchestration-operational-visibility-projections.md`
- `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md`
- `docs/architecture/image-run-feature-4-epic-4.1-authoritative-orchestration-posture.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`

## Required implementation path

1. Update shared contracts and schema parsing first when payloads or route behavior change:
   - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
   - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
   - `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
   - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
2. Keep lifecycle and state coherence in canonical domain transitions:
   - `src/domain/runs/RunDomain.ts`
3. Implement orchestration rules in application use cases and ports:
   - `src/application/runs/use-cases/*`
   - `src/application/runs/ports/*`
   - Initial queued-to-dispatch image slice seam: `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
4. Apply persistence, dispatch-adapter, and API transport changes only after application behavior is finalized:
   - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
   - `src/infrastructure/execution/runs/*`
   - `src/infrastructure/api/runs/*`
   - `src/infrastructure/api/runs/RunOrchestrationObservability.ts`
   - `src/infrastructure/api/runs/RunOrchestrationObservabilityRedaction.ts`
   - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
5. Keep host composition updated for required route family and backend registration coverage:
   - `src/hosts/server/IdentityServerHost.ts`
   - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
   - `src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`

## Extending scheduler policy

1. Add or evolve scheduler logic above queue persistence APIs; do not move policy into queue schema adapters.
2. Keep canonical scheduling policy models in `src/domain/scheduling/SchedulingDomain.ts`.
3. Keep scheduling decision-pipeline orchestration and rule-pipeline evaluation in `src/application/scheduling/*`.
4. Add new scheduler policy checks as modular rules via `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts` and `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`.
5. Keep arbitration behavior explicit in `RolePrioritySchedulingArbitration.ts` (or a named successor arbitration module), with deterministic fallback tie-break semantics.
6. Keep affinity behavior in `SchedulingPlacementAffinityPreference.ts` for preference filtering, and keep hard eligibility denials in rule modules.
7. Reuse `SelectAssignmentReadyRunsUseCase` reservation semantics for queue leasing.
8. Reuse `RunNodeAssignmentEligibilityService` and `IRunAssignmentPolicyPort` for node eligibility checks.
9. On ineligible node-targeted claims, keep immediate `releaseRunClaim` behavior so stale leases do not block queue flow.
10. Preserve deterministic queue ordering and reservation TTL behavior unless changes are explicitly versioned and documented.
11. For image-run dispatch orchestration, keep node resolution in `IImageRunExecutionNodeSelectionServicePort` + `IImageRunNodeEligibilityEvaluationServicePort` before claim/dispatch, and surface structured no-eligible-node reasons.

## Queue integration and reservation/arbitration extension seams

1. Keep queue lease selection in `SelectAssignmentReadyRunsUseCase` and `IRunOrchestrationQueuePersistenceRepository`.
2. Keep the initial simplified queued-to-dispatch orchestration pass in `ProcessQueuedRunDispatchUseCase` (selection -> claim -> dispatch).
3. Keep snapshot assembly and policy evaluation in:
   - `AssembleAuthoritativeSchedulingInputUseCase`
   - `EvaluateAuthoritativeSchedulingDecisionPipelineUseCase`
4. Keep assignment materialization and temporary hold lifecycle in `MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase`.
5. Keep assignment finalization conflict handling in `ClaimRunForNodeDispatchPreparationUseCase`.
6. Keep dispatch outcome reservation settlement in `HandleRunDispatchResultUseCase`.
7. Preserve explicit outcomes as first-class behavior:
   - no duplicate assignment (`already-assigned` and reservation conflict semantics)
   - explicit no-placement defer/release behavior (reason-bearing queue settlement)
   - explicit placement-hold acquire/conflict/release lifecycle
   - explicit dispatch outcome settlement (release, requeue, terminal finalization)
8. Add new capacity/quota/reservation-window policies in scheduling policy and arbitration modules, not in transport handlers or dispatch adapters.

## Extending backend dispatch integrations

1. Keep dispatch command creation in `BuildAssignedRunExecutionCommandUseCase`.
2. Add backend-specific translation as `IRunExecutionBackendAdapter` implementations in infrastructure.
3. Register new adapters only through `RunExecutionDispatchRouter`.
4. Route all dispatch outcomes through `HandleRunDispatchResultUseCase` so state progression and attempt-result persistence stay authoritative.

## Extending progress ingestion and finalization

1. Keep node lifecycle/progress updates inside `IngestRunExecutionUpdateUseCase`.
2. Preserve sender-node and backend identity consistency checks.
3. Keep internal diagnostics in metadata telemetry, not run read projections.
4. Keep completion/failure/cancellation finalization in `FinalizeRunExecutionOutcomeUseCase`, including queue finalization and assignment release.
5. Preserve explicit terminal summary hints (`outputAvailability`, `terminalQuality`) in finalization metadata so downstream result-persistence seams can reason over partial/degraded outcomes without reclassifying backend payloads.

## Image Manipulation Runtime UX (Feature 7, Epic 7.3)

1. Run launch and monitor surfaces in Image Manipulation Studio must consume authoritative runtime/run APIs through shared service seams (`RuntimeOperationsService`, `StudioShellService`), not local backend shortcuts.
2. Runtime status UX must map authoritative status/progress into stable user states: `validating`, `queued`, `preparing`, `running`, `failed`, `completed`, `cancelled`, and `degraded`.
3. Progress sections should render authoritative node progress snapshots (counts/percent/timestamp) instead of UI-local counters.
4. Warning/failure messaging should be sourced from readiness advisories and run-monitoring diagnostics while keeping primary status understandable for non-technical users.
5. Cancellation must remain authoritative (`cancelRun`) and monitor state must continue to reconcile from authoritative run status until terminal confirmation.
6. Advanced diagnostics are allowed as a secondary section, but primary run-monitoring cards should stay focused on user-safe status/progress outcomes.

## Extending cancellation orchestration

1. Keep cancellation transition logic in `RequestAuthoritativeRunCancellationUseCase`.
2. Add backend cancellation signaling only through `IRunExecutionCancellationSignalPort` implementations.
3. Keep cancellation authorization checks in application seams through `IAuthoritativeRunMutationAuthorizationPort` (`src/application/runs/ports/RunMutationAuthorizationPorts.ts`) rather than transport-only checks.
4. Preserve explicit degraded semantics for in-flight cancellation (`cancelling` + signal outcome metadata) when backend cancellation cannot be guaranteed.
5. Keep cancellation queue/claim coordination in application use cases; do not release claims directly from route handlers.
   - Authoritative host registration seam: `src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`
   - Comfy bridge implementation: `src/infrastructure/execution/runs/ComfyUiRunExecutionCancellationSignalAdapter.ts`
6. Preserve explicit cancellation outcomes by lifecycle position (immediate terminal, cancellation-requested, or terminal no-op).
7. Keep cancellation telemetry split: canonical run cancellation state for user-safe visibility, audit + metadata for operator diagnostics.

## Extending retry and rerun orchestration

1. Keep retry eligibility and lineage handling in `RequestAuthoritativeRunRetryUseCase`.
2. Treat retries as new authoritative runs; do not mutate historical source-run lifecycle state.
3. Reuse `ValidateRunSubmissionUseCase` + `CreateAuthoritativeRunUseCase` for retried submissions instead of writing run records directly.
4. Preserve lineage explicitly on the retried run (`retry.previousRunId`, incremented `retry.attempt`, optional `retryReason`).
5. Restrict retry eligibility to explicit policy states (currently `failed` and `cancelled`) and return clear ineligible semantics for all other states.

## Extending startup recovery and reconciliation

1. Keep startup recovery orchestration in `RecoverRunOrchestrationStartupStateUseCase`.
2. Preserve guarded behavior: only requeue stale `assigned` state where queue persistence supports explicit guarded requeue semantics.
3. Keep stale `dispatching`/`running` timeout transitions explicit and auditable (no silent auto-correction).
4. Always emit recovery audit intent records for both applied and manual-follow-up outcomes.
5. Document deferred/manual follow-up recovery cases explicitly rather than silently ignoring them.

## Invariants and non-negotiable boundaries

- Lifecycle transition legality is domain-owned (`RunDomain`) and must remain single-source.
- Queue reservations, assignment claim, and dispatch-attempt lineage are persistence-backed control-plane truth.
- Scheduling policy selects candidate work; dispatch adapters execute backend translation only.
- Scheduling policy decisions should remain explainable (reason-bearing) and source-traceable.
- Transport handlers authenticate/validate/map requests but do not own orchestration decisions.
- Completion/failure/cancellation terminal handling must preserve user-safe outputs and internal diagnostics separation.
- Observability/redaction concerns must stay in dedicated infrastructure seams, not in domain transition logic.
- Degraded readiness, retryability, and recovery posture must remain contract-driven (shared resilience/taxonomy/recovery seams), not adapter-local heuristics.

## Prohibited patterns

- Bypassing reservation claim semantics (`claimAssignmentReadyRuns`) is prohibited.
- Bypassing `ClaimRunForNodeDispatchPreparationUseCase` for assignment writes is prohibited.
- Bypassing run-node selection eligibility/selection services for image dispatch assignment is prohibited.
- Performing dispatch directly from route handlers without canonical command building is prohibited.
- Mutating canonical run lifecycle directly from infrastructure adapters is prohibited.
- Embedding scheduling policy logic in UI components/state, transport handlers, persistence adapters, or backend dispatch adapters is prohibited.
- Bypassing `IngestRunExecutionUpdateUseCase` for execution progress/heartbeat/lifecycle mutation is prohibited.
- Persisting internal diagnostics directly into user-facing run contracts is prohibited.
- Creating retried runs by bypassing authoritative validation + creation use cases is prohibited.
- Logging raw prompts, secrets/tokens, backend payload blobs, or raw path-bearing fields from run orchestration operations is prohibited.
- Introducing direct backend action paths from studio/runtime UX that bypass authoritative API or run application seams is prohibited.

## Review checklist

1. Do contract/schema changes stay centralized in shared run transport modules?
2. Are scheduler policy changes implemented in application orchestration seams rather than persistence/transport layers?
3. Does queue claim/lease behavior remain conflict-safe and TTL-backed?
4. Does dispatch remain command-driven with adapter translation isolated in infrastructure?
5. Are dispatch outcomes and execution updates still progressing lifecycle through authoritative use cases?
6. Are terminal completion/failure/cancellation paths still finalizing queue + assignment state and preserving diagnostics split?
7. Are `.md` and `.ai.md` docs updated together for orchestration changes?
8. Are relevant tests updated across application, infrastructure, transport, and persistence seams?
9. Does regression coverage still pass for integrated lifecycle hardening in `src/application/runs/tests/RunOrchestrationLifecycleRegression.integration.test.ts`?
10. Does node-aware dispatch assignment coverage still pass in `src/application/runs/tests/ProcessQueuedRunDispatchUseCase.integration.test.ts` (eligible selection, no-eligible failures, degraded fallback, and durable assignment metadata)?
11. For scheduling hardening changes, do tests also cover duplicate-intent suppression, no-placement defer metadata, and scheduling-admin schema validation?

## Current deferred scheduling edges

- Assignment evaluation still returns at most one assignment recommendation per pass.
- Quota and reservation-window policy enforcement remain deferred to future scheduling policy layers.
- Rich resource arbitration and deployment-profile governance variants remain deferred beyond current role-priority + hybrid-local protections.
