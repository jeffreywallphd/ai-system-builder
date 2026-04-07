# Run Orchestration Domain Foundation

## Scope
Story 16.1.1 defines the canonical run domain model for authoritative submission and orchestration in AI Loom. This is a domain-and-boundary foundation slice; it does not add queue workers, scheduler infrastructure, or UI workflow changes.

Implemented core domain file:
- `src/domain/runs/RunDomain.ts`

Implemented test coverage:
- `src/domain/runs/tests/RunDomain.test.ts`

## Canonical run concepts

### Identity and submission
A run is identified by:
- `runId`
- `workflowId`
- optional `workspaceId`

Submission captures authoritative origin metadata:
- `source`: `ui-manual`, `ui-rerun`, `api`, `schedule-trigger`, `event-trigger`, `internal-orchestrator`
- `submittedAt`
- optional actor/request correlation (`submittedByActorId`, `clientRequestId`, `correlationId`)

### Lifecycle state
Canonical lifecycle states:
- `submitted`
- `queued`
- `assignment-pending`
- `assigned`
- `dispatching`
- `running`
- `cancelling`
- `retry-pending`
- `completed`
- `failed`
- `cancelled`

Allowed transitions are explicit in `RunLifecycleTransitions` and enforced by:
- `isRunLifecycleTransitionAllowed(...)`
- `transitionCanonicalRunRecord(...)`

### Queue position semantics
Queue state uses one bounded model:
- `queueId`
- `enteredAt`
- `position` (`number | null`, where `null` means queued but exact position is undisclosed)
- `positionAsOf`
- optional `dequeuedAt`

Invariants:
- `queued` and `assignment-pending` require queue state and must not include `dequeuedAt`.
- Non-queue-owned states can include queue history only if `dequeuedAt` exists.
- Position must be positive when present.

### Assignment state
Assignment status is separate from lifecycle state:
- `unassigned`
- `pending`
- `assigned`
- `released`

Invariants enforce required node/timestamp fields per status and state coherence:
- `assignment-pending` requires assignment status `pending`.
- `assigned`, `dispatching`, and `running` require assignment status `assigned`.

### Execution outcomes
Execution outcome is explicit and normalized:
- `none`
- `succeeded`
- `failed`
- `cancelled`

Invariants:
- Terminal lifecycle states require matching outcomes:
  - `completed` -> `succeeded`
  - `failed` -> `failed`
  - `cancelled` -> `cancelled`
- Non-terminal states require `none`.
- Failed outcomes require `errorMessage`.

### Cancellation and retry
Cancellation has explicit request/acknowledgement metadata:
- `requestedAt`
- optional `requestedByActorId`, `reason`, `acknowledgedAt`

Cancellation is only valid in lifecycle states:
- `cancelling`
- `cancelled`

Retry has explicit budget state:
- `attempt`
- `maxAttempts`
- optional `previousRunId`, `retryReason`, `queuedAt`

Retry invariants:
- `attempt <= maxAttempts`
- `queuedAt` only valid in `retry-pending`
- `retry-pending` requires remaining budget (`attempt < maxAttempts`)

## Authoritative orchestration boundary

### Domain layer (`src/domain/runs`)
Owns:
- canonical run vocabulary and invariants
- legal lifecycle transitions
- queue/assignment/execution/cancel/retry state coherence

Must not own:
- scheduling policy selection
- node scoring or lease acquisition
- transport calls to execution runtimes
- persistence I/O

### Application layer (future orchestration services/use cases)
Owns:
- submission validation orchestration and idempotency checks
- queue admission/dequeue sequencing and assignment decisions
- dispatch intent creation and lifecycle command sequencing
- calling domain transition helpers before persistence commits

Must depend on ports for:
- durable run repositories
- queue coordination primitives
- execution adapter invocation
- authorization/audit services

### Infrastructure layer
Owns:
- adapter-specific execution submission/poll/cancel mechanics
- queue backend implementations
- persistence schema/repository adapters
- runtime transport and retry/circuit behavior for external systems

Must not redefine:
- run lifecycle truth
- transition legality
- queue/assignment state semantics

### UI layer
Owns:
- read-model projections and operator interactions
- command intent emission (submit/cancel/retry)
- status visualization

Must not own:
- lifecycle mutation rules
- queue/assignment truth derivation
- adapter-specific runtime orchestration logic

## Relationship to existing execution/run history slices
This foundation does not replace current execution history or workflow run detail slices. It introduces a canonical run orchestration model that future stories can map to:
- execution-run records (`src/domain/execution/ExecutionRun.ts`)
- workflow run history records (`src/domain/workflow-studio/WorkflowRunHistoryDomain.ts`)

The canonical run model is the authoritative lifecycle and orchestration-state contract; projection and history models remain valid consumer-oriented views.
