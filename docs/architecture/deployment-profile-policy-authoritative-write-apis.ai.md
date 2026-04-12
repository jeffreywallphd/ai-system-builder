# AI Companion: Deployment Profile Policy Authoritative Write APIs

## Purpose

Story 20.2.5 adds authoritative deployment-policy write APIs so authenticated workspace administrators can mutate active profile selection and typed policy overrides through server-authoritative control-plane routes.

## Human doc

- `docs/architecture/deployment-profile-policy-authoritative-write-apis.md`

## Canonical files

- `src/shared/contracts/deployment/DeploymentPolicyWriteContracts.ts`
- `src/shared/schemas/deployment/DeploymentPolicyWriteSchemaContracts.ts`
- `src/application/policy-administration/use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyWriteBackendApi.ts`
- `src/infrastructure/api/deployment/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.ts`
- `src/infrastructure/transport/http-server/authoritative-route-families/DeploymentAuthoritativeApiRoutes.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`

## Endpoint and behavior summary

- `POST /api/v1/deployment/policy/active-profile`
- `POST /api/v1/deployment/policy/overrides`

Both routes require authenticated workspace session scope (`workspaceId` query).

Requests are typed and schema-validated; override writes require explicit operation entries (`upsert`/`remove`) and do not accept raw config blobs.

Responses include canonical updated policy state from authoritative update flow:

- normalized scope,
- validation result,
- effective policy snapshot (including summary counts),
- mutation outcomes (active profile selection, override mutations, effective metadata persistence).

## Authorization/failure model

- server-side permission checks via workspace role assignments (`owner` for policy administration writes in current supported scope),
- stable failure semantics:
  - invalid payload/validation -> `invalid-request`
  - permission denied -> `forbidden`
  - persistence revision conflicts -> `conflict`
  - unexpected -> `internal`

## Integration/test coverage

- `src/shared/contracts/deployment/tests/DeploymentPolicyWriteContracts.test.ts`
- `src/shared/schemas/deployment/tests/DeploymentPolicyWriteSchemaContracts.test.ts`
- `src/infrastructure/api/deployment/tests/DeploymentPolicyWriteBackendApi.test.ts`
- `src/infrastructure/api/deployment/tests/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerDeploymentPolicyWriteApi.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`

## Related governance hooks

Story 20.2.6 adds policy-governance audit/operational hook integration for these write pathways:

- `docs/architecture/deployment-profile-policy-audit-operational-governance-hooks.md`
