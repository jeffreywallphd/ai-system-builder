# Run Orchestration Authoritative Node Claim and Dispatch Preparation

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.3: Build authoritative node-claim and dispatch preparation workflows

## Purpose

Provide one authoritative workflow that converts a reserved queued run into a node assignment and a durable dispatch-preparation record, while preventing duplicate node claims under concurrent orchestrator activity.

## Implemented files

- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
- `src/application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase.ts`
- `src/application/runs/use-cases/RunCreationPersistenceMapper.ts`
- `src/application/runs/tests/ClaimRunForNodeDispatchPreparationUseCase.test.ts`
- `src/application/runs/tests/AuthoritativeRunCreationUseCase.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter.ts`
- `src/infrastructure/persistence/platform/SqlitePlatformPersistenceMigrations.ts`
- `src/infrastructure/persistence/platform/tests/SqlitePlatformPersistenceAdapter.test.ts`

## Authoritative claim workflow

`ClaimRunForNodeDispatchPreparationUseCase` is the authoritative application-layer claim path for one run:

1. Load the run record and canonical state.
2. Validate claim eligibility from canonical lifecycle (`queued` or `assignment-pending`).
3. Transition canonical state to `assigned` with:
   - assignment status `assigned`
   - `assignedNodeId` and `assignedAt`
   - queue `dequeuedAt` stamped at claim time
4. Persist queue node-claim fields and durable dispatch-attempt metadata through queue persistence.
5. Persist the authoritative run record update with optimistic revision expectations.
6. Return a transport-agnostic dispatch-preparation payload for downstream execution adapters.

The claim workflow is wrapped in a transaction boundary when a transaction manager is provided.

## Durable assignment and dispatch-preparation state

Queue persistence now stores assignment and preparation fields:

- `assignment_node_id`
- `assignment_claimed_at`
- `dispatch_prepared_at`
- `last_dispatch_attempt_id`

Dispatch preparation attempts are durable in `platform_run_dispatch_attempts`:

- attempt identity (`attempt_id`)
- run/node/queue linkage
- reservation ownership + claim token
- preparation timestamp
- serialized transport-agnostic dispatch metadata

This makes assignment state and dispatch preparation queryable without coupling to runtime transport adapters.

## Conflict semantics and duplicate-claim protection

The node claim path returns explicit conflict outcomes:

- `not-found`
- `already-assigned`
- `queue-state-conflict`
- `reservation-conflict`

Duplicate concurrent claim attempts are prevented by conditional queue updates requiring:

- matching `run_id`
- matching `claim_token` and `claimed_by`
- unexpired reservation
- no existing `assignment_node_id`
- queue lifecycle still claimable

When these preconditions fail, the workflow returns a controlled conflict instead of silently double-assigning.

## Separation from transport-specific execution

This story persists dispatch-preparation metadata only. It does not call backend/runtime execution adapters.

Transport dispatch remains a later concern that consumes prepared attempts and authoritative assignment state, preserving control-plane ownership boundaries.

## Test coverage highlights

- Application tests:
  - successful queued-run claim to node with assignment + dispatch preparation returned
  - duplicate claim attempts surfaced as controlled `already-assigned` conflicts
- Persistence tests:
  - schema version/migration coverage for dispatch attempt storage
  - node-claim once semantics with explicit duplicate conflict outcomes
  - durable dispatch-attempt query behavior
