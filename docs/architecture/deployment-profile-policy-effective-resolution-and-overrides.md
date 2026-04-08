# Deployment Profile Effective Policy Resolution and Admin Overrides

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.5: Implement effective-policy resolution with preset defaults and admin overrides

## Purpose

Centralize effective-policy resolution so deployment-profile behavior is deterministic, explicit, and queryable from one application seam.  
The resolver combines profile preset defaults with persisted admin override records, applies scope/control/value validation, and returns effective values with per-setting provenance.

## Canonical files

- Centralized resolver and override validation:
  - `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- Application contract entrypoints that delegate to the resolver:
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- Policy taxonomy/preset definitions consumed by the resolver:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Tests:
  - `src/application/deployment/tests/DeploymentPolicyEffectiveResolutionService.test.ts`
  - `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`

## Effective-resolution behavior

`resolveDeploymentPolicyEffectiveState(...)` is the authoritative resolver:

1. Resolve inherited preset values for the selected deployment profile.
2. Validate persisted admin override records against:
   - profile scope targeting,
   - known family/setting taxonomy,
   - control-mode permissions (`profile-fixed` cannot be overridden),
   - setting value constraints (type/enum/range).
3. Build normalized admin state from only valid overrides.
4. Compose effective settings by precedence:
   - profile preset value (if present),
   - policy default value (fallback),
   - valid admin override value (highest precedence).
5. Emit per-setting provenance:
   - source (`profile-preset`, `policy-default`, `admin-state`),
   - admin override provenance metadata when source is `admin-state`.

## Structured validation and rejection

`validateDeploymentPolicyAdminOverrideRecords(...)` returns structured validation outcomes and rejects invalid or out-of-scope override records without applying them.  
Issue codes include:

- `override-scope-mismatch`
- `unknown-family`
- `unknown-setting`
- `profile-fixed-override-denied`
- `invalid-value-kind`

Rejected records are excluded from normalized admin state and therefore excluded from the effective snapshot.

## Reuse boundary

`evaluateDeploymentPolicyAdministrationSnapshot(...)` now delegates to the centralized resolver service.  
Any future policy-admin API/read-model/update surface should call this same seam rather than re-implementing merge/validation logic.
