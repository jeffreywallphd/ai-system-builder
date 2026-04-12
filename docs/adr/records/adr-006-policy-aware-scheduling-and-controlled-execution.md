---
title: ADR-006 Policy-Aware Scheduling and Controlled Execution
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 006
decision_status: accepted
decision_date: 2026-04-11
review_tier: heightened
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts
  - src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts
  - src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts
  - src/application/runs/use-cases/ProcessAuthoritativeRunQueueSchedulingUseCase.ts
  - src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts
  - src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts
  - src/application/runs/use-cases/RequestAuthoritativeRunRetryUseCase.ts
  - src/application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase.ts
  - src/application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase.ts
  - src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts
  - src/infrastructure/execution/runs/RunExecutionDispatchRouter.ts
---

# ADR-006: Policy-Aware Scheduling and Controlled Execution

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio will keep scheduling and execution under one authoritative, policy-aware control flow where scheduling decisions are produced by explicit rule pipelines and execution dispatch is guarded by controlled state transitions. Execution units (nodes/adapters) remain replaceable infrastructure targets, but assignment authority, retry eligibility, and policy enforcement stay centralized in application/domain orchestration. Scheduling, retries, and dispatch outcomes must remain explainable, fail-closed, and safe-by-default so operational behavior is predictable under load and partial failure.

## Context and Problem Statement

Run orchestration now spans queue selection, policy-based candidate evaluation, assignment reservation ownership, backend dispatch, and dispatch-result settlement. Without a durable architecture decision, implementation can drift toward adapter-local scheduling logic, ad hoc retry behavior, and implicit execution trust assumptions that bypass policy intent.

The platform also needs to preserve operator trust when failures occur: retry loops, reservation leaks, stale assignment ownership, or duplicate dispatch attempts can all create unsafe or expensive behavior. This ADR records the chosen governance model so future runtime, scheduling, and orchestration work extends explicit policy boundaries instead of reintroducing convenience-driven shortcuts.

## Decision Drivers

- Keep scheduling policy explicit, composable, and centrally enforced.
- Keep execution dispatch controlled by authoritative run-state transitions.
- Preserve safe operation under failure through fail-closed guards and explicit queue settlement.
- Ensure retries are policy-governed and bounded, not adapter-discretionary.
- Keep decision explainability (why scheduled, deferred, denied, retried, or finalized) durable for operations and audits.
- Maintain clear separation between policy/rule intent and backend-specific execution transport details.

## Considered Options

1. Centralized policy-aware scheduling with controlled execution gates (accepted): keeps authority, observability, and safety behavior consistent across nodes and backend adapters.
2. Adapter-local scheduling and retry decisions (rejected): reduces immediate orchestration complexity but fragments policy semantics and increases inconsistent behavior risk.
3. Best-effort dispatch-first model with weak state guards (rejected): improves short-term throughput but permits duplicate dispatch, stale reservations, and harder recovery.
4. Fully static queue ordering with minimal policy evaluation (rejected): simplifies implementation but cannot satisfy capability, reservation, trust, and deployment-profile policy constraints.

## Chosen Approach

Scheduling remains an explicit decision pipeline composed from policy rules, scoring policy, and deterministic arbitration. The authoritative orchestration path assembles current scheduling context, evaluates candidates, and captures reason-bearing outcomes before any dispatch action.

Execution remains controlled by authoritative run lifecycle and dispatch-attempt guards. Dispatch use cases must validate assignment/attempt coherence, atomically transition to dispatching where required, and reject conflicting or stale attempts. Dispatch adapters translate canonical commands to backend-specific payloads but do not own policy, retry, or queue-settlement authority.

Retry and requeue behavior is controlled by explicit orchestration rules: retryable failed starts re-enter scheduling only when retry budget and guarded conditions permit, while terminal outcomes finalize deterministically. Reservation ownership is explicitly released/reconciled to prevent stale placement holds and to preserve safe scheduling recovery behavior.

## Consequences

- Execution units: node/back-end variability is supported without duplicating policy logic in adapters.
- Retries: retry paths become predictable and bounded because retryability and budget checks are centralized.
- Policy enforcement: rule ordering and eligibility reasons are explicit and durable, improving reviewability and onboarding.
- Scheduling: deterministic arbitration and reason capture reduce repeated debate over "why this node/run decision happened."
- Safe operation: fail-closed dispatch guards and explicit reservation release reduce duplicate execution and stale-claim failure modes.
- Tradeoff: orchestration use cases carry more explicit state-management complexity than adapter-local shortcuts.
- Tradeoff: adding new policy dimensions requires extension through rule/provider seams rather than quick transport-layer patches.
- Residual risk: long-lived orchestration flows still require careful stale-state handling when runtime topology changes quickly.

## Review Expectations

- Risk Class: runtime control authority (scheduling/dispatch/retry authority and policy-enforcement boundaries).
- Required Reviewers:
  - Platform architecture owner.
  - Runtime/orchestration domain owner.
- Broader Architecture Review Trigger: required before acceptance or supersession if policy evaluation is moved out of authoritative orchestration or adapter-local execution paths gain authority over retry/finalization decisions.
- Recertification Cadence: re-review this ADR every 6 months or on major scheduling policy model changes.

## Related Documentation

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`
- `docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.md`
- `docs/architecture/run-orchestration-scheduling-deployment-profile-policy-seams.md`
- `docs/architecture/run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md`
- `docs/architecture/run-orchestration-execution-command-dispatch-seams.md`
- `docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.md`
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/context/context-map.md`

## Related Code Paths

- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase.ts`
- `src/application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase.ts`
- `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- `src/application/runs/use-cases/ProcessAuthoritativeRunQueueSchedulingUseCase.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
- `src/application/runs/use-cases/HandleRunDispatchResultUseCase.ts`
- `src/application/runs/use-cases/RequestAuthoritativeRunRetryUseCase.ts`
- `src/application/runs/use-cases/ReleaseStaleSchedulingReservationUseCase.ts`
- `src/application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase.ts`
- `src/application/runs/use-cases/DispatchAssignedRunExecutionUseCase.ts`
- `src/infrastructure/execution/runs/RunExecutionDispatchRouter.ts`

## Follow-Up Actions

- Treat this ADR as a review gate for any change that introduces new scheduling policy dimensions, retry semantics, or execution-dispatch behavior.
- Keep scheduling and execution architecture references linked under `## Related ADRs` when decision boundaries evolve.
- Add regression tests whenever assignment reservation, retry gating, or dispatch-guard semantics change.
