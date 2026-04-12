# AI Companion: Deployment Profile Policy Admin Permission Boundaries

## Purpose

Story 20.3.4 hardens deployment-policy administration boundaries so read and mutation capabilities are explicitly permissioned, desktop-first policy controls stay bounded, and admin-lite surfaces do not expose unsupported policy-administration workflows.

## Human doc

- `docs/architecture/deployment-profile-policy-admin-permission-boundaries.md`

## Canonical files

- `src/application/policy-administration/use-cases/ReadDeploymentPolicyAdministrationUseCase.ts`
- `src/shared/contracts/deployment/DeploymentPolicyReadContracts.ts`
- `src/shared/schemas/deployment/DeploymentPolicyReadSchemaContracts.ts`
- `src/infrastructure/api/deployment/DeploymentPolicyReadBackendApi.ts`
- `src/infrastructure/api/deployment/WorkspaceRoleBasedDeploymentPolicyAdministrationPermissionService.ts`
- `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`
- `src/ui/pages/AdminLiteEntryPage.tsx`

## Boundary summary

- Read permission key: `deployment-policy.state.read`.
- Read-state permission enforcement now runs in read use-case projection path before policy-state response construction.
- Read responses now project authorization flags consumed by admin UI read models for read-only vs mutation-capable composition.
- Mutation permissions (`deployment-policy.profile.select`, `deployment-policy.override.manage`, `deployment-policy.override.runtime-admin.manage`) stay authoritative in mutation use cases.
- Current supported role policy:
  - owner/admin can inspect state,
  - owner required for mutations.
- Route boundary posture:
  - deployment-policy admin route remains desktop-first,
  - admin-lite route discovery excludes deployment-policy administration,
  - admin-lite entry explicitly lists deployment-policy administration as desktop-only escalation.

## Coverage

- Read permission and projection tests:
  - `src/application/policy-administration/tests/ReadDeploymentPolicyAdministrationUseCase.test.ts`
  - `src/infrastructure/api/deployment/tests/DeploymentPolicyReadBackendApi.test.ts`
  - `src/shared/schemas/deployment/tests/DeploymentPolicyReadSchemaContracts.test.ts`
- Route/admin-lite boundary tests:
  - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
  - `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
  - `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerDeploymentPolicyReadApi.test.ts`
- UI boundary projection tests:
  - `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
  - `src/ui/services/tests/DeploymentPolicyAdministrationReadService.test.ts`
  - `src/ui/pages/tests/AdminLiteEntryPage.test.tsx`
