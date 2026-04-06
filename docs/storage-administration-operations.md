# Storage Administration Screens

This note documents Story 9.4.1 (Feature 9 / Epic 9.4): initial production UI for managed storage instance listing and detail inspection.

## Scope

- Adds a dedicated authenticated storage administration screen at `/settings/storage`.
- Adds settings-page discoverability for storage administration.
- Adds a thin route-helper seam for admin-lite/deep-link navigation.

## UI surfaces

- Page: `ui/pages/StorageAdministrationPage.tsx`
- Service: `ui/services/StorageAdministrationService.ts`
- HTTP client: `ui/shared/storage/StorageAdministrationClient.ts`
- Thin-client/admin-lite route helper: `ui/web/storage/StorageAdministrationRoutes.ts`

## Operational behavior

- List and detail data are loaded only from authoritative storage management API endpoints:
  - `GET /api/v1/storage/instances`
  - `GET /api/v1/storage/instances/:storageInstanceId`
  - `GET /api/v1/storage/instances/:storageInstanceId/health`
- The page renders explicit loading, empty, and error states for list and detail inspection paths.
- Storage list rows project:
  - display name
  - backend type
  - workspace scope
  - lifecycle state
  - health summary
  - policy highlights
- Detail panel projects lifecycle, policy, access restrictions, replication status, and health diagnostics.

## Guardrails

- UI does not reconstruct lifecycle/policy/health semantics outside backend contracts.
- No raw filesystem or backend path material is rendered.
- Health and policy summaries remain user-facing and concise while preserving backend reason codes in detail views.

## Verification

- `ui/shared/storage/tests/StorageAdministrationClient.test.ts`
- `ui/pages/tests/StorageAdministrationPage.test.tsx`
- `ui/web/storage/tests/StorageAdministrationRoutes.test.ts`
- route/page contract updates:
  - `ui/routes/tests/RoutesContracts.test.ts`
  - `ui/pages/tests/PagesContracts.test.ts`
