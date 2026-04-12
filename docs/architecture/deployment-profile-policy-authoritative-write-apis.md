# Deployment Profile Policy Authoritative Write APIs

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.2: Build Persistent Policy Storage, Evaluation Integration, and Authoritative Administration APIs
- Story 20.2.5: Implement policy-write APIs for authorized administration workflows

## Purpose

Expose authoritative deployment-policy administration write APIs so authenticated workspace administrators can:

1. change the active deployment profile where supported,
2. apply typed override operations,
3. receive canonical effective policy snapshots after successful writes.

Write pathways remain server-authoritative and do not accept untyped configuration blobs.

## Canonical files

- Shared write transport and response contracts:
  - `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`
- Shared write request/response schema validation:
  - `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts`
- Application authoritative update use case:
  - `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- Write backend API adapter and permission service:
  - `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
  - `src/infrastructure/api/deployment/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.ts`
- Authoritative route-family registration:
  - `src/infrastructure/transport/http-server/authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- HTTP route handling and host wiring:
  - `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
  - `src/hosts/server/IdentityServerHost.ts`

## Authoritative endpoint surface

- Active profile mutation:
  - `POST /api/v1/deployment/policy/active-profile`
- Override mutation:
  - `POST /api/v1/deployment/policy/overrides`

Route constants:

- `DeploymentPolicyWriteTransportRoutes.updateActiveProfile`
- `DeploymentPolicyWriteTransportRoutes.applyOverrides`

Required request scope:

- authenticated workspace session,
- workspace-scoped write (`workspaceId` query).

## Request/response and validation semantics

Write requests are typed and schema-validated:

- active-profile payload uses explicit `profileId` and optional mutation metadata (`reason`, `ticketReference`, `occurredAt`, `expectedRevision`, `dryRun`),
- override payload requires `profileId` + typed `operations` (`upsert`/`remove`) with canonical family/setting/value/control-mode fields.

Successful writes return canonical updated policy information:

- normalized scope,
- validation outcome,
- effective snapshot (`snapshot.summary` includes effective-value summary counts),
- mutation outcomes for profile selection and override operations,
- effective metadata mutation record when persisted.

## Authorization and failure semantics

Authorization is enforced server-side through a workspace-role-backed permission service:

- workspace `owner` role required for policy administration write permissions in current supported scope.

Stable failure mapping:

- schema/write validation failures -> `invalid-request`,
- permission denials -> `forbidden`,
- optimistic/persistence conflicts -> `conflict`,
- unexpected failures -> `internal`.

## Tests

- Shared contracts/schemas:
  - `src/shared/contracts/deployment/tests/DeploymentPolicyWriteContracts.test.ts`
  - `src/shared/schemas/deployment/tests/DeploymentPolicyWriteSchemaContracts.test.ts`
- Backend API + permission service:
  - `src/infrastructure/api/deployment/tests/DeploymentPolicyWriteBackendApi.test.ts`
  - `src/infrastructure/api/deployment/tests/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.test.ts`
- HTTP transport and route registration:
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerDeploymentPolicyWriteApi.test.ts`
  - `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`

## Related governance hooks

Story 20.2.6 extends authoritative write flows with structured audit/operational governance events:

- `docs/architecture/deployment-profile-policy-audit-operational-governance-hooks.md`
