# AI Companion: Trusted Device Pairing and Management Workflows

## Scope

Renderer user-facing flow for trusted-device pairing and management.

## Canonical files

- `ui/pages/TrustedDevicesPage.tsx`
- `ui/pages/IdentityAdminPage.tsx`
- `ui/services/IdentityAuthService.ts`
- `ui/shared/identity/IdentityAuthClient.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/application/identity/use-cases/TrustedDeviceAdministrativeAuthorization.ts`
- `ui/routes/AppRouter.tsx`
- `ui/routes/RouteConfig.ts`
- `ui/styles/app.css`

## UX contract

- Entry route: `/settings/trusted-devices`
- Admin oversight surface: `/settings/identity-admin` -> `Trusted device oversight`
- Pairing flow supports:
  - artifact initiation (`one-time-code` or `qr-payload`)
  - artifact validation
  - pairing completion
- Management flow supports:
  - trusted-device listing with trust status + timestamps
  - user-confirmed revocation
- Admin flow supports:
  - trusted-device listing filtered by selected user and optional workspace id
  - administrative revocation through the same revoke use case path as self-service

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

- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `ui/pages/tests/TrustedDevicesPage.test.tsx`
- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `application/identity/tests/TrustedDeviceAdministrativeAuthorization.test.ts`
