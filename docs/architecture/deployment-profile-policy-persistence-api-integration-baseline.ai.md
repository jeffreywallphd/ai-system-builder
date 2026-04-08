# AI Companion: Deployment Profile Policy Persistence/API Integration Baseline

## Purpose

Story 20.2.8 documents the authoritative end-to-end baseline for deployment-policy persistence, startup resolution, read/write APIs, update validation, governance audit integration, and dependent-feature policy consumption expectations.

## Human doc

- `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md`

## Canonical seams to reference

- Domain/taxonomy: `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Resolution/validation: `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- Persistence: `src/application/deployment/ports/IDeploymentPolicyPersistenceRepository.ts`, `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceAdapter.ts`
- Authoritative use cases: `ReadDeploymentPolicyAdministrationUseCase.ts`, `DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- API adapters/contracts: `DeploymentPolicyReadBackendApi.ts`, `DeploymentPolicyWriteBackendApi.ts`, `DeploymentPolicyReadContracts.ts`, `DeploymentPolicyWriteContracts.ts`
- Startup/bootstrap: `DeploymentPolicyBootstrapResolutionService.ts`, `AuthoritativeServerCompositionRoot.ts`, `IdentityServerHost.ts`
- Governance hooks: `DeploymentPolicyGovernanceEventPorts.ts`, `PlatformDeploymentPolicyGovernanceEventSink.ts`, `AuthoritativeDeploymentPolicyGovernanceEventSink.ts`
- Feature consumption seams: `DeploymentPolicyEvaluationPorts.ts`, `DeploymentPolicyEvaluationService.ts`, `CanonicalDeploymentPolicySnapshotResolver.ts`

## Baseline workflow summary

1. Startup resolves persisted active profile + overrides, applies deterministic fallback, validates persisted state, and prepares evaluation seams.
2. Read API returns typed policy state (`/api/v1/deployment/policy/state`) with optional catalog/override/effective-metadata sections.
3. Write APIs (`/api/v1/deployment/policy/active-profile`, `/api/v1/deployment/policy/overrides`) enforce permissions + validation before persistence and return canonical snapshots.
4. Successful writes publish governance hooks for audit/operational channels.
5. Dependent features consume typed `IDeployment*PolicyEvaluationPort` decisions instead of raw catalog/persistence/profile-branching logic.

## Deferred/limit posture captured in this baseline

- Deferred storage/security/audit/admin/scheduling policy integrations are explicitly documented.
- First-scope governance payloads intentionally avoid raw override values.
- Supported write scope kind is currently `deployment-policy-scope`.
- Default startup scope remains `platform:default` unless host composition config overrides it.
