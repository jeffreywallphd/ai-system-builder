# Scheduling Policy Domain Model and Decision Boundaries

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.1: Define the canonical scheduling domain model and decision boundaries

## Purpose

Define the canonical scheduling concepts for authoritative run placement while keeping queue leasing, assignment claiming, and dispatch execution as separate layers.

This story introduces an explicit scheduling domain language and an application-layer decision-pipeline boundary so future policy work (quotas, reservations, affinity, deployment-profile policy, richer arbitration) can be added without mixing policy logic into UI, transport, persistence adapters, or backend dispatch adapters.

## Canonical implementation map

- Domain scheduling model
  - `src/domain/scheduling/SchedulingDomain.ts`
- Application scheduling decision-pipeline contracts
  - `src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts`
- Existing queue/assignment/dispatch execution seams that remain separate from policy evaluation
  - `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
  - `src/application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase.ts`
  - `src/application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase.ts`
  - `src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts`
  - `src/application/runs/ports/RunOrchestrationPersistencePorts.ts`
  - `src/application/runs/ports/RunExecutionDispatchPorts.ts`

## Canonical scheduling domain vocabulary

1. `SchedulingRunPolicyInput`
- Authoritative run input used by scheduling policy.
- Carries scheduling-relevant run context only: run identity, workspace/user context, derived run requirements, and queue lease identity.

2. `SchedulingRunPriorityBand`
- Canonical run-priority model used by role-priority policy.
- Current baseline bands: `critical`, `high`, `normal`, `low`.
- Baseline role priority mapping:
  - `owner` -> `critical`
  - `admin` -> `high`
  - `member` -> `normal`
  - `viewer` -> `low`

3. `SchedulingNodePolicyInput`
- Authoritative node scheduling input.
- Includes node type, schedulability, remote scheduling capability, enabled capabilities, current usage mode, local interactive ownership, and optional reservation ownership.

4. `SchedulingNodeUsageMode`
- Canonical node usage posture for arbitration:
  - `idle`
  - `remote-queued-work`
  - `interactive-local-session`
  - `maintenance`

5. `SchedulingCandidateDecision`
- Explainable run/node candidate evaluation result.
- Contains eligibility decision, denial reasons, and scorecard (`priorityBand`, role score, queue age).

6. `SchedulingPolicyDecision`
- Authoritative policy output for one evaluation pass.
- Includes:
  - deterministic decision identity/time
  - outcome (`assignment-recommended` | `deferred` | `denied`)
  - optional selected run/node/claim pair
  - full evaluated candidate set
  - policy source traceability
  - explainable reasons

## Policy sources and authoritative input boundaries

Policy decisions are assembled from explicit authoritative sources:

- Run source: run metadata and derived requirements (`submissionSnapshot`, canonical queue lease fields).
- Node source: node trust + capability inventory + operational usage posture.
- Workspace source: role membership context for role-priority.
- Deployment source: deployment profile identifiers and environment policy hooks.
- Reservation source: active queue lease ownership and node reservation ownership.
- Future source placeholders: quota policy, reservation calendars, placement affinity.

`SchedulingPolicySourceKinds` is the canonical traceability enum for these inputs.

## Role-priority baseline policy

`deriveSchedulingRunPriorityBand` establishes baseline role-priority behavior:

- Takes workspace role membership as the source of priority posture.
- Uses highest-precedence role across assigned roles.
- Defaults to `normal` when no known role mapping exists.

This behavior is intentionally isolated so future deployment-profile overrides and quota-aware priority shaping can evolve in domain/application policy seams.

## Hybrid node local-use protection baseline

`evaluateHybridNodeLocalInteractiveProtection` establishes the first hybrid arbitration guardrail:

- Applies only to `hybrid` nodes in `interactive-local-session` mode.
- Denies remote assignment by default while an interactive local session is active.
- Allows same-user reuse when the queued run actor matches local interactive owner identity.

This is an authoritative policy denial reason (`hybrid-local-interactive-protection`), not an adapter heuristic.

## Candidate evaluation baseline

`evaluateSchedulingCandidate` composes baseline candidate checks:

- node schedulability gate
- required capability gate
- remote scheduling support gate
- hybrid local-use protection gate
- reservation owner conflict gate

The output is always explainable and score-bearing, even when denied.

## Decision-pipeline boundary (application layer)

`src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts` defines the authoritative boundary between policy evaluation and execution orchestration.

- `IAuthoritativeSchedulingInputAssembler`
  - assembles policy inputs from queue leases, runs, nodes, workspace context, and deployment context.
- `IAuthoritativeSchedulingPolicyEvaluator`
  - performs policy evaluation and produces explainable decisions + assignment intents.
- `IAuthoritativeSchedulingDecisionPipeline`
  - orchestrates one evaluation pass for next assignments.
- `IAuthoritativeSchedulingAssignmentGateway`
  - hands selected intents into claim/assignment preparation seams.
- `IAuthoritativeDispatchExecutionGateway`
  - executes dispatch only after assignment intent has been materialized.

## Non-negotiable boundary between scheduling and execution dispatch

Scheduling owns:
- policy evaluation, prioritization, and candidate arbitration
- explainable decision outcomes
- selected assignment intents

Execution dispatch owns:
- claim materialization and run-state mutation for assigned runs
- canonical execution command building
- backend dispatch adapter translation and dispatch result handling

Scheduling does **not** write dispatch attempts directly.
Dispatch adapters do **not** evaluate scheduling policy.

## Where future policy rules belong

Add new policy rules in one of these seams:

1. Domain policy model/helpers
- `src/domain/scheduling/SchedulingDomain.ts`

2. Application scheduling policy orchestration
- `src/application/scheduling/*`

3. Policy input assembly adapters (still application-level, not transport/UI)
- implementations behind `IAuthoritativeSchedulingInputAssembler`

Do not add policy rules in:
- UI state/services/components
- HTTP/IPC/WebSocket route handlers
- persistence repository SQL/query adapters
- dispatch backend adapters

## Verification baseline

- Domain scheduling model tests
  - `src/domain/scheduling/tests/SchedulingDomain.test.ts`
- Documentation discoverability and boundary assertions
  - `src/application/runs/tests/SchedulingPolicyArchitectureDocumentation.test.ts`
