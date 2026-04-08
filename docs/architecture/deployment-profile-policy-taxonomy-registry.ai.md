# AI Companion: Deployment Profile Policy Taxonomy and Configuration Registry

## Purpose

Story 20.1.3 adds a central, typed policy taxonomy + configuration registry so deployment-profile policy families, setting kinds, validation rules, and profile-default relationships are modeled once and reused everywhere.

## Human doc

- `docs/architecture/deployment-profile-policy-taxonomy-registry.md`

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`

## What this story adds

- first-production policy family taxonomy with explicit family scopes,
- setting-level value kinds (`string`/`number`/`boolean`),
- explicit validation rules (`enum`, `number-range`) attached to setting definitions,
- canonical registry constructor `createCanonicalDeploymentPolicyConfigurationRegistry()` exposing:
  - family catalog,
  - preset catalog,
  - resolved `profileDefaults` for home/classroom/organization inheritance.

## Validation seam

`validateDeploymentPolicySettingValue(...)` is now the canonical setting validation hook and is reused by:

- preset override normalization,
- runtime admin override state creation in application policy contracts.

This prevents policy rule duplication in admin APIs and UI forms.

## Baseline tests

- `src/domain/deployment/tests/DeploymentProfilePolicyAdministrationDomain.test.ts`
- `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
- `src/application/deployment/tests/DeploymentPolicyTaxonomyRegistryDocumentation.test.ts`
