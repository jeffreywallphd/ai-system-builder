# Run Orchestration Startup Recovery and Reconciliation

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.3: Implement Operational Control, Recovery Behavior, and Cross-Surface Orchestration Visibility
- Story 16.3.6: Harden orchestration recovery for restarts, partial failures, and stale assignments

## Purpose

Define the authoritative startup-time recovery behavior that reconciles interrupted or stale run orchestration state after server restarts without silently rewriting historical truth.

## Implemented seams

- Startup recovery orchestration:
  - `src/application/runs/use-cases/RecoverRunOrchestrationStartupStateUseCase.ts`
- Queue guarded requeue support for stale assigned claims:
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- Startup host integration:
  - `src/hosts/server/IdentityServerHost.ts`
- Recovery scenario tests:
  - `src/application/runs/tests/RecoverRunOrchestrationStartupStateUseCase.test.ts`

## Recovery goals and invariants

1. Recover only from states that are explicitly classifiable as stale or interrupted.
2. Keep lifecycle transitions inside run-domain legality (`RunDomain`) and canonical use-case seams.
3. Emit explicit recovery audit events for applied actions and manual follow-up requirements.
4. Preserve immutable historical context (no destructive rewrite of previous attempts or terminal history).
5. Prefer guarded requeue only for currently supported stale-assigned scope; use explicit failure or manual follow-up for unsupported ambiguity.

## Startup reconciliation model

At startup, authoritative recovery now:

1. Releases expired queue claims that remain unassigned/dequeued=false so assignment-ready selection is not blocked by stale lease state.
2. Requeues stale `assigned` runs that never reached dispatch preparation:
   - requires stale threshold breach,
   - requires guarded queue requeue support,
   - resets queue claim/assignment dispatch preparation fields,
   - returns canonical run lifecycle to `queued` with unassigned state.
3. Reconciles interrupted `dispatching` progression using persisted dispatch-attempt results:
   - accepted dispatch result -> transition to `running`,
   - failed-to-start dispatch result -> transition to `failed` + finalization.
4. Fails stale `dispatching` runs when dispatch timeout is exceeded and no persisted result exists.
5. Fails stale `running` runs when heartbeat timeout is exceeded.
6. Fails orphaned or inconsistent assignment states where authoritative queue/run assignment state cannot be safely resumed.

## Automatic recovery versus manual follow-up

Automatic recovery currently supports:

- stale claim release for queued/unassigned records;
- stale-assigned guarded requeue;
- interrupted dispatch-result lifecycle reconciliation;
- stale dispatching/running timeout failure transition and finalization.

Manual follow-up is explicitly required when:

- queue adapter cannot perform guarded requeue for stale assigned records;
- queue mutations conflict during recovery attempts;
- state ambiguity is detected but no safe automatic transition is available.

Manual follow-up cases are recorded as startup recovery audit events with `recoveryStatus = manual-follow-up`.

## Operational visibility and auditability

- Recovery emits `run.orchestration-recovery.startup` run audit events for each applied/manual action.
- Startup host logs aggregate recovery counts (`appliedCount`, `manualFollowUpCount`) for operator awareness.
- Failure transitions keep user-safe error fields in canonical run execution state and retain internal diagnostics under metadata telemetry paths.

## Deferred/explicitly out of scope

- No automatic replay/re-dispatch of already accepted running backend work.
- No speculative reconstruction of missing queue rows from runtime heartbeats alone.
- No bulk historical backfill for pre-existing malformed data beyond bounded startup recovery rules.

These remain administrative or future policy-scheduler extensions.
