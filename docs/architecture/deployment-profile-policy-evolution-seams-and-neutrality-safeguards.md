# Deployment Profile Evolution Seams and Neutrality Safeguards

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.3: Deliver Policy Administration Surfaces, Safe Admin Controls, and Production Hardening
- Story 20.3.6: Validate future deployment-profile evolution seams and non-home bias safeguards

## Purpose

Validate that deployment-policy administration behavior remains structurally neutral across `home`, `classroom`, and `organization`, and that future profile growth can be introduced through explicit domain/application seams without reworking transport, UI, or persistence adapters.

This story does not add new policy families or pretend profile-specific runtime features that are not implemented.

## Canonical files

- Canonical profile ids, taxonomy, and preset lineage:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Startup fallback seam (configurable default profile):
  - `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- Authoritative mutation workflow snapshot-profile resolution seam:
  - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- Authoritative read workflow fallback seam:
  - `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- Tests:
  - `src/application/configuration/tests/DeploymentPolicyBootstrapResolutionService.test.ts`
  - `src/application/policy-administration/tests/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.test.ts`
  - `src/application/policy-administration/tests/ReadDeploymentPolicyAdministrationUseCase.test.ts`

## Validated evolution seams

1. Profile defaults remain data-driven in canonical preset definitions (`home -> classroom -> organization`) and are not re-encoded in feature modules.
2. Startup bootstrap fallback profile is an explicit dependency seam (`fallbackProfileId`) rather than an implicit transport/UI assumption.
3. Authoritative read workflows use an explicit default-profile dependency seam (`defaultProfileId`) for environments that need a non-home default.
4. Authoritative mutation workflows resolve effective snapshot profile from requested operations first (including dry-run `set-active-profile`) and then configured fallback seams.

## Neutrality safeguards

- No policy-evaluation logic is moved into UI, transport handlers, or persistence adapters.
- No policy family is added as a placeholder for classroom/organization-specific behavior that does not yet exist.
- Non-home behavior is exercised by tests using configured fallback seams and requested profile operations.
- Canonical profile chain remains explicit and versionable in the domain, while runtime defaults are host/application-configurable.

## Current explicit limits

- Supported canonical profile ids remain `home`, `classroom`, and `organization` for this story.
- Mutation scope kind remains `deployment-policy-scope`.
- This story validates seams and neutrality only; it does not introduce new profile-specific enforcement families.
