# Run Submission Readiness and Blocking Validation Service

## Story alignment

- Feature 4: Run Orchestration Integration for Image Systems
- Epic 4.2: Run Submission, Validation, and Queue Lifecycle Use Cases
- Story 4.2.2: Implement run-readiness evaluation and blocking validation service

## Purpose

Provide one reusable application-layer readiness evaluator for image-run submission that can be called independently or composed into authoritative run submission. The service must return structured blocking/advisory findings and prevent queue admission when preconditions are not met.

## Canonical implementation files

- `src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessContracts.ts`
- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/application/image-workflows/tests/ImageRunSubmissionReadinessValidationService.test.ts`
- `src/application/runs/tests/SubmitImageRunUseCase.test.ts`

## Readiness evaluation coverage

1. Workflow/system validity
- Confirms system/workflow existence in workspace scope.
- Enforces runnable posture for submission (`ready` lifecycle + `enabled` runtime for systems).
- Enforces workflow publish/activation readiness and completeness.
- Detects system/workflow binding lineage/version mismatches.

2. Asset-slot completeness and referenced asset checks
- Evaluates required input/output binding completeness from workflow/system requirements.
- Detects missing required input/output slot fulfillment.
- Validates referenced asset existence, active lifecycle state, and workspace ownership.

3. Parameter validity
- Validates merged parameter values (system baseline + runtime overrides) against workflow parameter specifications.
- Returns structured issues for unknown parameters, missing required values, and invalid typed/ranged values.

4. Visibility/authorization checks available at submission stage
- Evaluates actor authorization for referenced assets (`asset.read`) when policy evaluator context is available.
- Emits policy-denial findings with machine-readable codes and reason metadata.

5. Backend execution-readiness dependencies
- Resolves backend readiness through execution-readiness use case integration.
- Maps degraded/unavailable adapter state and capability incompatibilities into readiness issues.

## Blocking behavior and queue admission

- `SubmitImageRunUseCase` invokes submission readiness after structural/policy validation and before authoritative creation.
- Any readiness `blockingIssues` produce `policy-ineligible` submission denial and prevent queue admission.
- Advisory-only readiness findings are preserved as warnings and returned to caller without blocking.

## Contract posture

- Readiness output remains normalized through `ImageRunSubmissionReadinessResult`.
- Results include:
  - `state` (`ready` | `advisory` | `blocked`)
  - `readyForQueueing`
  - `blockingIssues` and `advisoryIssues`
  - structured sections for `policyDenials`, `assetBinding`, `workflowValidity`, `systemValidity`, `backendReadinessDependency`, and `compatibility`
- Service is transport-agnostic and reusable by submission APIs and studio UX without duplicating controller/UI validation logic.
