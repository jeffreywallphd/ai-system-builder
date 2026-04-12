# AI Companion: Deployment Profile Effective Policy Resolution and Admin Overrides

## Purpose

Story 20.1.5 centralizes effective-policy resolution for deployment profiles so policy values are deterministic, explainable, and reusable across policy-admin surfaces.

## Human doc

- `docs/architecture/deployment-profile-policy-effective-resolution-and-overrides.md`

## Canonical files

- `src/application/deployment/DeploymentPolicyEffectiveResolutionService.ts`
- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`

## What this story adds

- centralized resolver: `resolveDeploymentPolicyEffectiveState(...)`,
- persisted override validation seam: `validateDeploymentPolicyAdminOverrideRecords(...)`,
- explicit override record model with profile scope and provenance metadata,
- structured rejection of invalid/out-of-scope overrides with machine-readable validation issues,
- deterministic override precedence (last valid override record per setting wins),
- per-setting source attribution plus admin provenance when effective source is `admin-state`.

## Integration behavior

- `evaluateDeploymentPolicyAdministrationSnapshot(...)` now delegates to the centralized resolver.
- `resolveDeploymentPolicyAdministrationSnapshotWithOverrides(...)` exposes override-record based resolution and validation.
- Existing domain policy taxonomy and preset catalogs remain authoritative for setting definitions, control modes, and validation rules.

## Tests

- `src/application/deployment/tests/DeploymentPolicyEffectiveResolutionService.test.ts`
- `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
