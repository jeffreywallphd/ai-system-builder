# AI Companion: Deployment Profile Built-In Preset Definitions

## Purpose

Story 20.1.4 introduces canonical built-in preset definitions for `home`, `classroom`, and `organization` so profile policy defaults are explicit and explainable without architecture forks.

## Human doc

- `docs/architecture/deployment-profile-policy-preset-definitions.md`

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`

## What this story adds

- canonical preset-definition layer: `createCanonicalDeploymentProfilePresetDefinitions()`,
- explicit profile metadata (`scope`, `rationale`) for each built-in profile,
- explicit profile policy overrides across all supported families for non-`runtime-admin` settings,
- canonical mapping from definitions into validated preset catalog via `createCanonicalDeploymentProfilePresetCatalog(...)`.

## Explainable profile posture

- `home`: low-friction personal defaults with permissive sharing and local-first storage.
- `classroom`: instructor-governed collaboration defaults with tighter sharing and approval controls.
- `organization`: strict organization-wide defaults with admin-centric approval and server-managed storage.

## Effective-default validation

`evaluateDeploymentPolicyAdministrationSnapshot(...)` remains the authoritative effective-default seam and now consumes presets produced from the built-in definitions.  
Runtime-admin settings continue to resolve from policy defaults unless runtime admin state overrides them.
