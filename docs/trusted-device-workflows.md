# Trusted Device Pairing and Management Workflows

This document describes the user-facing trusted-device flows available in the renderer.

## Entry points

- Settings -> **Trusted devices**
- Identity administration -> **Trusted devices**

Route: `ui/routes/RouteConfig.ts` -> `ROUTE_PATHS.trustedDevices` (`/settings/trusted-devices`)

## Pairing workflow

1. Open **Trusted devices**.
2. Select a device in `pending-pairing` status.
3. Choose pairing artifact type:
   - `one-time-code`
   - `qr-payload` (QR-ready payload)
4. Start pairing to generate a short-lived artifact with explicit expiry.
5. Validate the artifact by entering the value presented by the pairing flow.
6. Complete pairing to mark the device as `trusted`.

UI behavior details:

- The pairing panel shows:
  - artifact type and value
  - expires-at timestamp
  - attempts remaining
- Validation outcomes are surfaced explicitly:
  - `valid`
  - `invalid`
  - `expired`
  - `reused`
  - `invalidated`
  - `attempts-exhausted`
  - `actor-scope-violation`

## Trusted device management workflow

The management table surfaces, per device:

- device display name
- trust status
- created date (`registeredAt`)
- last seen date (`lastSeenAt`)
- revoke action

Revocation requires user confirmation and calls the authenticated trusted-device revoke API.

## API usage boundary

The trusted-device page uses the shared renderer identity API seam:

- `ui/services/IdentityAuthService.ts`
- `ui/shared/identity/IdentityAuthClient.ts`

No local-only trust shortcuts are used for pairing or revocation state transitions.

## Tests

- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `ui/pages/tests/TrustedDevicesPage.test.tsx`
