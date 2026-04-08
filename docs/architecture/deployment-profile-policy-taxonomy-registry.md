# Deployment Profile Policy Taxonomy and Configuration Registry

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.3: Implement the policy taxonomy and configuration registry for the first production scope

## Purpose

Define one production-ready policy taxonomy and configuration registry for deployment profiles so home, classroom, and organization policy defaults are centralized, typed, validated, and reusable across evaluation logic, admin APIs, and UI forms.

## Canonical files

- Domain taxonomy + registry:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Application consumption seam:
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- Tests:
  - `src/domain/deployment/tests/DeploymentProfilePolicyAdministrationDomain.test.ts`
  - `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
  - `src/application/deployment/tests/DeploymentPolicyTaxonomyRegistryDocumentation.test.ts`

## First production taxonomy

The canonical taxonomy includes these policy families:

1. `approval-governance`
2. `sharing-posture`
3. `storage-governance`
4. `security-governance`
5. `admin-controls`
6. `audit-governance`

Each family now includes an explicit scope descriptor:

- `run-submission`
- `sharing`
- `storage`
- `security`
- `administration`
- `audit`

## Setting model and validation rules

Each policy setting is modeled with:

- `controlMode` (`profile-fixed`, `profile-default-admin-overridable`, `runtime-admin`),
- `valueKind` (`string`, `number`, `boolean`),
- explicit `validationRules` (enumerated allowed values and number ranges),
- a canonical `defaultValue` validated against those rules.

Validation is centralized through `validateDeploymentPolicySettingValue(...)` and reused by:

- profile preset normalization,
- runtime admin override state creation,
- any downstream consumer resolving setting definitions.

## Configuration registry contract

`createCanonicalDeploymentPolicyConfigurationRegistry()` provides one reusable registry object containing:

- the normalized family catalog,
- the canonical home/classroom/organization preset catalog,
- resolved profile-default policy values (`profileDefaults`) that encode profile relationships and inheritance.

This keeps profile-default relationships explicit and avoids duplicating policy-definition details in admin APIs, UI forms, and application orchestration.

## Authoritative boundaries

Policy taxonomy ownership remains in `domain`.
Application services consume the registry and validation seams; they do not redefine allowed values or numeric ranges.
UI/transport/infrastructure layers should reference registry metadata through domain/application seams instead of embedding raw policy constants.

## Extension workflow

When adding a new policy family or setting:

1. Extend `createCanonicalDeploymentPolicyFamilyCatalog(...)` with scope, `valueKind`, and validation rules.
2. Add/adjust profile defaults in `createCanonicalDeploymentProfilePresetDefinitions(...)` (consumed by `createCanonicalDeploymentProfilePresetCatalog(...)`).
3. Verify profile relationships via `createCanonicalDeploymentPolicyConfigurationRegistry()`.
4. Add domain tests for allowed/disallowed values and range rules.
5. Add application tests proving admin override validation follows taxonomy rules.
