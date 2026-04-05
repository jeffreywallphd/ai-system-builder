# Local Identity Auth API Contract

This module defines the transport-facing request/response contracts for local account registration and login.

## Requests

- `RegisterLocalIdentityApiRequest`
- `LoginLocalIdentityApiRequest`
- `ResolveAuthenticatedSessionApiRequest`

`LoginLocalIdentityApiRequest.client` supports optional trusted-device seam context fields:

- `trustedDeviceBindingId`
- `trustMarker`

## Success responses

- `RegisterLocalIdentityApiResponse`
- `LoginLocalIdentityApiResponse`
- `ResolveAuthenticatedSessionApiResponse`

Session responses may include trusted-device seam fields (`deviceId`, `trustedDeviceBindingId`, `trustMarker`) when present.

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
- `internal`
