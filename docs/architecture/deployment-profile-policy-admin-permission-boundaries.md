# Deployment Profile Policy Admin Permission Boundaries

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.3: Deliver Policy Administration Surfaces, Safe Admin Controls, and Production Hardening
- Story 20.3.4: Implement permission boundaries and admin-lite posture for policy controls

## Purpose

Refine deployment-policy administration boundaries so read and mutation capabilities are explicitly permissioned, desktop-first administration stays bounded, and thin/admin-lite surfaces do not expose policy control pathways outside supported scope.

## Canonical files

- Policy read authorization projection and read-deny enforcement:
  - `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
  - `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
  - `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
  - `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- Policy permission evaluation policy:
  - `src/infrastructure/api/deployment/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.ts`
- Desktop route metadata and admin-lite boundary composition:
  - `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
  - `src/ui/pages/AdminLiteEntryPage.tsx`
  - `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`
  - `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`

## Permission boundary model

### Read (`deployment-policy.state.read`)

- Required for policy-state inspection responses (`GET /api/v1/deployment/policy/state`).
- Read permission is enforced in the read use case before repository-backed state projection.
- Unauthorized reads fail with `forbidden` response semantics.

### Mutations (`deployment-policy.profile.select`, `deployment-policy.override.manage`, `deployment-policy.override.runtime-admin.manage`)

- Mutation permissions remain authoritative in `DeploymentPolicyAdministrationAuthoritativeUpdateUseCase`.
- Workspace role policy now distinguishes read from mutation posture:
  - owner/admin can inspect policy state,
  - owner is required for policy mutations in supported scope.

## Query projection posture

Read responses now include explicit authorization projection (`response.authorization`) used by UI read models and page composition:

- `canReadState`
- `canSelectActiveProfile`
- `canManageOverrides`
- `canManageRuntimeAdminOverrides`

This enables read-only admin sessions to inspect policy state while mutation controls stay non-interactive.

## UI and route boundaries

- `deployment-policy-admin` route remains desktop-first (`desktop-admin`, `desktop-operational`).
- Route capability is explicit (`deployment-policy.state.read`), with workspace context required.
- Admin-lite route discovery intentionally excludes deployment-policy administration.
- Admin-lite entry escalation guidance explicitly lists deployment-policy administration as desktop-only.
- `DeploymentPolicyAdministrationPage` composes mutation controls from read-model authorization flags and presents inspection-only messaging when mutation permissions are absent.

## Test coverage

- Read permission enforcement and projection:
  - `src/application/policy-administration/tests/ReadDeploymentPolicyAdministrationUseCase.test.ts`
  - `src/infrastructure/api/deployment/tests/DeploymentPolicyReadBackendApi.test.ts`
  - `src/shared/schemas/deployment/tests/DeploymentPolicyReadSchemaContracts.test.ts`
- Role policy boundaries:
  - `src/infrastructure/api/deployment/tests/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.test.ts`
- Route/admin-lite loophole protection:
  - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
  - `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerDeploymentPolicyReadApi.test.ts`
- UI boundary messaging and composition:
  - `src/ui/pages/tests/AdminLiteEntryPage.test.tsx`
  - `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
  - `src/ui/services/tests/DeploymentPolicyAdministrationReadService.test.ts`
