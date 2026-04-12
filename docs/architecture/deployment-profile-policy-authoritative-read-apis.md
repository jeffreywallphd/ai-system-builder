# Deployment Profile Policy Authoritative Read APIs

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.2: Build Persistent Policy Storage, Evaluation Integration, and Authoritative Administration APIs
- Story 20.2.4: Implement policy-read APIs for admin and system consumers

## Purpose

Expose authoritative read-only deployment-policy administration APIs so admin and system consumers can inspect active profile selection, effective policy state, preset/family metadata, and override provenance without direct repository/config access.

## Canonical files

- Shared read transport and response contracts:
  - `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
- Shared read request/response schema validation:
  - `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
- Application read query use case:
  - `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- Backend API adapter:
  - `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- Authoritative route-family registration:
  - `src/infrastructure/transport/http-server/authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- HTTP route handling and host wiring:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - `src/hosts/server/IdentityServerHost.ts`

## Authoritative endpoint surface

- Canonical read endpoint:
  - `GET /api/v1/deployment/policy/state`
- Route constant:
  - `DeploymentPolicyReadTransportRoutes.readState`
- Required request scope:
  - authenticated workspace session
  - workspace-scoped read (`workspaceId` query)
  - policy read permission (`deployment-policy.state.read`)

Supported query options:

- `profileId`: optional (`home` | `classroom` | `organization`)
- `includeCatalog`: optional boolean
- `includeOverrideRecords`: optional boolean
- `includeEffectiveMetadata`: optional boolean
- `evaluatedAt`: optional ISO timestamp

## Response semantics and provenance model

`ReadDeploymentPolicyStateResponse` returns:

1. normalized scope
2. authorization projection for inspection vs mutation capability posture (`canReadState`, `canSelectActiveProfile`, `canManageOverrides`, `canManageRuntimeAdminOverrides`)
3. active profile read model (including source kind and optional selection record)
4. effective snapshot and validation output from canonical resolution
5. optional override records with provenance metadata
6. optional effective metadata record
7. optional catalog metadata for presets and policy families/settings

Active profile source is explicit:

- `persisted-selection`: active profile came from persisted administration selection record
- `default-fallback`: no persisted selection was found and `home` was used

This keeps policy state explainable and auditable for control-plane consumers.

## Resolution behavior

`ReadDeploymentPolicyAdministrationUseCase`:

1. resolves active profile selection for scope
2. selects requested profile (or active profile)
3. loads scoped override records
4. resolves effective policy snapshot + validation via canonical resolver seams
5. conditionally includes catalog/override/effective-metadata sections

All reads stay behind application and backend seams (`IDeploymentPolicyPersistenceRepository` + backend API adapters); no converged client surface needs direct configuration-storage access.

## Tests

- Shared contracts/schemas:
  - `src/shared/contracts/deployment/tests/DeploymentPolicyReadContracts.test.ts`
  - `src/shared/schemas/deployment/tests/DeploymentPolicyReadSchemaContracts.test.ts`
- Application use case:
  - `src/application/policy-administration/tests/ReadDeploymentPolicyAdministrationUseCase.test.ts`
- Backend API:
  - `src/infrastructure/api/deployment/tests/DeploymentPolicyReadBackendApi.test.ts`
- Transport and route registration:
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerDeploymentPolicyReadApi.test.ts`
  - `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
