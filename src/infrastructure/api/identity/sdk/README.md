# Local Identity Auth API Contract

This module defines the transport-facing request/response contracts for local account registration, login/session lifecycle, and local account administration.

## Requests

- `RegisterLocalIdentityApiRequest`
- `LoginLocalIdentityApiRequest`
- `ResolveAuthenticatedSessionApiRequest`
- `LogoutAuthenticatedSessionApiRequest`
- `RevokeIdentitySessionApiRequest`
- `ChangeLocalPasswordCredentialApiRequest`
- `ListIdentityAdminAccountsApiRequest`
- `GetIdentityAdminAccountStatusApiRequest`
- `SetIdentityAdminAccountStatusApiRequest`
- `ListTrustedDevicesApiRequest`
- `GetTrustedDeviceApiRequest`
- `RevokeTrustedDeviceApiRequest`
- `UpdateTrustedDeviceDisplayNameApiRequest`
- `InitiateTrustedDevicePairingApiRequest`
- `ValidateTrustedDevicePairingApiRequest`
- `CompleteTrustedDevicePairingApiRequest`

`LoginLocalIdentityApiRequest.client` supports optional trusted-device context:

- `deviceTrustContext`:
  - `trustedDeviceId`
  - `issuedOnTrustedDevice`
  - `sessionAssuranceLevel`
  - `trustStateSnapshot`
  - `invalidationReasons`
  - compatibility fields: `trustedDeviceBindingId`, `trustMarker`

Legacy compatibility fields remain available:
- `trustedDeviceBindingId`
- `trustMarker`

Login also supports optional server-side trust posture selection:
- `sessionTrustRequirement`: `allow-untrusted` | `allow-pairing` | `require-trusted`

## Success responses

- `RegisterLocalIdentityApiResponse`
- `LoginLocalIdentityApiResponse`
- `ResolveAuthenticatedSessionApiResponse`
- `LogoutAuthenticatedSessionApiResponse`
- `RevokeIdentitySessionApiResponse`
- `ChangeLocalPasswordCredentialApiResponse`
- `ListIdentityAdminAccountsApiResponse`
- `GetIdentityAdminAccountStatusApiResponse`
- `SetIdentityAdminAccountStatusApiResponse`
- `ListTrustedDevicesApiResponse`
- `GetTrustedDeviceApiResponse`
- `RevokeTrustedDeviceApiResponse`
- `UpdateTrustedDeviceDisplayNameApiResponse`
- `InitiateTrustedDevicePairingApiResponse`
- `ValidateTrustedDevicePairingApiResponse`
- `CompleteTrustedDevicePairingApiResponse`

Session responses may include device-bound trust context (`deviceTrustContext`) plus legacy compatibility fields (`trustedDeviceBindingId`, `trustMarker`) when present.

High-assurance route posture:
- `POST /api/v1/identity/credential/change` requires trusted session assurance.
- `GET|POST /api/v1/identity/admin/accounts*` routes require trusted session assurance.

Trusted-device route posture:
- `GET /api/v1/identity/trusted-devices`
- `GET /api/v1/identity/trusted-devices/:trustedDeviceId`
- `POST /api/v1/identity/trusted-devices/:trustedDeviceId/revoke`
- `POST /api/v1/identity/trusted-devices/:trustedDeviceId/display-name`
- `POST /api/v1/identity/trusted-devices/pairing/initiate`
- `POST /api/v1/identity/trusted-devices/pairing/validate`
- `POST /api/v1/identity/trusted-devices/pairing/complete`

Trusted-device responses intentionally exclude raw fingerprint values, token hashes, and trust-material internals.

## Error envelope

All responses are wrapped in `IdentityAuthApiResponse<T>`:

- success: `{ ok: true, data: ... }`
- failure: `{ ok: false, error: { code, message, validationErrors? } }`
- registration policy/input failures now return a specific `error.message` (for example, credential policy violations) instead of a generic invalid-request message.
- trust-related validation failures can include:
  - `error.trustFailure.reason`
  - `error.trustFailure.invalidationReasons` (`trusted-device-revoked`, `trusted-device-trust-lost`, `trusted-device-expired`, `trusted-device-mismatch`)

Stable error codes are declared in `IdentityAuthApiErrorCodes`:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `not-found`
- `forbidden`
- `internal`
