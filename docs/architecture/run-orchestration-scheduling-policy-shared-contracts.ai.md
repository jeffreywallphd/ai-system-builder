# AI Companion: Scheduling Policy Shared Contracts

## Story scope
Story 17.1.2 introduces canonical shared scheduling contracts and schema-backed evaluation-result shapes for policy-aware scheduling.

## Human doc
- `docs/architecture/run-orchestration-scheduling-policy-shared-contracts.md`

## Added canonical files
- `src/shared/contracts/runtime/SchedulingPolicyEvaluationContracts.ts`
  - Shared scheduling snapshot/result contracts.
  - Candidate reasoning, queue summary, priority metadata, reservation status, and policy snapshot metadata.
  - Canonical defer/deny reason-code catalog and projection helpers.
- `src/shared/schemas/runtime/SchedulingPolicyEvaluationSchemaContracts.ts`
  - Zod parse/validation contracts for scheduling snapshots, queue summaries, policy results, and decision bundles.
  - Canonical `SchedulingPolicyEvaluationSchemaValidationError` issue surface.

## Migration posture
- `src/application/scheduling/AuthoritativeSchedulingDecisionPipeline.ts` now aliases shared scheduling contracts and marks local DTO ownership as deprecated.
- New scheduling transport/admin/diagnostics payloads should import from shared contract + schema modules, not redefine pipeline-local DTOs.

## Contract guarantees
- Policy-evaluation outcomes stay explainable and reason-bearing.
- Candidate arbitration details are stable (eligibility, exclusion codes, score-derived priority, reservation conflict posture).
- Queue summary counts are deterministic and schema-enforced.
- Policy snapshot metadata is versioned and source-traceable.

## Tests added
- `src/shared/contracts/runtime/tests/SchedulingPolicyEvaluationContracts.test.ts`
- `src/shared/schemas/runtime/tests/SchedulingPolicyEvaluationSchemaContracts.test.ts`
- `src/application/runs/tests/SchedulingPolicySharedContractsDocumentation.test.ts`
