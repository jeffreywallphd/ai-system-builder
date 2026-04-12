# Run Orchestration Node Capability Matching and Assignment Preconditions

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.2: Build Queueing, Assignment, and Execution Dispatch Through the Authoritative Control Plane
- Story 16.2.2: Implement node capability matching and assignment precondition evaluation

## Purpose

Keep run-to-node assignment eligibility authoritative, explicit, and reusable in the application layer so adapter-level dispatch code does not hide assignment assumptions.

## Implemented files

- `src/application/runs/ports/RunAssignmentEligibilityPorts.ts`
- `src/application/runs/use-cases/RunNodeAssignmentEligibilityService.ts`
- `src/application/runs/use-cases/SelectAssignmentReadyRunsUseCase.ts`
- `src/application/runs/tests/RunNodeAssignmentEligibilityService.test.ts`
- `src/application/runs/tests/SelectAssignmentReadyRunsUseCase.test.ts`

## Requirement model (current scope)

`RunNodeAssignmentEligibilityService` derives a `RunAssignmentRequirementSet` from authoritative run metadata (`submissionSnapshot`) and evaluates one run against one node.

Current explicit requirement derivation:

- `executor` is always required for run execution.
- `storage-access` is required when run submission includes storage references.
- `preview-worker` is required when policy prerequisites include `preview-decryption-allowed` with `expected=true`.
- `requiresRemoteScheduling` is derived from `runtimeTarget.async` (`true` by default in canonical submission normalization).
- Requirement envelopes preserve execution characteristics, storage references, resource references, and policy prerequisites for downstream policy ports/scheduling layers.

## Eligibility checks

Assignment eligibility is denied when any of the following are true:

- node is missing or node id is empty
- node approval state is not `approved`
- node trust state is not `trusted`
- node is revoked
- node certificate reference is missing
- node capability profile is missing required capabilities
- run requires remote scheduling but node does not support remote scheduling
- assignment policy port denies workspace/policy/resource preconditions
- authoritative submission requirement snapshot is unavailable (`requirements-unavailable`; fail closed)

All denials are returned as structured ineligibility reasons with stable codes.

## Queue/selection integration

`SelectAssignmentReadyRunsUseCase` now supports optional node-targeted selection (`nodeId`):

- if node-targeted selection is requested and eligibility service is unavailable, selection returns no items (fail closed)
- claimed queue entries that fail assignment eligibility are released immediately via claim token and excluded from returned selection items
- existing queue claim ordering and eligibility marker semantics remain unchanged

## Boundary posture

- Queue persistence remains policy-neutral and does not embed node capability assumptions.
- Node assignment eligibility is centralized in application-layer matching logic.
- Policy-specific restrictions remain extension points via `IRunAssignmentPolicyPort`.
- This service is reusable for future scheduling/scoring stories without duplicating capability checks.

## Test coverage highlights

- eligible trusted node with derived capability requirements
- unapproved node exclusion
- capability mismatch (including preview worker prerequisite mapping)
- remote scheduling requirement mismatch
- policy-port denial behavior
- fail-closed behavior when authoritative submission snapshot is missing
- queue-claim release when node eligibility fails inside assignment-ready selection

