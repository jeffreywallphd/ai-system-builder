# AI Companion: Trusted Device Pairing and Management Workflows

## Scope

Renderer user-facing flow for trusted-device pairing and management.

## Canonical files

- `ui/pages/TrustedDevicesPage.tsx`
- `ui/services/IdentityAuthService.ts`
- `ui/shared/identity/IdentityAuthClient.ts`
- `ui/routes/AppRouter.tsx`
- `ui/routes/RouteConfig.ts`
- `ui/styles/app.css`

## UX contract

- Entry route: `/settings/trusted-devices`
- Pairing flow supports:
  - artifact initiation (`one-time-code` or `qr-payload`)
  - artifact validation
  - pairing completion
- Management flow supports:
  - trusted-device listing with trust status + timestamps
  - user-confirmed revocation

## Error/edge handling

- pairing and management operations surface backend API errors clearly
- expired/invalid/reused/invalidated/attempts-exhausted outcomes are user-visible
- unauthenticated or expired session state renders explicit sign-in guidance

## Tests

- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `ui/pages/tests/TrustedDevicesPage.test.tsx`
