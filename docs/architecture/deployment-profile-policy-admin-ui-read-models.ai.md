# AI Companion: Deployment Profile Policy Admin UI Read Models

## Purpose

Story 20.3.1 adds production admin inspection read models and page composition so deployment profile + effective policy state is understandable, grouped, and provenance-aware without exposing raw configuration editing flows.

## Human doc

- `docs/architecture/deployment-profile-policy-admin-ui-read-models.md`

## Canonical files

- `src/ui/shared/admin/DeploymentPolicyAdministrationReadModel.ts`
- `src/ui/services/DeploymentPolicyAdministrationReadService.ts`
- `src/ui/pages/DeploymentPolicyAdministrationPage.tsx`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/routes/SurfaceRouteMetadataCatalog.ts`

## Projection and surface summary

- Reads canonical policy state via `GET /api/v1/deployment/policy/state`.
- Parses response through shared schema validation (`parseReadDeploymentPolicyStateResponse`).
- Projects effective values into admin sections with readable source labels:
  - preset default,
  - policy default,
  - admin override.
- Produces provenance explanations (actor/ticket/reason/timestamp when available).
- Produces family-level explainability summaries and controlled-impact listings from canonical policy metadata.
- Surfaces explicit warnings when policy families are governance-sensitive or foundational.
- Compares supported preset profiles and highlights active/inspected profile context.

## Route/access posture

- Route: `/settings/deployment-policy`
- Metadata key: `deployment-policy-admin`
- Surface eligibility: desktop admin + desktop operational
- Required role/capability posture:
  - role: owner/admin
  - capability: `deployment-policy.state.read`
  - workspace context required

Read responses now include authorization projection flags (`canReadState`, `canSelectActiveProfile`, `canManageOverrides`, `canManageRuntimeAdminOverrides`) consumed by admin UI composition to keep mutation controls non-interactive for inspection-only sessions.

## Coverage

- Projection model tests: `src/ui/shared/admin/tests/DeploymentPolicyAdministrationReadModel.test.ts`
- Service tests: `src/ui/services/tests/DeploymentPolicyAdministrationReadService.test.ts`
- Page tests: `src/ui/pages/tests/DeploymentPolicyAdministrationPage.test.tsx`
- Route/surface policy tests:
  - `src/ui/routes/tests/RoutesContracts.test.ts`
  - `src/ui/routes/tests/RoutesUnit.test.ts`
  - `src/ui/routes/tests/RoutesInteractions.test.ts`
  - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
  - `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
