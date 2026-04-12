# Run Orchestration Scheduling Visibility Projections

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.3: Deliver Scheduling Visibility, Admin Controls, and Production Hardening
- Story 17.3.1: Implement scheduling visibility projections for operational and admin surfaces

## Purpose

Provide authoritative scheduling read projections for queue/list/detail/status surfaces so operational and administrative UIs can understand effective scheduling priority context, defer/backoff rationale, candidate constraints, and placement outcomes without reading raw logs.

## Canonical implementation map

- Shared transport contracts and schemas:
  - `src/shared/contracts/runtime/RunOrchestrationTransportContracts.ts`
  - `src/shared/schemas/runtime/RunOrchestrationTransportSchemaContracts.ts`
- Scheduling projection helpers:
  - `src/application/runs/use-cases/RunSchedulingVisibilityProjection.ts`
- Queue/list/detail/status query integration:
  - `src/application/runs/use-cases/ListAuthoritativeRunQueueStatusUseCase.ts`
  - `src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts`

## Projection shape

Run list/detail/status/queue items now expose an optional `scheduling` projection with:

- canonical shared type: `RunSchedulingVisibilityProjection`

- `effectivePriority` (when authoritative score context exists):
  - role-priority band
  - role-priority score
  - queue age seconds
  - projection timestamp (`asOf`)
- `candidateConstraints`:
  - required capabilities
  - remote-scheduling requirement
- `defer`:
  - eligibility marker (`ready` / `deferred` / `blocked`)
  - defer count and next-eligible timestamp
  - safe reason codes/message and decision identity metadata
- `placement`:
  - placement outcome (`assignment-recommended` / `deferred` / `no-placement` / `not-applicable`)
  - selected/dispatch node context where available
  - safe reason codes/message and decision identity metadata
- `admin` (admin audience only):
  - requires-administrative-attention signal
  - no-placement category
  - bounded decision/exclusion reason-code sets

Queue responses may include `schedulingAdminSummary` for admin audiences:

- queue-level deferred and admin-attention counts
- bounded aggregated reason-code counters for:
  - queue no-placement/defer reasons
  - decision reason codes
  - exclusion reason codes

## Access-control and safety posture

- Scheduling admin diagnostics are gated by `run.manage` visibility and stripped for non-admin audiences.
- General operational projections expose safe subsets only (codes, bounded messages, counters).
- Raw candidate debug payloads and internal details remain outside user-facing projections.
- Queue-level admin summaries are emitted only when admin-eligible queue rows are visible.

## Invariants

- Scheduling visibility projections are derived from authoritative queue/run/audit state only.
- Projection helpers must not mutate canonical lifecycle state.
- Shared response shapes remain contract-backed in shared transport contracts/schemas.
- Admin-only scheduling diagnostics must not be returned for non-admin read audiences.

## Validation coverage

- `src/application/runs/tests/RunSchedulingVisibilityProjection.test.ts`
- `src/application/runs/tests/ListAuthoritativeRunQueueStatusUseCase.test.ts`
- `src/infrastructure/api/runs/tests/AuthoritativeRunQueryBackendApi.test.ts`
- `src/shared/schemas/runtime/tests/RunOrchestrationTransportSchemaContracts.test.ts`
