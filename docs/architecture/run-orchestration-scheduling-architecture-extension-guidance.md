# Scheduling Architecture Baseline and Extension Rules

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.8: Document the initial scheduling architecture and extension rules for future policy growth

## Purpose

Document the production scheduling architecture as implemented today, make current rule behavior and limits explicit, and provide a safe extension workflow for upcoming quota, reservation, affinity, deployment-profile, and resource-arbitration policy layers.

## Canonical implementation files

- Domain scheduling policy model and invariants
  - `src/domain/scheduling/SchedulingDomain.ts`
- Scheduling decision-pipeline boundary contracts
  - `src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts`
- Scheduling policy rule contracts and ordered rule-pipeline implementation
  - `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts`
  - `src/application/scheduling/ports/SchedulingPolicyProfilePorts.ts`
  - `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- Authoritative policy evaluation and arbitration orchestration
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
  - `src/application/scheduling/use-cases/RolePrioritySchedulingArbitration.ts`
  - `src/application/scheduling/use-cases/SchedulingPlacementAffinityPreference.ts`
- Decision outcome capture seam
  - `src/application/scheduling/ports/SchedulingDecisionOutcomeCapturePorts.ts`
  - `src/application/scheduling/use-cases/SchedulingDecisionOutcomeCapture.ts`
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- Shared scheduling transport/admin contracts and schemas
  - `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- Queue claim + assignment + dispatch control-plane seams (kept separate from scheduling policy)
  - `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
  - `src/application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase.ts`
  - `src/application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase.ts`
  - `src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts`

## Production architecture flow

1. `IAuthoritativeSchedulingInputAssembler` builds `SchedulingEvaluationSnapshot` from queue leases, run policy inputs, node policy inputs, reservation ownership, and optional deployment-profile context.
2. `EvaluateAuthoritativeSchedulingPolicyUseCase` evaluates every run/node pair through `SchedulingPolicyRulePipeline`.
3. Eligible candidates are optionally narrowed by `applyBasicPlacementAffinityPreference`.
4. `selectRolePrioritySchedulingCandidate` applies deterministic tie-break arbitration and may emit a single assignment recommendation.
5. A `SchedulingDecisionBundle` is produced for orchestration and diagnostics consumers.
6. `EvaluateAuthoritativeSchedulingDecisionPipelineUseCase` optionally records decision outcomes through `ISchedulingDecisionOutcomeRecorder`.
7. Assignment claim materialization and dispatch execution happen in run-orchestration control-plane use cases, not in scheduling policy modules.

### Boundary diagram

```text
Queue + run + node policy inputs
  -> IAuthoritativeSchedulingInputAssembler
  -> EvaluateAuthoritativeSchedulingPolicyUseCase
       -> SchedulingPolicyRulePipeline (ordered rules)
       -> SchedulingPlacementAffinityPreference
       -> RolePrioritySchedulingArbitration
  -> SchedulingDecisionBundle (+ reasons, summaries, intents)
  -> IAuthoritativeSchedulingAssignmentGateway (claim materialization)
  -> IAuthoritativeDispatchExecutionGateway (backend dispatch)
```

## Current production rules (explicit)

Rule order is authoritative and emitted in decision reasons (`rule-pipeline-evaluated`):

1. `NodeSchedulableSchedulingPolicyRule`
2. `NodeRequiredCapabilitiesSchedulingPolicyRule`
3. `RemoteSchedulingSupportPolicyRule`
4. `HybridNodeLocalUseProtectionPolicyRule`
5. `ReservationOwnershipPolicyRule`

After eligibility gating:

1. `applyBasicPlacementAffinityPreference` applies basic preferred node/node-type/deployment-profile filtering when matches exist.
2. `selectRolePrioritySchedulingCandidate` selects one winner by:
   - `rolePriorityScore` (desc)
   - `queueAgeSeconds` (desc)
   - `runId` (asc lexical)
   - `nodeId` (asc lexical)

## Current production limits (explicit)

- Scheduler recommends at most one assignment intent per evaluation pass.
- Quotas are not enforced yet (`future-quota-policy` is source taxonomy only).
- Reservation time windows/calendars are not implemented; only ownership conflict checks are enforced.
- Affinity behavior is basic preference filtering, not weighted multi-objective scoring.
- Deployment-profile behavior is limited to snapshot metadata and optional affinity matching.
- Deployment-profile context/rule wiring seams are present, but classroom/organization policy variants are not implemented yet.
- Rich resource arbitration (GPU/CPU/memory pressure, cost, fairness balancing) is not implemented.
- Scheduling outcomes are explainable and source-traceable but are not by themselves dispatch mutations.

## Extension rules for future policy layers

### Quotas and reservation windows

1. Extend scheduling domain vocabulary in `SchedulingDomain.ts` when adding new canonical policy inputs or reason codes.
2. Add new ordered `ISchedulingPolicyRule` implementations and compose them in `SchedulingPolicyRulePipeline` construction.
3. Add/extend snapshot assembly inputs behind `IAuthoritativeSchedulingInputAssembler`; do not fetch policy directly in transport handlers.
4. Update shared scheduling contracts/schemas when new policy evidence must be visible to admin/diagnostic consumers.

### Deployment-profile and affinity policy growth

1. Keep deployment-profile policy logic in scheduling domain/application seams, not infrastructure dispatch adapters.
2. Extend `SchedulingPlacementAffinityPreference` only for preference semantics; keep hard eligibility denials in rule modules.
3. If scoring expands beyond role-priority/queue-age, implement a new `ISchedulingCandidateScorePolicy`.

### Rich resource arbitration

1. Preserve deterministic fallback ordering even when introducing richer scoring dimensions.
2. Keep arbitration logic centralized in `RolePrioritySchedulingArbitration.ts` (or an explicit successor arbitration module).
3. Emit explicit decision reasons when arbitration behavior changes.

## Non-negotiable invariants

- Scheduling chooses which run/node claim should be attempted; it does not execute backend dispatch.
- Dispatch adapters do backend translation/execution only; they do not evaluate scheduling policy.
- Policy decisions must remain explainable through reason-bearing candidate outcomes and decision-level reasons.
- Shared scheduling contracts remain the only transport-safe schema boundary for scheduling evaluation payloads.

## Prohibited shortcuts

- Embedding scheduling policy rules in UI components, UI stores, or studio adapters is prohibited.
- Embedding scheduling policy rules in HTTP/IPC/WebSocket handlers is prohibited.
- Embedding scheduling policy rules in persistence repositories/query adapters is prohibited.
- Embedding scheduling policy rules in backend dispatch adapters is prohibited.
- Writing dispatch attempts directly from scheduling policy modules is prohibited.

## Verification baseline

- Scheduling policy behavior tests:
  - `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
  - `src/application/scheduling/tests/RolePrioritySchedulingArbitration.test.ts`
  - `src/application/scheduling/tests/SchedulingPlacementAffinityPreference.test.ts`
  - `src/domain/scheduling/tests/SchedulingDomain.test.ts`
- Scheduling decision-pipeline and outcome-capture tests:
  - `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`
  - `src/application/scheduling/tests/SchedulingDecisionOutcomeCapture.test.ts`
- Shared contract/schema tests:
  - `src/shared/contracts/runtime/tests/SchedulingPolicyEvaluationContracts.test.ts`
  - `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`
- Documentation discoverability and guardrail assertions:
  - `src/application/runs/tests/SchedulingArchitectureExtensionGuidanceDocumentation.test.ts`
