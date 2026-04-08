# Deployment Profile and Policy Administration Foundation

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.1: Define the canonical deployment-profile and policy administration architecture

## Purpose

Establish one canonical architecture for deployment profiles (`home`, `classroom`, `organization`) and policy administration so policy behavior stays explicit, auditable, and layer-safe without forking the platform.

This story defines:

- canonical deployment-profile concepts and inheritance rules,
- policy family taxonomy and control modes,
- the boundary between static profile defaults and mutable runtime admin state,
- and policy evaluation layer boundaries (what is allowed and what is prohibited).

## Canonical files

- Domain model and validation:
  - `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- Application contracts and evaluation boundary:
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- Tests:
  - `src/domain/deployment/tests/DeploymentProfilePolicyAdministrationDomain.test.ts`
  - `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`

## Core domain model

`DeploymentProfilePolicyAdministrationDomain` introduces canonical profile and policy taxonomy primitives:

- canonical profile ids:
  - `home`
  - `classroom`
  - `organization`
- policy control modes:
  - `profile-fixed`: profile-governed and never admin-overridable
  - `profile-default-admin-overridable`: profile default with runtime admin override support
  - `runtime-admin`: runtime-admin managed setting (not configurable in profile presets)
- family catalog + preset catalog validation:
  - family/setting id normalization,
  - type-safe override values,
  - preset parent validation,
  - inheritance cycle prevention,
  - runtime-admin preset override prevention.

## Policy family taxonomy (canonical baseline)

The canonical baseline catalog defines these families for Feature 20:

1. `approval-governance`
2. `sharing-posture`
3. `storage-governance`
4. `security-governance`
5. `admin-controls`
6. `audit-governance`

Each family has explicit setting-level control mode so contributors can tell whether a setting is profile-governed or runtime-admin mutable.

## Profile inheritance and override rules

Canonical profile inheritance chain:

1. `home` (root preset)
2. `classroom` (inherits `home`, tightens governance)
3. `organization` (inherits `classroom`, enforces stricter defaults)

Override rules:

- Profile presets may override `profile-fixed` and `profile-default-admin-overridable` settings.
- Profile presets may not override `runtime-admin` settings.
- Runtime admin state may override only `profile-default-admin-overridable` and `runtime-admin` settings.
- Runtime admin state may never override `profile-fixed` settings.

This creates explicit separation between profile-controlled posture and mutable policy operations.

## Static defaults vs mutable admin state

`DeploymentPolicyAdministrationContracts` defines the authoritative merge behavior:

1. Start from profile preset effective values (resolved through inheritance).
2. Fall back to family setting defaults when no preset value exists.
3. Apply runtime admin state overrides only where control mode permits it.
4. Emit a resolved snapshot with per-setting source attribution:
   - `profile-preset`
   - `policy-default`
   - `admin-state`

That snapshot is the canonical policy read-model for downstream use cases.

## Evaluation boundaries

Policy evaluation is allowed only in:

- `src/domain` (invariants and policy taxonomy semantics),
- `src/application` (effective policy snapshot resolution and orchestration).

Policy evaluation is prohibited in:

- `src/ui`,
- transport handlers and endpoint wiring,
- infrastructure adapter default logic.

`DeploymentPolicyEvaluationRequestLayers` and the snapshot evaluator enforce this boundary by rejecting evaluation requests from `ui`, `transport`, and `infrastructure`.

## Prohibited shortcuts

The following are explicitly non-compliant:

- Embedding deployment-profile policy branching directly in page components, React state stores, or route handlers.
- Hard-coding home/classroom/organization behavior in HTTP handlers, IPC handlers, or DTO mappers.
- Encoding profile-specific policy decisions in storage adapters, transport adapters, or runtime adapter defaults.
- Treating admin overrides as untyped key/value blobs without family/setting catalog validation.

## Extension guidance for future policy families

When adding a new policy family:

1. Add the family and typed settings in `createCanonicalDeploymentPolicyFamilyCatalog(...)`.
2. Choose explicit control mode per setting (`profile-fixed`, `profile-default-admin-overridable`, `runtime-admin`).
3. Add profile preset values in `createCanonicalDeploymentProfilePresetCatalog(...)` only for non-`runtime-admin` settings.
4. Add domain tests for invariants (ids, control mode constraints, preset inheritance and overrides).
5. If the family requires admin overrides, add application tests for snapshot source attribution and boundary behavior.
6. Keep policy evaluation in domain/application seams; do not add UI/transport/infrastructure evaluation branches.

## Verification baseline

- `src/domain/deployment/tests/DeploymentProfilePolicyAdministrationDomain.test.ts`
- `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
