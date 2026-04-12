# Deployment Profile Policy Shared Contracts

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.1: Establish the Deployment Profile Domain, Policy Taxonomy, and Configuration Foundations
- Story 20.1.2: Create shared deployment-profile and policy configuration contracts

## Purpose

Provide one shared contract package for deployment-profile policy administration so application services, APIs, and admin surfaces use stable read/validate/update shapes with schema-backed validation and explicit policy provenance.

## Canonical files

- Shared contracts:
  - `src/shared/contracts/deployment/DeploymentPolicyAdministrationContracts.ts`
- Shared DTOs:
  - `src/shared/dto/deployment/DeploymentPolicyAdministrationDtos.ts`
- Shared schemas:
  - `src/shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts.ts`
- Application consumption seam:
  - `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`

## Contract model

The shared contract package defines canonical shapes for:

- profile identifiers and preset metadata lineage,
- policy family/setting effective values,
- value typing (`string` | `number` | `boolean`) for every resolved setting,
- resolution provenance (`profile-preset`, `policy-default`, `admin-state`),
- admin override update commands (`upsert`/`remove`) and optional provenance,
- validation issue/outcome envelopes,
- read/validate/update request/response envelopes.

## Canonical read/validate/update surfaces

- Read:
  - `ReadDeploymentPolicyAdministrationRequest` / `ReadDeploymentPolicyAdministrationResponse`
- Validate:
  - `ValidateDeploymentPolicyAdministrationRequest` / `ValidateDeploymentPolicyAdministrationResponse`
- Update:
  - `UpdateDeploymentPolicyAdministrationRequest` / `UpdateDeploymentPolicyAdministrationResponse`
- Patch state (authoritative replace):
  - `PatchDeploymentPolicyAdministrationStateRequestDto` / `PatchDeploymentPolicyAdministrationStateResponseDto`

All transport-facing payloads are schema-validated in:

- `DeploymentPolicyAdministrationSchemaContracts.ts`

## Effective policy snapshot guarantees

`DeploymentPolicyAdministrationSnapshot` is versioned (`deployment-policy-administration/v1`) and includes:

- profile id and evaluation timestamp/layer,
- preset lineage metadata,
- family/setting effective values with control mode and source attribution,
- computed summary counts by source and control mode.

This keeps policy read models auditable and stable across UI, API, and application services.

## Validation behavior

Schema parsing enforces:

- canonical profile ids (`home`, `classroom`, `organization`),
- update-operation semantics (`upsert` requires value, `remove` forbids value),
- scalar value and value-type consistency,
- snapshot/profile consistency,
- summary count integrity.

Validation failures produce structured issues via:

- `DeploymentPolicyAdministrationSchemaValidationError`

## Migration posture

`src/application/deployment/DeploymentPolicyAdministrationContracts.ts` now consumes shared deployment-policy contract types/constants and emits the shared snapshot model directly. This removes local snapshot-shape drift and marks shared contracts as the canonical ownership seam for policy administration payloads.

## Tests

- `src/shared/contracts/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
- `src/shared/dto/deployment/tests/DeploymentPolicyAdministrationDtos.test.ts`
- `src/shared/schemas/deployment/tests/DeploymentPolicyAdministrationSchemaContracts.test.ts`
- `src/application/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
- `src/application/deployment/tests/DeploymentPolicySharedContractsDocumentation.test.ts`
