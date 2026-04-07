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
- `docs/architecture/run-orchestration-scheduling-architecture-extension-guidance.md`
- `docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`
- `docs/architecture/run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md`
- `docs/architecture/run-orchestration-scheduling-deterministic-candidate-arbitration.md`
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
4. Apply persistence, dispatch-adapter, and API transport changes only after application behavior is finalized:
   - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
   - `src/infrastructure/execution/runs/*`
   - `src/infrastructure/api/runs/*`
   - `src/infrastructure/api/runs/RunOrchestrationObservability.ts`
   - `src/infrastructure/api/runs/RunOrchestrationObservabilityRedaction.ts`
   - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
5. Keep host composition updated for required route family and backend registration coverage:
   - `src/hosts/server/IdentityServerHost.ts`

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

## Extending backend dispatch integrations

1. Keep dispatch command creation in `BuildAssignedRunExecutionCommandUseCase`.
2. Add backend-specific translation as `IRunExecutionBackendAdapter` implementations in infrastructure.
3. Register new adapters only through `RunExecutionDispatchRouter`.
4. Route all dispatch outcomes through `HandleRunDispatchResultUseCase` so state progression and attempt-result persistence stay authoritative.

## Extending progress ingestion and finalization

1. Keep node lifecycle/progress updates inside `IngestRunExecutionUpdateUseCase`.
2. Preserve sender-node and backend identity consistency checks.
3. Keep internal diagnostics in metadata telemetry, not run read projections.
4. Keep completion/failure finalization in `FinalizeRunExecutionOutcomeUseCase`, including queue finalization and assignment release.

## Extending cancellation orchestration

1. Keep cancellation transition logic in `RequestAuthoritativeRunCancellationUseCase`.
2. Add backend cancellation signaling only through `IRunExecutionCancellationSignalPort` implementations.
3. Preserve explicit cancellation outcomes by lifecycle position (immediate terminal, cancellation-requested, or terminal no-op).
4. Keep cancellation queue/claim coordination in application use cases; do not release claims directly from route handlers.
5. Keep cancellation telemetry split: canonical run cancellation state for user-safe visibility, audit + metadata for operator diagnostics.

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
- Completion/failure terminal handling must preserve user-safe outputs and internal diagnostics separation.
- Observability/redaction concerns must stay in dedicated infrastructure seams, not in domain transition logic.

## Prohibited patterns

- Bypassing reservation claim semantics (`claimAssignmentReadyRuns`) is prohibited.
- Bypassing `ClaimRunForNodeDispatchPreparationUseCase` for assignment writes is prohibited.
- Performing dispatch directly from route handlers without canonical command building is prohibited.
- Mutating canonical run lifecycle directly from infrastructure adapters is prohibited.
- Embedding scheduling policy logic in UI components/state, transport handlers, persistence adapters, or backend dispatch adapters is prohibited.
- Bypassing `IngestRunExecutionUpdateUseCase` for execution progress/heartbeat/lifecycle mutation is prohibited.
- Persisting internal diagnostics directly into user-facing run contracts is prohibited.
- Creating retried runs by bypassing authoritative validation + creation use cases is prohibited.
- Logging raw prompts, secrets/tokens, backend payload blobs, or raw path-bearing fields from run orchestration operations is prohibited.

## Review checklist

1. Do contract/schema changes stay centralized in shared run transport modules?
2. Are scheduler policy changes implemented in application orchestration seams rather than persistence/transport layers?
3. Does queue claim/lease behavior remain conflict-safe and TTL-backed?
4. Does dispatch remain command-driven with adapter translation isolated in infrastructure?
5. Are dispatch outcomes and execution updates still progressing lifecycle through authoritative use cases?
6. Are terminal completion/failure paths still finalizing queue + assignment state and preserving diagnostics split?
7. Are `.md` and `.ai.md` docs updated together for orchestration changes?
8. Are relevant tests updated across application, infrastructure, transport, and persistence seams?
9. Does regression coverage still pass for integrated lifecycle hardening in `src/application/runs/tests/RunOrchestrationLifecycleRegression.integration.test.ts`?
