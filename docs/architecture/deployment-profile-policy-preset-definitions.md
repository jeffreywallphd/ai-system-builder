# Deployment Profile Built-In Preset Definitions

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.4: Implement built-in home, classroom, and organization preset definitions

## Purpose

Provide canonical production preset definitions for `home`, `classroom`, and `organization` so policy defaults remain explicit, explainable, and centralized while preserving one shared architecture.

## Canonical files

- Domain preset definitions and catalog wiring:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Application effective-default evaluation seam:
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- Tests:
  - `src/domain/deployment/tests/DeploymentProfilePresetDefinitions.test.ts`
  - `src/application/deployment/tests/DeploymentPolicyEffectiveDefaults.test.ts`
  - `src/application/deployment/tests/DeploymentPolicyPresetDefinitionsDocumentation.test.ts`

## Built-in preset-definition model

`createCanonicalDeploymentProfilePresetDefinitions()` is the canonical source for built-in profile presets.  
Each preset definition includes:

- `profileId` and optional `parentProfileId`,
- profile `scope` summary,
- profile `rationale` statement,
- data-driven `policyOverrides` for the supported policy families.

`createCanonicalDeploymentProfilePresetCatalog(...)` consumes these definitions and normalizes them into the validated preset catalog used by evaluation services.

## Canonical built-in presets

### `home`

- Scope: personal/family-managed usage with low-friction defaults.
- Baseline posture:
  - less strict approval mode (`self-or-owner`),
  - permissive sharing (`publicLinkSharingAllowed: true`),
  - local-first storage tier (`local-managed`),
  - longer credential rotation window (`180` days),
  - reduced admin process requirements.

### `classroom`

- Scope: instructor-governed collaboration.
- Baseline posture:
  - approval escalates to instructor (`owner-or-instructor`),
  - public links disabled and cross-workspace sharing requires approval,
  - workspace-managed storage by default,
  - tighter credential rotation (`120` days),
  - stricter admin/audit defaults than home.

### `organization`

- Scope: organization-wide governed deployments.
- Baseline posture:
  - admin-anchored approval (`owner-or-admin`),
  - strict sharing posture inherited and made explicit,
  - server-managed storage default,
  - tightest credential rotation (`90` days),
  - enterprise-oriented admin and audit controls.

## Effective-default behavior

- Each preset explicitly defines non-`runtime-admin` defaults across all supported policy families.
- `runtime-admin` settings remain profile-independent defaults until runtime admin state overrides them.
- Effective values are resolved through `evaluateDeploymentPolicyAdministrationSnapshot(...)`, producing auditable source attribution (`profile-preset` vs `policy-default` vs `admin-state`).

## Guardrail

Profile behavior differences are encoded in canonical preset data, not scattered environment conditionals in UI, transport, or infrastructure layers.
