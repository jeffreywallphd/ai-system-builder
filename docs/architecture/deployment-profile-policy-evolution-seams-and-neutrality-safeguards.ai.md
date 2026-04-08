# AI Companion: Deployment Profile Evolution Seams and Neutrality Safeguards

## Purpose

Story 20.3.6 validates that deployment-policy administration keeps neutral architecture seams across home/classroom/organization and does not bake hidden home-only assumptions into admin/read/evaluation workflows.

## Human doc

- `docs/architecture/deployment-profile-policy-evolution-seams-and-neutrality-safeguards.md`

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`

## Delivery summary

- Keeps canonical profile posture in domain preset definitions (no UI/transport profile branching).
- Makes fallback profile behavior explicit through dependency seams:
  - bootstrap resolution uses `fallbackProfileId`,
  - read workflow uses `defaultProfileId`,
  - authoritative update workflow uses `defaultProfileId`.
- Ensures dry-run mutation snapshots respect requested `set-active-profile` operations instead of defaulting to home behavior.
- Adds neutrality tests for non-home fallback behavior and operation-driven profile resolution.

## Scope guardrails

- No new placeholder policy families are introduced.
- No fake classroom/organization runtime features are claimed.
- Scope remains validation and hardening of existing deployment-profile administration seams.
