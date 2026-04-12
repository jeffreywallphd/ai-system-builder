# AI Companion: Deployment Profile Policy Evaluation Seams for Dependent Features

## Purpose

Story 20.1.6 adds the application-facing policy evaluation seam that dependent features use to query effective deployment-profile decisions without reading preset/configuration internals directly.

## Human doc

- `docs/architecture/deployment-profile-policy-evaluation-seams.md`

## Canonical files

- `src/application/policy-administration/DeploymentPolicyEvaluationContracts.ts`
- `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
- `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
- `src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts`

## Delivery summary

- Adds typed setting-path read API via `evaluateSetting(...)`.
- Adds typed policy-derived decision APIs for authorization, storage, scheduling, security, and audit/admin concerns.
- Encapsulates canonical catalog binding inside `CanonicalDeploymentPolicySnapshotResolver`.
- Keeps dependent features integrated through explicit application interfaces rather than direct raw preset/config lookups.

## Consumption and tests

- `src/application/policy-administration/tests/DeploymentPolicyEvaluationService.test.ts`
- `src/application/policy-administration/tests/DeploymentPolicyEvaluationServiceContracts.test.ts`

Service-consumption examples demonstrate authorization/storage/scheduling/security usage through dedicated policy evaluation interfaces.

## Story 20.2.3 dependent-feature integration status

Integrated first policy-driven families:

- sharing defaults at workspace-creation boundary:
  - `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
  - `src/application/workspaces/tests/CreateWorkspaceUseCase.test.ts`
- approval workflow posture in run-submission validation:
  - `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
  - `src/application/runs/tests/ValidateRunSubmissionUseCase.test.ts`

Explicitly deferred policy-family integrations:

- storage-governance defaults for storage provisioning metadata synthesis,
- security-governance runtime transport/credential enforcement,
- audit-governance runtime export/redaction/retention enforcement,
- admin-controls delegated-admin enforcement outside policy-admin mutation flow,
- broader scheduling-profile queue/rule overlays.
