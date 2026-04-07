# Security and Policy Configuration Operations

## Scope

- Story 15.3.5 initial production security/policy configuration surface.
- Adds a desktop administration page for supported policy controls and inspect-only posture views.

## Entry surface

- Route: `/settings/security-policy`
- Route key: `security-policy`
- Eligible surfaces: desktop admin and desktop operational (strict role/capability gates apply)

## Supported settings in this slice

- Editable:
  - Resource sharing policy controls through the existing authorization sharing management panel.
  - Selection is constrained by validated scope/resource inputs before controls are loaded.
- Inspect-only:
  - Session trust posture (trust state, trust evaluation, invalidation reasons, trusted device context).
  - Storage policy visibility for selected workspace/storage instance (encryption and retention posture fields).

## Safety posture

- No unfinished placeholder controls are exposed.
- Trust and storage sections are explicitly read-only in this surface.
- Mutation flows remain delegated to backed production surfaces/services:
  - Sharing policy edits stay in `AuthorizationSharingManagementPanel`.
  - Trust operational actions link to trusted-device and node trust pages.
  - Storage mutation actions link to storage administration.

## Shared UI patterns introduced

- `src/ui/shared/admin/AdminSettingsFormPrimitives.tsx` provides reusable section/field/read-only property primitives for admin settings surfaces.
- `src/ui/styles/components/admin-settings.css` defines shared visual patterns for editable vs inspect-only labeling.

## Canonical files

- `src/ui/pages/SecurityPolicyConfigurationPage.tsx`
- `src/ui/shared/admin/AdminSettingsFormPrimitives.tsx`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/routes/SurfaceRouteMetadataCatalog.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/pages/tests/SecurityPolicyConfigurationPage.test.tsx`

## Test coverage

- Page render/auth/read-only-vs-editable checks:
  - `src/ui/pages/tests/SecurityPolicyConfigurationPage.test.tsx`
- Validation checks for policy scope/resource selection:
  - `src/ui/pages/tests/SecurityPolicyConfigurationPage.test.tsx`
- Route metadata/access contract updates:
  - `src/ui/routes/tests/SurfaceRouteMetadataCatalog.test.ts`
  - `src/ui/routes/tests/SurfaceRouteAccessPolicy.test.ts`
  - `src/ui/routes/tests/RoutesContracts.test.ts`
  - `src/ui/routes/tests/RoutesUnit.test.ts`
  - `src/ui/routes/tests/RoutesInteractions.test.ts`
