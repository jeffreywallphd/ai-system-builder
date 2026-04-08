# AI Companion: Deployment Profile Policy Authoritative Read APIs

## Purpose

Story 20.2.4 adds authoritative read pathways for deployment-policy administration state so admin and system consumers can inspect active profile, effective policy values, preset/family metadata, and override provenance through server APIs instead of direct config access.

## Human doc

- `docs/architecture/deployment-profile-policy-authoritative-read-apis.md`

## Canonical files

- `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
- `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
- `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Endpoint and behavior summary

- Endpoint: `GET /api/v1/deployment/policy/state`
- Auth model: authenticated workspace session; workspace-scoped read semantics
- Query options:
  - `profileId` (`home` | `classroom` | `organization`)
  - `includeCatalog`
  - `includeOverrideRecords`
  - `includeEffectiveMetadata`
  - `evaluatedAt`

Response includes:

- `activeProfile` with explicit source (`persisted-selection` or `default-fallback`)
- effective `snapshot` + `validation`
- optional `overrideRecords` with provenance
- optional `effectiveMetadata`
- optional canonical `catalog` (presets + policy families/settings)

## Integration/test coverage

- `src/application/policy-administration/tests/ReadDeploymentPolicyAdministrationUseCase.test.ts`
- `src/infrastructure/api/deployment/tests/DeploymentPolicyReadBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerDeploymentPolicyReadApi.test.ts`
- `src/shared/contracts/deployment/tests/DeploymentPolicyReadContracts.test.ts`
- `src/shared/schemas/deployment/tests/DeploymentPolicyReadSchemaContracts.test.ts`
