# AI Companion: Deployment Profile Policy Invariants and Extension Rules

## Purpose

Story 20.1.7 documents the deployment-profile invariants and contributor extension workflow so policy administration stays centralized, auditable, and layer-safe as more governed behaviors are added.

## Human doc

- `docs/architecture/deployment-profile-policy-invariants-and-extension-rules.md`

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- `src/application/policy-administration/DeploymentPolicyEvaluationContracts.ts`
- `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
- `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
- `src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`

## Summary

- Defines deployment-profile philosophy for `home` / `classroom` / `organization` without architecture forks.
- Captures supported policy-family taxonomy and control-mode invariants.
- Documents preset-versus-admin override rules and effective-value precedence.
- Provides feature consumption guidance through `IDeployment*PolicyEvaluationPort` interfaces.
- Documents explicit prohibited patterns for UI, transport, and backend adapters.
