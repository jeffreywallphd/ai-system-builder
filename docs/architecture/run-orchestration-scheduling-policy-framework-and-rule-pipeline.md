# Scheduling Policy Framework and Rule-Pipeline Evaluation

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.3: Implement the initial scheduling policy framework with pluggable rule evaluation

## Purpose

Implement a production-ready scheduling policy framework that evaluates queued runs through explicit, ordered, and pluggable policy rules at the application layer.

This story removes the need to hard-code placement policy inside orchestration loops by introducing:

- explicit rule interfaces
- ordered policy-rule pipeline evaluation
- modular baseline production rules
- explainable decision bundle outputs for assignment and admin visibility

## Canonical implementation map

- Scheduling policy-rule ports
  - `src/application/scheduling/ports/SchedulingPolicyRulePorts.ts`
- Scheduling policy-rule pipeline and baseline modular rules
  - `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- Authoritative scheduling policy evaluator use case
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- Authoritative scheduling decision-pipeline orchestrator use case
  - `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`

## Framework structure

1. Rule contracts
- `ISchedulingPolicyRule` defines one policy rule unit with a stable `ruleId`.
- Rules evaluate against `SchedulingPolicyRuleContext` and return allow/deny semantics with reason payloads.

2. Scoring contract
- `ISchedulingCandidateScorePolicy` computes candidate scorecards independent of deny-rule evaluation.
- Baseline scoring uses role-priority and queue age.

3. Ordered rule pipeline
- `SchedulingPolicyRulePipeline` executes rules in deterministic order.
- Candidate outcomes include reason-bearing denials and scorecards.
- Rule order is surfaced in policy decision reasons for operational explainability.

4. Policy evaluator
- `EvaluateAuthoritativeSchedulingPolicyUseCase` evaluates run/node pairs through the pipeline.
- Produces canonical `SchedulingDecisionBundle` outputs.
- Preserves explainable outcome reasons (`queue-empty`, `no-eligible-candidates`, and rule-pipeline metadata).

5. Decision pipeline orchestrator
- `EvaluateAuthoritativeSchedulingDecisionPipelineUseCase` composes:
  - `IAuthoritativeSchedulingInputAssembler`
  - `IAuthoritativeSchedulingPolicyEvaluator`
- Maintains the boundary between input assembly and policy evaluation execution.

## Baseline production policy rules (modular)

- `NodeSchedulableSchedulingPolicyRule`
- `NodeRequiredCapabilitiesSchedulingPolicyRule`
- `RemoteSchedulingSupportPolicyRule`
- `HybridNodeLocalUseProtectionPolicyRule`
- `ReservationOwnershipPolicyRule`

These implement current production posture without embedding policy logic inside transport handlers, persistence repositories, or backend dispatch adapters.

## Assignment arbitration baseline

When candidates are eligible, selection is deterministic by:

1. highest role-priority score
2. longest queue age
3. lexical run ID
4. lexical node ID

This ensures stable recommendation behavior for current role-priority policy while keeping extension seams open.

## Explainability and visibility outputs

The framework emits explicit decision/evaluation artifacts through shared contracts:

- `SchedulingDecisionBundle`
- `SchedulingPolicyEvaluationResult`
- candidate-level denial reason sets
- policy-level reasons including configured rule-order metadata

These outputs are directly consumable for assignment actions and admin diagnostics.

## Extension posture for future policy

Future policy modules (quotas, reservations calendar windows, affinity, deployment-profile policy overlays, richer resource arbitration) should be added as new `ISchedulingPolicyRule` implementations and composed into the rule pipeline.

Do not place new scheduling policy logic in:

- UI components/state services
- HTTP/IPC/WebSocket handlers
- persistence query/repository adapters
- dispatch backend adapters

## Verification baseline

- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.test.ts`

## Related ADRs

- `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md`
