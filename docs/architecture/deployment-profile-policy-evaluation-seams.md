# Deployment Profile Policy Evaluation Seams for Dependent Features

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.6: Implement the policy evaluation seam used by dependent features

## Purpose

Provide one application-layer policy evaluation seam for dependent features (authorization, storage, scheduling, security, and admin/audit surfaces) so they query effective governed policy decisions without reading raw preset catalogs or configuration storage directly.

## Canonical files

- Typed seam contracts and decision models:
  - `src/application/policy-administration/DeploymentPolicyEvaluationContracts.ts`
- Application ports consumed by dependent features:
  - `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
- Application service that resolves typed settings and feature decisions:
  - `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
- Default snapshot resolver adapter (application seam over canonical registry + effective resolver):
  - `src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts`
- Tests:
  - `src/application/policy-administration/tests/DeploymentPolicyEvaluationService.test.ts`
  - `src/application/policy-administration/tests/DeploymentPolicyEvaluationServiceContracts.test.ts`

## Evaluation seam shape

`DeploymentPolicyEvaluationService` exposes:

1. Typed per-setting read API:
   - `evaluateSetting({ context, path })`
2. Typed decision APIs for dependent feature families:
   - `evaluateAuthorizationPolicy(...)`
   - `evaluateStoragePolicy(...)`
   - `evaluateSchedulingPolicy(...)`
   - `evaluateSecurityPolicy(...)`
   - `evaluateAuditAndAdminPolicy(...)`

All outputs include:

- resolved value,
- setting source attribution (`profile-preset`, `policy-default`, `admin-state`),
- control mode metadata.

## No raw configuration leakage

Dependent modules consume `IDeployment*PolicyEvaluationPort` interfaces and do not need direct access to:

- deployment family catalogs,
- profile preset catalogs,
- preset-inheritance logic,
- raw configuration storage structures.

The default resolver adapter (`CanonicalDeploymentPolicySnapshotResolver`) is the single application-layer location that binds canonical catalogs to snapshot evaluation behavior.

## Service-consumption examples

`DeploymentPolicyEvaluationServiceContracts.test.ts` demonstrates feature-facing consumption through explicit interfaces:

- authorization/sharing consumers use `IDeploymentAuthorizationPolicyEvaluationPort`,
- storage consumers use `IDeploymentStoragePolicyEvaluationPort`,
- scheduling consumers use `IDeploymentSchedulingPolicyEvaluationPort`,
- security consumers use `IDeploymentSecurityPolicyEvaluationPort`.

This keeps dependent features on explicit policy-evaluation seams rather than global config shortcuts.

## Story 20.2.3 first dependent integrations

The first production integrations now consume effective policy decisions at application boundaries:

- Workspace creation sharing defaults:
  - `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
  - when request visibility is omitted, the use case resolves `evaluateAuthorizationPolicy(...)` and maps
    `defaultWorkspaceVisibility` into workspace ownership visibility.
- Run submission approval posture:
  - `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
  - the validator resolves `evaluateSchedulingPolicy(...)` and adds policy-driven prerequisite requirements based on:
    - `runSubmissionApprovalMode`
    - `highRiskRunRequiresDualApproval` (for high-risk tagged submissions).

## Explicitly deferred policy-family integrations

The following policy families remain intentionally deferred for later stories and are not accidental omissions in this story:

- storage-governance defaulting for storage create/update payload synthesis,
- security-governance transport and credential-rotation runtime enforcement,
- audit-governance export/redaction/retention enforcement in audit query and export workflows,
- admin-controls delegated workspace-admin policy enforcement outside policy-admin mutation workflows,
- scheduling profile-aware queue/rule overlays beyond run-submission approval prerequisites.
