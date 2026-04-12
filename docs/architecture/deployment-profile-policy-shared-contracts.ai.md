# AI Companion: Deployment Profile Policy Shared Contracts

## Purpose

Story 20.1.2 adds canonical shared deployment-policy administration contracts so profile policy read/validate/update payloads are stable, versioned, and schema-validated across application/API/admin surfaces.

## Human doc

- `docs/architecture/deployment-profile-policy-shared-contracts.md`

## Canonical files

- `src/shared/contracts/deployment/DeploymentPolicyAdministrationContracts.ts`
- `src/shared/dto/deployment/DeploymentPolicyAdministrationDtos.ts`
- `src/shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts.ts`
- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`

## Added contract coverage

- profile preset metadata lineage (`home -> classroom -> organization`),
- family/setting effective values with control mode + source provenance,
- typed scalar value metadata (`string`/`number`/`boolean`),
- admin override command operations (`upsert`/`remove`) and provenance,
- validation issue/outcome envelopes,
- canonical read/validate/update DTO envelopes.

## Schema guarantees

`DeploymentPolicyAdministrationSchemaContracts` validates:

- profile id vocabulary,
- snapshot/profile consistency,
- setting valueType/value scalar consistency,
- operation semantics (`upsert` requires value, `remove` forbids value),
- summary integrity (source/control-mode totals match setting count).

## Migration posture

Application policy snapshot evaluation now emits shared contract snapshot types/constants from:

- `src/application/deployment/DeploymentPolicyAdministrationContracts.ts`

This removes local policy snapshot DTO drift and establishes shared contract ownership for policy administration payloads.

## Tests added

- `src/shared/contracts/deployment/tests/DeploymentPolicyAdministrationContracts.test.ts`
- `src/shared/dto/deployment/tests/DeploymentPolicyAdministrationDtos.test.ts`
- `src/shared/schemas/deployment/tests/DeploymentPolicyAdministrationSchemaContracts.test.ts`
- `src/application/deployment/tests/DeploymentPolicySharedContractsDocumentation.test.ts`
