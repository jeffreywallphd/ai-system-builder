# Run Orchestration Domain Foundation

## Scope
Story 16.1.1 defines the canonical run domain model for authoritative submission and orchestration in AI Loom.
Story 4.1.1 extends the domain foundation with a dedicated image-manipulation run model that captures ownership, scope, logical references, lifecycle invariants, execution linkage metadata, and status history for durable orchestration.

Implemented core domain files:
- `src/domain/runs/RunDomain.ts`
- `src/domain/runs/ImageRunDomain.ts`

Implemented test coverage:
- `src/domain/runs/tests/RunDomain.test.ts`
- `src/domain/runs/tests/ImageRunDomain.test.ts`

## Canonical run concepts

### Generic authoritative orchestration model
`RunDomain` remains the cross-vertical orchestration lifecycle model consumed by run submission, queueing, assignment, dispatch, and execution update use cases.

### Image run authoritative model
`ImageRunDomain` defines a vertical-specific authoritative run record for image manipulation:
- identity: `runId`, `workspaceId`, `ownerUserId`
- composition references: `systemId`, `workflowId`, optional `workflowTemplateId`
- logical input asset bindings (`asset:*` canonical IDs)
- immutable parameter snapshot
- lifecycle status + status timestamps + status history
- execution linkage metadata (queue, dispatch, node, adapter)
- failure summary for failed/degraded/partial outcomes
- result lineage hooks through output logical asset IDs
- actor attribution (`createdBy`, `lastModifiedBy`)

This model keeps domain boundaries clean by avoiding UI state, HTTP/persistence structures, raw backend payloads, and adapter-specific command schemas.

## Image run lifecycle states
Canonical image run states:
- `draft`
- `requested`
- `validating`
- `queued`
- `dispatching`
- `running`
- `degraded`
- `partially-completed`
- `completed`
- `failed`
- `cancelled`

Allowed transitions are explicit in `ImageRunLifecycleTransitions` and enforced by:
- `isImageRunLifecycleTransitionAllowed(...)`
- `transitionImageRunRecord(...)`

## Image run lifecycle invariants

### Ownership and scope invariants
- Runs require authoritative scope (`workspaceId`) and accountable ownership (`ownerUserId`).
- Authoring actors are explicit (`createdBy`, `lastModifiedBy`).

### Logical reference invariants
- Input bindings must reference canonical logical assets (`asset:*`) with unique binding IDs.
- Composition references are system/workflow anchored (`systemId`, `workflowId`) and template-aware (`workflowTemplateId?`).

### Lifecycle and timestamp invariants
- Timestamp requirements are status-aware (`requestedAt`, `validatedAt`, `queuedAt`, `dispatchingAt`, `startedAt`, `completedAt`, `failedAt`, `cancelledAt`, `degradedAt`, `partiallyCompletedAt`).
- Status histories are chronological and must end at the current status.
- Invalid lifecycle transitions are rejected by domain transition guards.

### Execution linkage invariants
- Pre-dispatch states cannot carry adapter/dispatch linkage.
- Dispatching and execution states require dispatch linkage.
- Running/degraded/partial/completed states require adapter linkage.

### Failure and partial/degraded invariants
- `failed`, `degraded`, and `partially-completed` states require a failure summary.
- Failure timestamps and failure summary timing must be coherent.

## Authoritative orchestration boundary

### Domain layer (`src/domain/runs`)
Owns:
- canonical lifecycle vocabulary and invariants
- legal lifecycle transitions
- ownership/scope/reference constraints for authoritative run records

Must not own:
- scheduling policy selection
- node scoring or lease acquisition
- transport calls to execution runtimes
- persistence I/O

### Application layer (orchestration services/use cases)
Owns:
- submission validation and idempotency checks
- queue admission/dequeue sequencing and assignment decisions
- dispatch intent creation and lifecycle command sequencing
- invoking domain transition helpers before persistence commits

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
