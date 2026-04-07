# AI Companion: Trusted Device Pairing and Management Workflows

## Scope

Renderer user-facing flow for trusted-device pairing and management.

## Canonical files

- `src/ui/pages/TrustedDevicesPage.tsx`
- `src/ui/pages/IdentityAdminPage.tsx`
- `src/ui/services/IdentityAuthService.ts`
- `src/ui/shared/identity/IdentityAuthClient.ts`
- `src/ui/shared/identity/IdentityTrustOversightPanels.tsx`
- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/application/identity/use-cases/TrustedDeviceAdministrativeAuthorization.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/routes/RouteConfig.ts`
- `src/ui/styles/app.css`

## UX contract

- Entry route: `/settings/trusted-devices`
- Admin oversight surface: `/settings/identity-admin` -> `Trusted device oversight`
- Self-service session surface: `/settings/trusted-devices` -> `Active session oversight`
- Admin session surface: `/settings/identity-admin` -> `Session oversight`
- Pairing flow supports:
  - artifact initiation (`one-time-code` or `qr-payload`)
  - artifact validation
  - pairing completion
- Management flow supports:
  - trusted-device listing with trust status + timestamps
  - user-confirmed revocation
- Session flow supports:
  - self-service session listing with status + access-channel filters
  - admin session listing scoped by target identity
  - user/admin session revocation actions
  - redacted trust-sensitive identifier presentation (no trust marker exposure)
- Admin-lite boundary hardening:
  - non-admin thin/admin-lite sessions can only revoke trusted devices and sessions scoped to their own `userIdentityId`
  - cross-identity revocation remains admin-only and is blocked in UI before transport calls
- Admin flow supports:
  - trusted-device listing filtered by selected user and optional workspace id
  - administrative revocation through the same revoke use case path as self-service
  - administrative session revocation through `/api/v1/identity/admin/sessions/:sessionId/revoke`

## Error/edge handling

- pairing and management operations surface backend API errors clearly
- expired/invalid/reused/invalidated/attempts-exhausted outcomes are user-visible
- unauthenticated or expired session state renders explicit sign-in guidance

## Audit coverage

- trusted-device lifecycle paths now emit identity lifecycle audit events through the shared publisher seam.
- covered events:
  - pairing initiated
  - pairing completed
  - pairing failed (`expired` / `invalid-token`)
  - trusted-device revoked
  - trust-status changed
  - trust-loss session invalidation
- audit payloads carry actor/target linkage and timestamps without storing raw pairing token secrets.

## Tests

- `src/ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `src/ui/shared/identity/tests/IdentityTrustOversightPanels.test.tsx`
- `src/ui/pages/tests/TrustedDevicesPage.test.tsx`
- `src/infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/application/identity/tests/TrustedDeviceAdministrativeAuthorization.test.ts`
