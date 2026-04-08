# Run Orchestration Query And History Discovery

## Scope
Story 4.2.3 adds production query/list behavior for image-manipulation runs through the authoritative run model so studio history panes, runtime monitoring, and reopen flows can use durable server-side run history instead of UI-local state.

## Application-layer use cases

### Get by ID
- `GetAuthoritativeRunUseCase` remains the canonical get-by-id read use case in `src/application/runs/use-cases`.
- Reads resolve from authoritative persisted metadata and canonical run snapshots.
- Optional workspace scoping still prevents cross-workspace leakage.
- Optional run-level authorization can now be enforced directly inside the use case through a query authorization port.

### List and filter
- `ListAuthoritativeRunsUseCase` remains the canonical listing use case in `src/application/runs/use-cases`.
- Listing is authoritative and workspace-scoped first, then filtered in application logic using canonical run projections.
- Supported filters include:
  - workspace (required)
  - owner/system/status/time (`ownerUserIdentityIds`, `systemIds`, lifecycle `states`, `submittedAfter/Before`, `updatedAfter/Before`)
  - completion state (`terminal`, `non-terminal`, `succeeded`, `failed`, `cancelled`)
  - recent activity (via `updatedAfter/updatedBefore`)
  - workflow/run/source/search where already available
- Optional workspace and run authorization checks can now be enforced in the use case when a query authorization port is configured.

## DTO-ready history metadata

Query projections now include run history hints for monitoring and history views:
- normalized status (pending, active, succeeded, failed, cancelled)
- progress snapshot summary (if run telemetry includes progress)
- failure/result availability hints
- owner and system identifiers extracted from authoritative metadata snapshots

These hints are additive read-model metadata intended for history/monitoring surfaces and preserve clean-architecture boundaries by deriving from persisted run records in the application layer.

## Authorization posture
- Runtime read endpoints continue to use `run.read` policy evaluation.
- Application query use cases can now enforce read checks directly when configured with an authorization port, which keeps authorization behavior consistent for non-HTTP callers and future thin-client service compositions.
- Missing or denied authorization produces empty list responses or no-detail responses without leaking run existence details.

## History and monitoring behavior
- Run history is built from authoritative persisted metadata and canonical run state transitions.
- Query/list responses are suitable for future studio history panes, diagnostics, and continuity/reopen experiences.
- Result/failure hints are surfaced without exposing internal diagnostics by default; admin-only diagnostics remain in dedicated operational visibility projections.
