# Deployment Profile Policy Contributor Guide

## Purpose

Provide a practical implementation workflow for extending deployment-profile policy families, effective-resolution behavior, and feature-level policy decision seams without breaking architecture boundaries.

## Canonical docs for this area

- `docs/architecture/deployment-profile-policy-shared-contracts.md`
- `docs/architecture/deployment-profile-policy-taxonomy-registry.md`
- `docs/architecture/deployment-profile-policy-preset-definitions.md`
- `docs/architecture/deployment-profile-policy-effective-resolution-and-overrides.md`
- `docs/architecture/deployment-profile-policy-persistence-and-repositories.md`
- `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md`
- `docs/architecture/deployment-profile-policy-authoritative-write-apis.md`
- `docs/architecture/deployment-profile-policy-evaluation-seams.md`
- `docs/architecture/deployment-profile-policy-invariants-and-extension-rules.md`

## Required implementation path

1. Define or update policy taxonomy in the domain:
   - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
2. Keep effective-resolution and override-validation behavior in deployment application contracts/services:
   - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
   - `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
3. Keep feature-facing policy decision seams in policy-administration application modules:
   - `src/application/policy-administration/DeploymentPolicyEvaluationContracts.ts`
   - `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
   - `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
   - `src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts`
   - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
4. Keep transport payload changes aligned with shared contracts/schemas:
   - `src/shared/contracts/deployment/DeploymentPolicyAdministrationContracts.ts`
   - `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`
   - `src/shared/dto/deployment/DeploymentPolicyAdministrationDtos.ts`
   - `src/shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts.ts`
   - `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts`
5. Update `.md` and `.ai.md` docs together and keep architecture discoverability entries current.

## Implementing policy persistence changes

1. Keep deployment-policy persistence contracts in:
   - `src/application/deployment/ports/IDeploymentPolicyPersistenceRepository.ts`
   - `src/shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos.ts`
2. Keep storage adapter logic in:
   - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceAdapter.ts`
   - `src/infrastructure/persistence/deployment/DeploymentPolicyPersistenceMapper.ts`
   - `src/infrastructure/persistence/deployment/SqliteDeploymentPolicyPersistenceMigrations.ts`
3. Persist and validate:
   - active profile selection,
   - typed override values by family/setting,
   - override provenance and change history,
   - effective-policy metadata snapshots.
4. Keep persistence out of UI and transport handlers.
5. Update authoritative composition wiring when repository availability changes:
   - `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

## Implementing authoritative policy update workflows

1. Keep policy update orchestration in application use cases:
   - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
2. Keep authoritative write transport/backend adapters in:
   - `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
   - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
3. Validate updates at write time (before persistence):
   - supported scope semantics,
   - known family/setting identifiers,
   - control-mode eligibility and expected control mode assertions,
   - setting value type/range/enum constraints,
   - remove-operation safety (cannot remove missing override records),
   - policy-required ticket-reference presence.
4. Enforce permission gates in one place:
   - active profile selection permission,
   - override management permission,
   - runtime-admin override permission.
5. Persist only validated operations through `IDeploymentPolicyPersistenceRepository`.
6. Keep runtime feature behavior enforcement separate from write-time validation.

## Server/bootstrap and API integration expectations

1. Treat `DeploymentPolicyBootstrapResolutionService.ts` as the authoritative startup policy resolver.
2. Do not add feature-specific fallback profile logic in host route handlers; use bootstrap-provided context/evaluation seams.
3. Keep read APIs (`ReadDeploymentPolicyAdministrationUseCase.ts`, `DeploymentPolicyReadBackendApi.ts`) inspection-only.
4. Keep write APIs (`DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`, `DeploymentPolicyWriteBackendApi.ts`) authoritative for mutation validation and persistence.
5. Keep audit/operational governance hook publication in policy-administration workflows:
   - `DeploymentPolicyGovernanceEventPorts.ts`
   - `PlatformDeploymentPolicyGovernanceEventSink.ts`
   - `AuthoritativeDeploymentPolicyGovernanceEventSink.ts`
