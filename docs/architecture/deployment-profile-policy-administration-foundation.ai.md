# AI Companion: Deployment Profile and Policy Administration Foundation

## Purpose

Story 20.1.1 introduces the canonical deployment-profile policy architecture so home/classroom/organization profiles share one platform while policy posture remains explicit, auditable, and layer-safe.

## Canonical files

- `src/domain/deployment/DeploymentProfilePolicyAdministrationDomain.ts`
- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`
- `src/domain/deployment/tests/DeploymentProfilePolicyAdministrationDomain.test.ts`
- `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
- `docs/architecture/deployment-profile-policy-administration-foundation.md`

## Core model decisions

- Canonical deployment profiles:
  - `home`
  - `classroom`
  - `organization`
- Canonical policy control modes:
  - `profile-fixed`
  - `profile-default-admin-overridable`
  - `runtime-admin`
- Canonical policy family baseline:
  - `approval-governance`
  - `sharing-posture`
  - `storage-governance`
  - `security-governance`
  - `admin-controls`
  - `audit-governance`

## Inheritance and override rules

- Preset chain is explicit: `home -> classroom -> organization`.
- Presets can override only non-`runtime-admin` settings.
- Runtime admin state can override only:
  - `profile-default-admin-overridable`
  - `runtime-admin`
- Runtime admin state cannot override `profile-fixed` settings.

## Evaluation boundary

Effective policy resolution is allowed only in:

- `domain` seams (policy taxonomy/invariants),
- `application` seams (snapshot composition).

Effective policy resolution is rejected from:

- `ui`,
- `transport`,
- `infrastructure`.

This prevents profile policy logic from drifting into page code, handler code, and adapter defaults.

## Snapshot model

`evaluateDeploymentPolicyAdministrationSnapshot(...)` returns a resolved policy snapshot with per-setting source attribution:

- `profile-preset`
- `policy-default`
- `admin-state`

This makes policy provenance explicit for auditability and future admin UX.

## Extension point

New policy families plug in by extending:

1. `createCanonicalDeploymentPolicyFamilyCatalog(...)`
2. `createCanonicalDeploymentProfilePresetCatalog(...)`

and adding matching domain/application tests for:

- id/control-mode validity,
- preset inheritance and cycle safety,
- admin override allow/deny behavior,
- layer-boundary enforcement.
