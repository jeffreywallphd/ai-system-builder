# AI Companion: Run Orchestration Domain Foundation

## Story scope
Story 16.1.1 defines the canonical run domain model and orchestration boundaries for authoritative run handling.

## Implemented files
- Domain model: `src/domain/runs/RunDomain.ts`
- Tests: `src/domain/runs/tests/RunDomain.test.ts`
- Human doc: `docs/architecture/run-orchestration-domain-foundation.md`

## Canonical run model
`CanonicalRunRecord` covers:
- identity (`runId`, `workflowId`, optional `workspaceId`)
- submission source/timestamps
- lifecycle state
- queue state + position semantics
- assignment state
- execution state + normalized outcome
- cancellation state
- retry budget state

## Lifecycle states
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

Transition authority is explicit in `RunLifecycleTransitions` and enforced by:
- `isRunLifecycleTransitionAllowed(...)`
- `transitionCanonicalRunRecord(...)`

## Important invariants
- Queue-owned states require queue metadata; dequeued history is explicit.
- Assignment status is separate from lifecycle and validated for coherence.
- Terminal lifecycle states require matching execution outcomes.
- Cancellation metadata only exists for cancelling/cancelled states.
- Retry budget is explicit and retry-pending requires remaining attempts.

## Layer boundaries
- Domain: lifecycle vocabulary + invariants + transition legality.
- Application: submission/queue/assignment/dispatch orchestration over domain + ports.
- Infrastructure: queue/persistence/runtime adapter mechanics.
- UI: read-model/status rendering and command intents.

Rule: only domain defines lifecycle truth; application/infrastructure/UI consume it.
