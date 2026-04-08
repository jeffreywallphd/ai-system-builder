# Deployment Profile Policy Startup Bootstrap Resolution

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.2: Build Persistent Policy Storage, Evaluation Integration, and Authoritative Administration APIs
- Story 20.2.7: Implement deployment-profile startup/bootstrap resolution for the authoritative server

## Purpose

Provide one authoritative startup/bootstrap workflow that resolves active deployment profile selection and effective policy state from persisted records before runtime feature registration.

This keeps policy behavior deterministic and auditable at startup boundaries and avoids scattered default-policy branching in host wiring.

## Canonical files

- Application bootstrap-resolution service:
  - `src/application/configuration/DeploymentPolicyBootstrapResolutionService.ts`
- Authoritative host bootstrap composition:
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- Runtime host policy seam consumption:
  - `src/hosts/server/IdentityServerHost.ts`
- Tests:
  - `src/application/configuration/tests/DeploymentPolicyBootstrapResolutionService.test.ts`
  - `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`

## Startup resolution workflow

1. During authoritative host persistence-stage bootstrap, resolve deployment-policy bootstrap state from repository-backed persisted data.
2. Resolve active profile selection for supported deployment-policy scope (`deployment-policy-scope` with default scope id `platform:default`).
3. If no persisted active-profile selection exists, apply explicit deterministic fallback to `home`.
4. Load current override records for the resolved active profile and validate records against canonical policy taxonomy/setting constraints.
5. Build effective policy snapshot and validation result through application-layer resolver seams.
6. Publish one bootstrap artifact that includes:
   - resolved active profile/source,
   - validated override records,
   - resolved effective snapshot,
   - runtime evaluation context resolver,
   - prepared policy evaluation service.
7. Inject bootstrap artifact into runtime host composition so dependent services can consume policy-evaluation seams immediately.

## Failure behavior

Invalid persisted policy state is startup-fatal and explicit:

- bootstrap raises `DeploymentPolicyBootstrapResolutionError` with code `invalid-persisted-state`,
- failure metadata includes scope, resolved active profile, and structured validation issues,
- authoritative host composition fails before feature registration, so runtime does not start with ambiguous policy behavior.

Missing persisted active-profile selection is not fatal:

- startup applies deterministic `home` fallback,
- active-profile source is marked `default-fallback`,
- effective policy still resolves through canonical registry + resolver seams.

## Runtime seam integration

After bootstrap resolution, authoritative runtime wiring injects the resolved policy seam into existing dependent use cases:

- workspace creation default visibility evaluation (`CreateWorkspaceUseCase`),
- run-submission scheduling approval prerequisite evaluation (`ValidateRunSubmissionUseCase`).

This keeps dependent modules on `IDeployment*PolicyEvaluationPort` interfaces and avoids direct persistence/profile catalog access.
