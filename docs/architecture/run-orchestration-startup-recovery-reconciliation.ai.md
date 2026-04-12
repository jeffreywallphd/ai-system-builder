# AI Companion: Run Orchestration Startup Recovery and Reconciliation

## Story scope
Story 16.3.6 adds authoritative startup recovery for stale/interrupted orchestration states so restarts do not leave common partial states ambiguous.
Story 17.3.5 extends this seam to scheduler reservation/defer recovery so restart-time scheduling state is not left in ambiguous intermediary form.

## Canonical doc
- `docs/architecture/run-orchestration-startup-recovery-reconciliation.md`

## Implemented seams
- Recovery use case:
  - `src/application/runs/use-cases/RecoverRunOrchestrationStartupStateUseCase.ts`
- Queue guarded requeue seam:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- Placement-hold expiry cleanup seam:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- Startup host integration:
  - `src/hosts/server/IdentityServerHost.ts`
- Recovery tests:
  - `src/application/runs/tests/RecoverRunOrchestrationStartupStateUseCase.test.ts`
  - `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Automatic recovery summary
- Releases expired queue claims that would block reassignment.
- Releases expired node placement holds left behind by interrupted materialization cycles.
- Releases lingering deferred-entry reservation claims to reconcile interrupted no-placement defer transitions.
- Requeues stale assigned runs when guarded queue requeue is supported.
- Reconciles interrupted dispatching state from persisted dispatch-attempt results.
- Fails stale dispatching/running runs after bounded timeout thresholds.
- Emits explicit audit events for every startup recovery decision.

## Guardrails
- Recovery remains lifecycle-domain constrained and does not bypass canonical transition rules.
- Recovery does not silently mutate history; each action is auditable.
- Deferred records with assignment/dequeue intermediary residue are flagged for manual follow-up instead of speculative rewrite.
- Unsupported ambiguity is surfaced as explicit manual-follow-up events, not silent no-ops.
