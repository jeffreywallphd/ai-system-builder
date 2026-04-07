# Scheduling Node Availability and Eligibility Refresh in Queue Evaluation

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.2: Integrate Scheduling Decisions with Queue Processing, Node Arbitration, and Reservation Controls
- Story 17.2.5: Implement node-availability and eligibility refresh in the scheduling loop

## Purpose

Keep scheduler placement arbitration anchored to current authoritative node state by:

- refreshing node identity/eligibility state during scheduler snapshot assembly
- evaluating heartbeat-based freshness before candidate arbitration
- failing closed when refresh-time node state is unavailable

This prevents stale assumptions from being treated as eligible placement capacity.

## Canonical implementation map

- Scheduling snapshot assembly and node-state freshness enforcement:
  - `src/application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase.ts`
- Scheduling node denial-code vocabulary:
  - `src/domain/scheduling/SchedulingDomain.ts`
- Scheduler rule evaluation that emits node unschedulable reasons:
  - `src/application/scheduling/use-cases/SchedulingPolicyRulePipeline.ts`

## Freshness strategy (current supported scope)

- Queue-evaluation node state is pulled from trusted node repository each cycle.
- Optional refresh port (`nodeStateRefreshPort`) can supply newer per-node authoritative state in the same cycle.
- If refresh data is unavailable for a node while refresh is enabled, that node is marked unschedulable for the cycle.
- Heartbeat freshness is currently enforced with a bounded age threshold (`maxHeartbeatAgeSeconds`, default 120s).
- Missing heartbeat data (by default) is treated as unavailable for scheduling.
- Offline heartbeat status (by default) is treated as unavailable for scheduling.

## Placement decision behavior for stale/unavailable/revoked state

- `node-state-stale`: heartbeat evidence is older than the configured freshness threshold.
- `node-state-unavailable`: refresh or availability evidence is missing/unavailable for the cycle.
- `node-revoked`: refreshed or repository node trust state indicates revocation.

These reason codes flow into candidate denials through scheduler policy-rule evaluation and are visible in scheduling decision outputs.

## Boundary posture

- Node-state retrieval/refresh remains an application-layer port/repository seam.
- Scheduling policy remains in scheduling domain/application modules.
- Persistence/transport layers do not inject hidden scheduler bypasses.

Do not route around authoritative queue claim and scheduler policy evaluation seams.

## Verification coverage

- `src/application/scheduling/tests/AssembleAuthoritativeSchedulingInputUseCase.test.ts`
- `src/application/scheduling/tests/EvaluateAuthoritativeSchedulingPolicyUseCase.test.ts`
- `src/application/runs/tests/ProcessAuthoritativeRunQueueSchedulingUseCase.integration.test.ts`
