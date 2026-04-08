# Run Orchestration Authoritative Cancellation Workflow and State Matrix

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.3: Implement Operational Control, Recovery Behavior, and Cross-Surface Orchestration Visibility
- Story 16.3.1: Implement authoritative run cancellation workflows and state handling

## Purpose

Define the production cancellation control flow for authoritative runs, including permission-gated request handling, lifecycle progression by current state, queue/claim coordination, backend cancellation signaling seams, and explicit cancellation audit/query behavior.

## Canonical implementation map

- Domain lifecycle legality and cancellation invariants:
  - `src/domain/runs/RunDomain.ts`
- Cancellation signaling port (application seam):
  - `src/application/runs/ports/RunExecutionCancellationPorts.ts`
- Cancellation authorization port (application seam):
  - `src/application/runs/ports/RunMutationAuthorizationPorts.ts`
- Authoritative cancellation orchestration use case:
  - `src/application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase.ts`
- Backend API permission + mutation orchestration:
  - `src/infrastructure/api/runs/AuthoritativeRunMutationBackendApi.ts`
- Identity HTTP transport cancellation endpoint mapping:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- Host composition wiring:
  - `src/hosts/server/IdentityServerHost.ts`

## Authoritative cancellation workflow

1. Authenticated actor calls `POST /api/v1/runtime/runs/:runId/cancel` with workspace context.
2. Transport layer validates payload shape and actor spoofing constraints.
3. Backend API evaluates `run.cancel` authorization for `resourceType=authoritative-run`.
4. Application cancellation use case re-validates cancellation authorization through mutation-authorization ports before lifecycle mutation.
5. Queue claim coordination clears active reservation claims where present.
6. Backend signaling is attempted only through `IRunExecutionCancellationSignalPort` when state/backends can support signaling.
7. Run mutation response returns canonical run detail/status projections with explicit mutation-change semantics.
8. Cancellation intent/result events are appended as run audit events.

## Cancellation state matrix

| Current lifecycle state | Cancellation behavior | Target lifecycle state | Notes |
| --- | --- | --- | --- |
| `submitted` | immediate cancellation | `cancelled` | no queue claim expected |
| `queued` | immediate cancellation | `cancelled` | queue dequeue timestamp set |
| `assignment-pending` | immediate cancellation | `cancelled` | pending candidate cleared |
| `assigned` | immediate cancellation | `cancelled` | transition through `cancelling`, assignment released |
| `dispatching` | cancellation-requested | `cancelling` | cancellation signal attempted when backend identity exists |
| `running` | cancellation-requested | `cancelling` | cancellation signal attempted when backend identity exists |
| `cancelling` | idempotent no-op | `cancelling` | explicit `changed=false` mutation |
| `completed` | no-op (already finalized) | `completed` | explicit `changed=false` mutation |
| `failed` | no-op (already finalized) | `failed` | explicit `changed=false` mutation |
| `cancelled` | no-op (already finalized) | `cancelled` | explicit `changed=false` mutation |

## Queue-aware coordination rules

- If an active queue claim exists (`claimToken`), cancellation releases claim ownership immediately.
- Immediate terminal cancellations finalize queue entry with lifecycle `cancelled`.
- Non-terminal cancellation requests (`cancelling`) preserve authoritative lifecycle truth while making claim-release explicit.

## Backend signaling decoupling rules

- Cancellation signaling must only happen through `IRunExecutionCancellationSignalPort`.
- Application logic must not call backend-specific clients directly.
- If signaling is unavailable for the current backend context, response remains explicit (`not-supported`) and lifecycle remains authoritative (`cancelling` when execution is already in-flight).

## Best-effort and degraded cancellation semantics

- Cancellation for `running`/`dispatching` states is best-effort by design; backend signal acceptance is not guaranteed.
- Use-case responses normalize degraded signal outcomes (`not-supported`, `rejected`, `failed`) without fabricating terminal cancellation.
- When signaling degrades, lifecycle remains `cancelling` until authoritative execution updates finalize to `cancelled` or another terminal state.
- Authorization denials are explicit and audited as rejected cancellation intents; no lifecycle mutation is persisted for denied requests.

## Audit and query visibility

- Cancellation requests are audited with action `run.cancellation.requested`.
- Audit payload includes from-state, to-state, explicit cancellation outcome, and signal outcome details.
- Run detail/status query surfaces include canonical cancellation state (`requestedAt`, actor, optional `acknowledgedAt`).
- Run metadata stores orchestration cancellation telemetry (`metadata.orchestration.cancellation`) for operational troubleshooting.

## Prohibited shortcuts

- Writing cancellation lifecycle state directly from transport handlers is prohibited.
- Calling backend cancellation clients directly from API handlers is prohibited.
- Treating cancellation as implicit by dropping claims or mutating status without canonical run transitions is prohibited.
- Returning ambiguous success for terminal no-op cancellations without explicit `changed=false` semantics is prohibited.

## Verification baseline

- Cancellation state-matrix coverage:
  - `src/application/runs/tests/RequestAuthoritativeRunCancellationUseCase.test.ts`
- Backend cancellation API contract behavior:
  - `src/infrastructure/api/runs/tests/AuthoritativeRunMutationBackendApi.test.ts`
- Identity HTTP cancellation route behavior:
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunCancellationApi.test.ts`