6. Keep shared read/write contracts and schema validation in `src/shared/contracts/deployment/*` and `src/shared/schemas/deployment/*`.

## Adding a new policy family

1. Add the family in `createCanonicalDeploymentPolicyFamilyCatalog(...)`.
2. Define setting keys, `controlMode`, `valueKind`, defaults, and validation rules.
3. Add preset values in `createCanonicalDeploymentProfilePresetDefinitions(...)` only where control mode allows preset overrides.
4. Verify canonical registry output through `createCanonicalDeploymentPolicyConfigurationRegistry()`.
5. Add tests for id normalization, validation-rule enforcement, preset inheritance, and prohibited overrides.

## Adding or changing preset behavior

1. Modify profile lineage/overrides in preset-definition functions.
2. Preserve canonical profile chain (`home -> classroom -> organization`) unless a versioned migration explicitly changes it.
3. Keep profile differences data-driven in preset definitions, not conditionalized in feature modules.
4. Add tests for source attribution and effective defaults (`profile-preset` vs `policy-default`).

## Adding a new policy decision API for a feature

1. Add typed setting path(s) and output contract shape in `DeploymentPolicyEvaluationContracts.ts`.
2. Expose a dedicated `IDeployment*PolicyEvaluationPort` interface in `DeploymentPolicyEvaluationPorts.ts`.
3. Add the evaluation method implementation to `DeploymentPolicyEvaluationService.ts`.
4. Consume the port interface in the feature use case/service; do not read raw family/preset catalogs.
5. Add service and contract tests for typed value assertions and source/control-mode propagation.

Request policy decisions through `IDeployment*PolicyEvaluationPort` interfaces.

## First dependent-feature integrations (Story 20.2.3)

Use these files as reference patterns for application-boundary integration:

- sharing defaults in workspace creation:
  - `src/application/workspaces/use-cases/CreateWorkspaceUseCase.ts`
  - consumes `IDeploymentAuthorizationPolicyEvaluationPort` through a context resolver seam.
- approval posture in run-submission validation:
  - `src/application/runs/use-cases/ValidateRunSubmissionUseCase.ts`
  - consumes `IDeploymentSchedulingPolicyEvaluationPort` through a context resolver seam.

Integration rule:

- resolve effective policy in use-case/application services,
- map policy decisions into feature-specific behavior,
- avoid profile branching in UI, route handlers, or persistence adapters.

Current intentional deferrals:

- storage-governance default payload synthesis,
- security-governance transport/credential runtime controls,
- audit-governance query/export runtime controls,
- admin-controls delegation gates in workspace/member administration,
- scheduling queue-policy overlays beyond run-submission approval prerequisites.

Current limits that should remain explicit in feature work:

- policy-governance events publish safe summaries and avoid raw override value payloads,
- mutation scope kind is currently `deployment-policy-scope`,
- default startup scope is `platform:default` unless host composition config intentionally changes it.

## Effective-resolution invariants checklist

- Preset inheritance order is deterministic.
- Presets never override `runtime-admin` settings.
- Runtime admin overrides never mutate `profile-fixed` settings.
- Effective value precedence remains preset -> default -> valid admin override.
- Override rejections are structured and auditable.

## Prohibited patterns

- Embedding profile-specific branching directly in UI components is prohibited.
- Embedding profile-specific branching directly in transport handlers is prohibited.
- Embedding profile-specific branching directly in backend adapters is prohibited.
- Bypassing `evaluateDeploymentPolicyAdministrationSnapshot(...)` / `resolveDeploymentPolicyEffectiveState(...)` with local merge logic is prohibited.
- Reading raw preset catalog data directly from feature modules is prohibited.
- Writing unvalidated override records directly to persistence payloads is prohibited.

## Review checklist

1. Did domain taxonomy/preset changes stay in `src/domain/deployment`?
2. Did effective-resolution logic stay in `src/application/deployment`?
3. Did feature policy-consumption stay behind `src/application/policy-administration` interfaces?
4. Are shared DTO/schema contracts updated when payload shape changed?
5. Are `.md` and `.ai.md` docs updated together?
6. Are domain/application/policy-administration tests updated for new policy behavior?
