# AI Companion: Deployment Profile Policy Regression Hardening Baseline

## Purpose

Story 20.3.7 finalizes regression hardening for deployment-profile policy administration by validating lifecycle behavior from bootstrap and persistence through authoritative reads/writes, dependent-feature policy evaluation seams, permission boundaries, audit hooks, and observability signals.

## Human doc

- `docs/architecture/deployment-profile-policy-regression-hardening-baseline.md`

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
- `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
- `src/application/policy-administration/tests/DeploymentPolicyAdministrationRegressionLifecycle.integration.test.ts`

## Hardened outcomes

- Verifies one-architecture profile support and explicit fallback seams.
- Verifies preset-vs-admin-state provenance transitions across override upsert/remove.
- Verifies write-path actor provenance safety and runtime-admin permission boundaries.
- Verifies governance event redaction posture and audit/operational dual-channel publication.
- Verifies bootstrap/read/write observability event coverage and rejection capture.
- Verifies dependent-feature policy consumption through evaluation seams instead of raw preset/config reads.

## Deferred posture remains explicit

- No new policy families were introduced.
- Deferred storage/security/audit/admin-controls/scheduling expansions remain documented limits.
