# Hybrid-Node Local Interactive Protection Rules

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.5: Implement hybrid-node local interactive protection rules

## Purpose

Implement production-safe hybrid-node local-use protections in the authoritative scheduling policy pipeline so remote scheduling does not over-consume hybrid workstations used in privileged local contexts.

This story keeps local-use protection in application/domain scheduling seams and not in transport handlers, node executors, persistence adapters, or backend dispatch adapters.

## Canonical implementation map

- Hybrid local-use policy input + evaluator semantics:
  - `src/domain/scheduling/SchedulingDomain.ts`
- Application-layer hybrid protection rule integration:
  - `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- Authoritative policy-evaluation coverage:
  - `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
  - `src/domain/scheduling/tests/SchedulingDomain.test.ts`
- Shared scheduling snapshot schema updates for new node protection signals:
  - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
  - `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`

## Implemented hybrid protection signals

`SchedulingNodePolicyInput` now carries an optional `hybridLocalUseProtection` policy-input object:

- `reservedLocalCapacityUnits`
- `activeRemoteAssignmentCount`
- `protectedLocalUserWindow`
  - `startsAt`
  - `endsAt`
  - `protectedUserIdentityId` (optional)

These are interpreted only for `hybrid` nodes.

## Implemented policy behavior

`evaluateHybridNodeLocalInteractiveProtection` now enforces this ordered posture:

1. Interactive local-session protection
- If node type is `hybrid` and usage mode is `interactive-local-session`, remote assignment is denied.
- Exception: same-user reuse is allowed when run actor equals local interactive owner.

2. Reserved local-capacity protection
- If `reservedLocalCapacityUnits > 0` and `activeRemoteAssignmentCount >= reservedLocalCapacityUnits`, remote assignment is denied.
- Same-user interactive-owner reuse remains allowed.

3. Protected local-user window protection
- If `asOf` falls within `protectedLocalUserWindow` (`startsAt <= asOf < endsAt`), remote assignment is denied.
- Exception: when `protectedUserIdentityId` is present and matches run actor, assignment is allowed.

All denials are explainable and emitted with `hybrid-local-interactive-protection` plus `details.protectionKind`:

- `interactive-local-session`
- `reserved-local-capacity`
- `protected-local-user-window`

## Explainability and defer behavior

- Hybrid protection is evaluated by the scheduling rule pipeline (`HybridNodeLocalUseProtectionPolicyRule`).
- Candidate denial reasons are included in `SchedulingCandidateDecision`.
- If all candidates are blocked by local-use protections, authoritative scheduling returns `deferred` with `no-eligible-candidates`.

This satisfies the local-use protection requirement without hidden infrastructure shortcuts.

## Assumptions (current release)

- Capacity signals are provided as lightweight counters (`reservedLocalCapacityUnits`, `activeRemoteAssignmentCount`) and are treated as authoritative snapshots for one evaluation pass.
- Protected-window evaluation uses pipeline `asOf` and requires ISO timestamps.
- `protectedUserIdentityId` is optional; when omitted, protected windows deny all remote actors during the window.
- Same-user exceptions apply only when comparable identity IDs are available.

## Explicit limitations and deferred refinements

- No dynamic multi-resource arbitration is performed (GPU/CPU/memory pressure modeling is deferred).
- No automatic sampling or freshness validation of telemetry is performed in this story.
- No calendar recurrence or workspace-scoped exception policy is included yet.
- No policy-level weighting/deprioritization score adjustments are introduced yet; this release enforces explicit eligibility gating.

Future policy stories can add richer quotas/reservations/affinity/deployment overlays through the same rule pipeline seams.

