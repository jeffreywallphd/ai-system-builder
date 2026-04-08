# Deployment Profile Policy Invariants and Extension Rules

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.7: Document deployment-profile invariants and contributor extension rules

## Purpose

Document the non-negotiable deployment-profile policy invariants, effective-value resolution model, and contributor extension workflow so home/classroom/organization environments continue to share one architecture without profile-specific forks.

## Canonical implemented seams

- Domain taxonomy, profile ids, control modes, and preset definitions:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Application snapshot boundary and override eligibility enforcement:
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- Application effective-resolution + persisted override validation:
  - `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- Feature-facing policy evaluation interfaces and typed decisions:
  - `src/application/policy-administration/DeploymentPolicyEvaluationContracts.ts`
  - `src/application/policy-administration/DeploymentPolicyEvaluationPorts.ts`
  - `src/application/policy-administration/DeploymentPolicyEvaluationService.ts`
  - `src/application/policy-administration/CanonicalDeploymentPolicySnapshotResolver.ts`
- Shared policy snapshot/update/schema contracts:
  - `src/shared/contracts/deployment/DeploymentPolicyAdministrationContracts.ts`
  - `src/shared/dto/deployment/DeploymentPolicyAdministrationDtos.ts`
  - `src/shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts.ts`

## Deployment profile philosophy

- One architecture, three governed postures: `home`, `classroom`, `organization`.
- Profile behavior is encoded as data (preset lineage + setting overrides), not as per-profile conditionals spread across feature modules.
- Policy decisions are requested through application policy seams, and every resolved setting keeps source attribution (`profile-preset`, `policy-default`, `admin-state`).
- Profile-specific strictness should be explainable from canonical family/setting metadata plus preset lineage.

## Supported policy families

Canonical baseline families in this scope:

1. `approval-governance`
2. `sharing-posture`
3. `storage-governance`
4. `security-governance`
5. `admin-controls`
6. `audit-governance`

Each family is defined with explicit setting-level control modes:

- `profile-fixed`
- `profile-default-admin-overridable`
- `runtime-admin`

## Preset-versus-override model

### Preset inheritance chain

1. `home` is the root preset.
2. `classroom` inherits from `home`.
3. `organization` inherits from `classroom`.

### Override eligibility invariants

- Presets may override only non-`runtime-admin` settings.
- Runtime admin state/override records may override only `profile-default-admin-overridable` and `runtime-admin` settings.
- `profile-fixed` settings are never runtime-admin overridable.

## Effective-value resolution invariants

The canonical effective-value order is:

1. Inherited profile preset value (if present)
2. Setting default from family catalog
3. Valid runtime admin override

Validation invariants applied before overrides are accepted:

- known profile/family/setting identifiers,
- profile-scope match for override records,
- control-mode eligibility,
- scalar kind and rule validation (`enum`, `number-range`).

Canonical entrypoints:

- `resolveDeploymentPolicyEffectiveState(...)`
- `validateDeploymentPolicyAdminOverrideRecords(...)`
- `evaluateDeploymentPolicyAdministrationSnapshot(...)`
- `resolveDeploymentPolicyAdministrationSnapshotWithOverrides(...)`

## Feature policy-consumption pattern

Future features should request policy decisions through explicit application interfaces instead of reading raw profile catalogs.

Example:

```ts
import type {
  IDeploymentStoragePolicyEvaluationPort,
  IDeploymentSecurityPolicyEvaluationPort,
} from "@application/policy-administration/DeploymentPolicyEvaluationPorts";

export class StorageProvisioningUseCase {
  public constructor(
    private readonly storagePolicy: IDeploymentStoragePolicyEvaluationPort,
    private readonly securityPolicy: IDeploymentSecurityPolicyEvaluationPort,
  ) {}

  public async execute(profileId: "home" | "classroom" | "organization") {
    const storage = await this.storagePolicy.evaluateStoragePolicy({ profileId });
    const security = await this.securityPolicy.evaluateSecurityPolicy({ profileId });

    return {
      tier: storage.defaultStorageTier.value,
      retentionDays: storage.retentionDaysDefault.value,
      encryptionRequired: security.encryptionAtRestRequired.value,
    };
  }
}
```

This keeps consumers policy-aware while preserving policy-definition ownership in domain/application seams.

## Extension rules

### Adding a new policy family

1. Add family and setting definitions in `createCanonicalDeploymentPolicyFamilyCatalog(...)`.
2. Assign control mode and validation rules per setting.
3. Add or update profile preset values in `createCanonicalDeploymentProfilePresetDefinitions(...)` for allowed settings.
4. Verify catalog and preset normalization via `createCanonicalDeploymentPolicyConfigurationRegistry()`.
5. Add domain tests for taxonomy ids, default validity, rule validation, and preset constraints.
6. Add application tests for effective-value resolution and override-accept/reject behavior.

### Adding or changing policy evaluation logic for features

1. Extend typed setting-path constants and decision contracts in `DeploymentPolicyEvaluationContracts.ts`.
2. Add/adjust evaluation interfaces in `DeploymentPolicyEvaluationPorts.ts`.
3. Implement decision shaping in `DeploymentPolicyEvaluationService.ts`.
4. Keep canonical snapshot resolution in `CanonicalDeploymentPolicySnapshotResolver.ts`.
5. Add contract tests proving consumers can depend on interface-level decisions without raw catalog access.

## Evaluation boundary and prohibited patterns

Policy evaluation is allowed only in `domain` and `application` seams.

Embedding profile-specific branching directly in UI components is prohibited.
Embedding profile-specific branching directly in transport handlers is prohibited.
Embedding profile-specific branching directly in backend adapters is prohibited.

Also prohibited:

- reading preset catalogs directly from feature UI/state modules,
- bypassing `DeploymentPolicyEvaluationService` with duplicated family/setting merge logic,
- storing unvalidated admin override blobs outside typed shared contracts,
- adding profile-id conditionals in feature code where policy-evaluation ports should decide behavior.

## Verification baseline

- `src/domain/deployment/tests/DeploymentProfilePolicyAdministrationDomain.test.ts`
- `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
- `src/application/deployment/tests/DeploymentPolicyEffectiveResolutionService.test.ts`
- `src/application/policy-administration/tests/DeploymentPolicyEvaluationService.test.ts`
- `src/application/policy-administration/tests/DeploymentPolicyEvaluationServiceContracts.test.ts`
