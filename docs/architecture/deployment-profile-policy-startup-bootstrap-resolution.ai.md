# AI Companion: Deployment Profile Policy Startup Bootstrap Resolution

## Purpose

Story 20.2.7 adds authoritative startup/bootstrap resolution for deployment-policy state so runtime policy behavior initializes from canonical persisted profile/override records, not ad hoc defaults.

## Human doc

- `docs/architecture/deployment-profile-policy-startup-bootstrap-resolution.md`

## Canonical files

- `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/application/configuration/tests/DeploymentPolicyBootstrapResolutionService.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`

## Delivery summary

- Adds one bootstrap-resolution service that:
  - loads persisted active profile + overrides for supported deployment-policy scope,
  - applies deterministic `home` fallback when active-profile selection is missing,
  - validates persisted overrides against canonical registry,
  - resolves effective snapshot for runtime initialization,
  - returns prepared policy-evaluation seam dependencies.
- Authoritative composition root now resolves deployment-policy bootstrap state during persistence stage and requires that artifact before feature registration.
- Runtime host wiring now consumes resolved policy seam for:
  - workspace creation visibility defaults,
  - run-submission approval prerequisite policy checks.

## Failure model

- Invalid persisted state is explicit and startup-fatal through `DeploymentPolicyBootstrapResolutionError` (`invalid-persisted-state`) with structured validation metadata.
- Missing persisted active-profile selection is explicit deterministic fallback (`default-fallback` to `home`), not implicit transport/UI defaults.
