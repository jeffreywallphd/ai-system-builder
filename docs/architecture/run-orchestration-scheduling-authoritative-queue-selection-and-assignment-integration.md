# Scheduling Integration for Authoritative Queue Selection and Assignment

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.1: Integrate the scheduler into authoritative queue selection and assignment flow

## Purpose

Make scheduling policy decisions the authoritative path for queue processing and assignment materialization so queue claim traversal, policy evaluation, and node-assignment claim finalization execute through one explicit orchestration flow.

## Canonical implementation map

- Scheduling input assembly from claimed queue work, runs, nodes, and role context:
  - `src/application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase.ts`
- Scheduling decision pipeline and policy evaluator:
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- Assignment materialization gateway:
  - `src/application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase.ts`
- Authoritative queue scheduling orchestration entry point:
  - `src/application/runs/use-cases/ProcessAuthoritativeRunQueueSchedulingUseCase.ts`
- Existing queue claim/assignment invariants preserved through:
  - `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
  - `src/application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase.ts`

## Authoritative control flow

1. Claim assignment-ready queue leases via `SelectAssignmentReadyRunsUseCase`.
2. Assemble `SchedulingEvaluationSnapshot` using claimed leases, canonical run requirements, trusted node inventory, workspace role context, and optional node policy-state overlays.
3. Evaluate scheduling policy through `EvaluateAuthoritativeSchedulingDecisionPipelineUseCase`.
4. Materialize only scheduler-selected intents by:
   - releasing non-selected queue claims
   - finalizing selected assignment through `ClaimRunForNodeDispatchPreparationUseCase`
5. Return decision bundle plus materialized intents for downstream dispatch preparation/execution stages.

## Preserved invariants

- Queue traversal and lease claims still originate from authoritative queue repository semantics.
- Policy evaluation remains isolated from dispatch adapter execution.
- Final node assignment still requires reservation-backed claim token ownership.
- Conflict outcomes remain controlled and explicit (`already-assigned`, reservation conflict, not found).
- Non-selected queue claims are explicitly released; no hidden bypass paths remain.

## Boundary posture

- Scheduling decides *which* claimed run/node pair should be materialized.
- Assignment materialization applies authoritative claim transitions.
- Dispatch execution remains downstream and separate from scheduling decisions.

Do not collapse scheduling and backend dispatch logic into one module or transport path.

## Verification baseline

- `src/application/scheduling/tests/AssembleAuthoritativeSchedulingInputUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`

