# Scheduling Policy Shared Contracts and Schema Validation

## Story alignment

- Feature 17: Policy-Aware Scheduling and Hybrid Node Arbitration
- Epic 17.1: Establish the Scheduling Domain, Policy Model, and Authoritative Decision Pipeline
- Story 17.1.2: Create shared scheduling contracts and policy-evaluation result shapes

## Purpose

Define one canonical shared scheduling contract package for scheduler-facing inputs and explainable policy-evaluation outputs so application services, transport surfaces, admin/operational projections, and diagnostics tooling share stable decision semantics.

This story formalizes:
- scheduling input snapshots
- queue-evaluation summaries
- priority and reservation metadata
- candidate reasoning and exclusion summaries
- policy snapshot metadata and decision outcomes
- schema-backed parsing/validation for these contracts

## Canonical contract files

- `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - Canonical versioned scheduling contract package.
  - Shared policy-evaluation result shape (`SchedulingPolicyEvaluationResult`).
  - Queue summary, candidate reasoning, priority metadata, reservation status, and decision-bundle contracts.
  - Canonical reason code catalog for defer/deny outcome messaging.
  - Mapping helpers that project domain scheduling decisions + snapshots into transport/admin-safe evaluation payloads.
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
  - Zod-backed schema validation and parse helpers for scheduling snapshots, decision bundles, queue summaries, and policy-evaluation results.
  - Canonical schema validation error type with path/code/message issue surfaces for diagnostics and adapter mapping.

## Migration and ownership notes

- Application scheduling pipeline contracts in `src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts` now alias the shared scheduling contract types and are marked deprecated as local DTO ownership.
- New scheduler-facing APIs, admin surfaces, and operational diagnostics should import from:
  - `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
- The canonical domain policy model remains in:
  - `src/domain/scheduling/SchedulingDomain.ts`
- Shared contracts are projection/transport-safe representations and must not introduce UI state model coupling.

## Canonical result semantics

1. `SchedulingEvaluationSnapshot`
- Canonical authoritative scheduling inputs (queue leases, runs, nodes, evaluation timestamp, deployment-profile context).

2. `SchedulingQueueEvaluationSummary`
- Deterministic queue/candidate counts (`candidateCount`, `eligibleCandidateCount`, `excludedCandidateCount`) for admin and diagnostics stability.

3. `SchedulingCandidateReasoningSummary`
- Candidate-level explainability surface:
  - eligibility
  - score-derived priority metadata
  - reservation conflict posture
  - exclusion reason codes and full reason payloads

4. `SchedulingPolicySnapshotMetadata`
- Versioned policy snapshot metadata (`contractVersion`, `decisionId`, `occurredAt`, `policySources`, optional deployment profile).

5. `SchedulingPolicyEvaluationResult`
- Canonical outcome projection for policy passes:
  - selected candidate (when applicable)
  - summary counts
  - per-candidate reasoning
  - policy-level reason list

## Schema validation guarantees

- Scheduling payloads are validated with strict object schemas.
- Outcome/selection invariants are enforced (`selected` only for `assignment-recommended`).
- Candidate summary invariants are enforced (eligible candidates cannot carry exclusions).
- Queue summary arithmetic is enforced (`candidateCount = eligible + excluded`).

## Test coverage

- Contract tests:
  - `src/shared/contracts/runtime/tests/SchedulingPolicyEvaluationContracts.test.ts`
- Schema tests:
  - `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`
- Documentation/discoverability assertions:
  - `src/application/runs/tests/SchedulingPolicySharedContractsDocumentation.test.ts`

## Usage guidance

1. Use scheduling shared contracts for any scheduler policy-evaluation response shape shared across application, transport, admin, or diagnostics surfaces.
2. Use scheduling schema contracts at HTTP/IPC/WebSocket boundaries to enforce canonical payload validity.
3. Keep scheduling policy rule evolution in domain/application scheduling seams; shared contracts should reflect stable outputs and metadata, not policy implementation logic.
