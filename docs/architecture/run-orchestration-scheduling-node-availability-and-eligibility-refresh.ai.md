# AI Companion: Scheduling Node Availability and Eligibility Refresh

## Story scope
Story 17.2.5 keeps scheduling arbitration anchored to current node trust/availability state by adding refresh-time node-state checks in scheduler snapshot assembly.

## Human doc
- `docs/architecture/run-orchestration-scheduling-node-availability-and-eligibility-refresh.md`

## Implemented files
- `src/application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase.ts`
- `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`
- `src/domain/scheduling/SchedulingDomain.ts`
- `src/application/scheduling/tests/AssembleAuthoritativeSchedulingInputUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`

## Core delivery
- Adds optional node-state refresh seam during scheduling input assembly.
- Applies explicit heartbeat freshness checks during scheduler node eligibility derivation.
- Fails closed for nodes with unavailable refresh/availability evidence when refresh is enabled.
- Propagates node unschedulable reason codes into scheduler candidate denials.

## Supported freshness semantics (current scope)
- Default heartbeat freshness threshold is 120 seconds.
- Missing heartbeat data is treated as unavailable by default.
- Offline heartbeat status is treated as unavailable by default.
- Revoked node trust state always marks node ineligible for scheduler placement.

## Explainability posture
- Emits explicit denial codes for stale/unavailable/revoked node-state conditions:
  - `node-state-stale`
  - `node-state-unavailable`
  - `node-revoked`

## Boundary posture
- Refresh/state retrieval remains an application-layer port + repository seam.
- Scheduling decision logic remains in scheduling domain/application policy modules.
- No persistence/transport adapter shortcut bypasses scheduler policy evaluation.
