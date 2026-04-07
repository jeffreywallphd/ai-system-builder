# AI Companion: Run Orchestration Node Capability Matching and Assignment Preconditions

## Story scope
Story 16.2.2 adds authoritative application-layer matching for run-to-node assignment eligibility and explicit precondition evaluation.

## Implemented files
- `src/application/runs/ports/RunAssignmentEligibilityPorts.ts`
- `src/application/runs/use-cases/RunNodeAssignmentEligibilityService.ts`
- `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
- `src/application/runs/tests/RunNodeAssignmentEligibilityService.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`
- Human doc: `docs/architecture/run-orchestration-node-capability-matching.md`

## Core delivery
- Adds reusable assignment eligibility contracts (`RunAssignmentRequirementSet`, structured denial codes/reasons, node catalog + policy ports).
- Adds `RunNodeAssignmentEligibilityService` that derives explicit run requirements from authoritative submission metadata and evaluates node eligibility under trust/capability/policy preconditions.
- Keeps assignment checks in application orchestration instead of adapter-specific dispatch logic.

## Requirement derivation (current supported execution scope)
- `executor` is always required.
- `storage-access` required when submission contains storage references.
- `preview-worker` required when preview decryption prerequisite is expected.
- Remote scheduling requirement derives from canonical `runtimeTarget.async`.
- Requirement envelope carries execution characteristics and submitted storage/resource/policy prerequisites for policy-port enforcement.

## Selection-flow integration
- `SelectAssignmentReadyRunsUseCase` now supports optional `nodeId`.
- Node-targeted selection fails closed when no eligibility service is configured.
- Claimed queue entries that fail eligibility are immediately claim-released and excluded from returned items.

## Coverage added
- Service tests for: eligible path, unapproved/trust/capability/remote-scheduling denials, policy-port denial, and missing-requirements fail-closed behavior.
- Selection tests for: release-on-ineligible node match and fail-closed behavior when node-targeted selection has no matcher.

