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

Session responses may include device-bound trust context (`deviceTrustContext`) plus legacy compatibility fields (`trustedDeviceBindingId`, `trustMarker`) when present.

## Error envelope

All responses are wrapped in `IdentityAuthApiResponse<T>`:

- success: `{ ok: true, data: ... }`
- failure: `{ ok: false, error: { code, message, validationErrors? } }`

Stable error codes are declared in `IdentityAuthApiErrorCodes`:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `not-found`
- `forbidden`
- `internal`
