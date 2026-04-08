# Deployment Profile Policy Admin UI Read Models

## Story alignment

- Feature 20: Deployment Profiles and Policy Administration
- Epic 20.3: Deliver Policy Administration Surfaces, Safe Admin Controls, and Production Hardening
- Story 20.3.1: Build the admin UI/read models for deployment profile and policy inspection

## Purpose

Expose a production admin-facing inspection surface for deployment policy state that stays read-only, uses authoritative read APIs/contracts, and explains effective values plus override provenance without exposing raw persistence records for direct editing.

## Canonical files

- Admin read-model projection:
  - `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- Admin read service and authoritative API client:
  - `src/ui/services/DeploymentPolicyAdministrationReadService.ts`
- Admin page composition:
  - `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`
- Route and route metadata wiring:
  - `src/ui/routes/RouteConfig.ts`
  - `src/ui/routes/AppRouter.tsx`
  - `src/ui/routes/SurfaceRouteMetadataCatalog.ts`

## UI/read-model behavior

The inspection read model projects authoritative response payloads into admin-readable sections:

1. Active profile summary and source (`persisted-selection` vs `default-fallback`)
2. Supported preset comparison across `home`, `classroom`, and `organization`
3. Policy groups ordered into meaningful administrative sections
4. Effective value rows with source labels (`Preset default`, `Policy default`, `Admin override`)
5. Provenance explanations that surface actor/ticket/reason/update metadata when overrides apply
6. Family-level explainability summaries sourced from policy-catalog metadata, including currently supported impact areas and governance-sensitive/foundational warnings

This keeps policy state understandable to administrators while preserving read-only boundaries for this story scope.

Read responses project session authorization flags (`canReadState`, `canSelectActiveProfile`, `canManageOverrides`, `canManageRuntimeAdminOverrides`) so page composition can keep mutation controls explicitly read-only when a session has inspection-only posture.

## Access and scope model

- Route: `ROUTE_PATHS.deploymentPolicyAdmin` (`/settings/deployment-policy`)
- Surface access: desktop admin and desktop operational surfaces
- Required role/capability posture:
  - roles: `owner` or `admin`
  - capability: `deployment-policy.state.read`
  - workspace context: required

## Contract boundary requirements

- UI reads policy state through `GET /api/v1/deployment/policy/state` only.
- Response payloads are validated via shared schema parsing (`parseReadDeploymentPolicyStateResponse(...)`).
- Effective value and provenance explanations are derived from canonical response contracts and snapshot metadata.
- No raw repository/config access is introduced in UI code.
- No direct raw configuration editing is introduced in this surface.

## Tests

- Read-model projection coverage:
  - `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
- Service mapping/error coverage:
  - `src/ui/services/tests/DeploymentPolicyAdministrationReadService.test.ts`
- Page integration/guard coverage:
  - `src/ui/pages/tests/DeploymentPolicyAdministrationPage.test.tsx`
- Route + surface-policy integration coverage:
  - `src/ui/routes/tests/RoutesContracts.test.ts`
  - `src/ui/routes/tests/RoutesUnit.test.ts`
  - `src/ui/routes/tests/RoutesInteractions.test.ts`
  - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
  - `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
