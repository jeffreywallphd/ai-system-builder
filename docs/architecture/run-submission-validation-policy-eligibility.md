# Run Submission Validation and Policy Eligibility

## Story alignment

- Feature 16: Run Submission and Orchestration Core
- Epic 16.1: Establish the Authoritative Run Domain and Submission Pipeline
- Story 16.1.3: Implement submission validation and policy-aware eligibility checks

## Purpose

Introduce a reusable application-layer validation boundary that blocks invalid, unauthorized, unavailable, or policy-ineligible run submissions before orchestration acceptance.

## Canonical implementation files

- `src/application/runs/ports/RunSubmissionValidationPorts.ts`
- `src/application/runs/use-cases/RunSubmissionValidationContracts.ts`
- `src/application/runs/use-cases/RunSubmissionValidationRules.ts`
- `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts`
- `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessContracts.ts`
- `src/application/image-workflows/tests/ImageRunSubmissionReadinessContracts.test.ts`

## Validation architecture

Validation is split into two explicit stages:

1. Structural normalization and contract checks (`RunSubmissionValidationRules.ts`)
- validates actor/workspace/runtime target required fields
- validates parameter key shape
- validates and normalizes storage/resource/security reference collections
- produces canonical normalized command input when structurally valid

2. Policy and eligibility checks (`ValidateRunSubmissionUseCase.ts`)
- workspace existence and active lifecycle check through `IWorkspaceRepository`
- permission checks through `IAuthorizationPolicyDecisionEvaluator`
  - system submit gate: `system.execute`
  - workflow gate (when provided): `workflow.run`
  - template gate (when provided): `template.instantiate`
  - extra resource references (when provided): per-reference permission
- target availability + allowed parameter set + required prerequisite checks through `IRunSubmissionTargetResolverPort`
- storage reference policy checks through existing storage seams (`IStorageInstanceRepository` + `IStoragePolicyEvaluationPort`)
- security prerequisite checks through existing security seam (`IEncryptionPolicyEvaluationService`)
- deployment-profile approval posture checks through deployment policy seam (`IDeploymentSchedulingPolicyEvaluationPort`)
  with application-level context resolution.

## Standardized denial semantics

Use-case responses return one stable error taxonomy:

- `invalid-request`
- `forbidden`
- `not-found`
- `policy-ineligible`

Each rejection returns structured `validationIssues` with:

- `kind`: `structural | authorization | availability | policy`
- `path`
- `code`
- `message`
- optional `details`

This aligns validation and denial behavior with shared API-style error semantics while preserving precise reason granularity.

## Image run submission readiness contract model

Image-manipulation orchestration extends the baseline validator with reusable readiness-result contracts that preserve one canonical queue-admission decision shape across use cases, APIs, and UI surfaces:

- readiness states: `ready | advisory | blocked`
- issue categories:
  - `blocking`
  - `advisory`
  - `policy-denial`
  - `asset-binding`
  - `workflow-validity`
  - `system-validity`
  - `backend-readiness-dependency`
  - `compatibility`
- each issue carries:
  - machine-readable `code`
  - user-facing `summary`
  - explicit `blocking` posture
- structured readiness findings are first-class:
  - policy denials
  - asset-binding completeness
  - workflow/system validity
  - backend adapter-health + capability dependencies
  - workflow/system/adapter compatibility outcomes

This keeps submission-readiness evaluation backend-agnostic while allowing adapter health/capability and future scheduling/node-capability checks to consume the same contract without transport/UI duplication.

Story 4.2.2 adds `ImageRunSubmissionReadinessValidationService` as the canonical application service that evaluates submission readiness and returns blocking/advisory findings for:
- workflow/system readiness and compatibility posture,
- required asset-slot completeness plus referenced-asset validity/authorization checks,
- parameter-set validity against workflow parameter contracts,
- backend execution-readiness dependencies.

## Canonical command output

Accepted submissions are emitted as `CanonicalRunSubmissionCommand`, which includes normalized:

- actor reference
- workspace and target references (system/version, optional workflow/template)
- source and runtime target metadata
- tags/metadata
- parameter map
- storage/resource references
- security prerequisites
- deployment-policy-derived approval prerequisites
- submission context metadata
- normalized `occurredAt`

This canonical command is intended as the orchestration-safe input for next-stage run submission handling.

## Test coverage

`ValidateRunSubmissionUseCase.test.ts` covers:

- structural invalid submission rejection
- unauthorized actor rejection
- policy-ineligible rejection
- unavailable target rejection
- happy-path canonical command acceptance
