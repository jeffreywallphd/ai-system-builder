# Trusted Device Pairing and Management Workflows

This document describes the user-facing trusted-device flows available in the renderer.

## Entry points

- Settings -> **Trusted devices**
- Identity administration -> **Trusted devices**
- Identity administration -> **Trusted device oversight**

Route: `ui/routes/RouteConfig.ts` -> `ROUTE_PATHS.trustedDevices` (`/settings/trusted-devices`)
Route: `ui/routes/RouteConfig.ts` -> `ROUTE_PATHS.identityAdmin` (`/settings/identity-admin`)

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

## Admin trusted-device oversight workflow

The identity administration page now includes a trusted-device oversight section:

1. Select a local account.
2. Optionally provide a workspace filter.
3. Load trusted devices for that user/workspace scope.
4. Revoke trust with the admin revoke action when policy requires.

API paths used by admin oversight:

- `GET /api/v1/identity/admin/trusted-devices?userIdentityId=<id>&workspaceId=<optional>&status=<optional>`
- `POST /api/v1/identity/admin/trusted-devices/:trustedDeviceId/revoke`

Authorization posture:

- self-service trusted-device routes remain user-scoped.
- admin oversight routes evaluate centralized administrative trusted-device authorization policy in the backend.
- bootstrap admin identities can be configured through `IDENTITY_TRUSTED_DEVICE_ADMIN_USER_IDS`.

## API usage boundary

The trusted-device page uses the shared renderer identity API seam:

- `ui/services/IdentityAuthService.ts`
- `ui/shared/identity/IdentityAuthClient.ts`

No local-only trust shortcuts are used for pairing or revocation state transitions.

## Audit coverage

Trusted-device lifecycle operations now emit identity lifecycle audit events through the identity publisher abstraction, including:

- pairing initiation
- pairing completion
- pairing failure (`expired` / `invalid-token`)
- trusted-device revocation
- trust-status changes
- session invalidation caused by trusted-device trust loss

Audit payloads include actor/target linkage where available (`userIdentityId`, `trustedDeviceId`, pairing/session identifiers, and timestamps) and intentionally exclude raw pairing/token secrets.

## Tests

- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `ui/pages/tests/TrustedDevicesPage.test.tsx`
- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `application/identity/tests/TrustedDeviceAdministrativeAuthorization.test.ts`
