# AI Companion: Run Submission Validation and Policy Eligibility

## Story scope
Story 16.1.3 adds the application-layer run submission validator that blocks invalid/unauthorized/ineligible submissions before orchestration acceptance.

## Added files
- `src/application/runs/ports/RunSubmissionValidationPorts.ts`
- `src/application/runs/use-cases/RunSubmissionValidationContracts.ts`
- `src/application/runs/use-cases/RunSubmissionValidationRules.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
- `docs/architecture/run-submission-validation-policy-eligibility.md`
- `src/application/image-workflows/ImageRunSubmissionReadinessContracts.ts`
- `src/application/image-workflows/tests/ImageRunSubmissionReadinessContracts.test.ts`

## Core behavior
- Structural validation and canonical normalization are explicitly separated from policy/eligibility checks.
- Structural stage validates actor/workspace/runtime target basics and normalizes parameter/storage/resource/security reference payloads into canonical command shape.
- Policy stage composes existing architecture seams:
  - workspace read (`IWorkspaceRepository`)
  - authorization decisions (`IAuthorizationPolicyDecisionEvaluator`)
  - storage policy and lookup (`IStorageInstanceRepository`, `IStoragePolicyEvaluationPort`)
  - security prerequisite evaluation (`IEncryptionPolicyEvaluationService`)
  - deployment scheduling approval posture (`IDeploymentSchedulingPolicyEvaluationPort`)
  - run-target availability/policy contract (`IRunSubmissionTargetResolverPort`)

## Denial semantics
Rejections return one standard code:
- `invalid-request`
- `forbidden`
- `not-found`
- `policy-ineligible`

Each rejection includes typed `validationIssues` with stable `kind/path/code/message/details`.

## Acceptance-path output
- Successful validation returns `CanonicalRunSubmissionCommand` with normalized actor/workspace/target identity, parameter maps, reference sets, prerequisites, and occurred-at timestamp.
- This command is the intended orchestration-safe input for later run acceptance/queueing stories.

## Image run readiness contract posture
- Introduces one reusable `ImageRunSubmissionReadinessResult` model for image-run submission readiness.
- Separates blocking/advisory issues and keeps machine-readable `code` separate from user-facing `summary`.
- Supports structured findings for policy denials, asset-binding completeness, workflow/system validity, backend-readiness dependencies, and compatibility checks.
- Keeps contracts backend-agnostic while allowing adapter health/capability findings to participate in queue-admission decisions and future scheduling/node-capability integration.

## Tests
`ValidateRunSubmissionUseCase.test.ts` verifies:
- structural rejection,
- authorization rejection,
- policy ineligibility rejection,
- availability rejection,
- happy-path normalization/acceptance.
