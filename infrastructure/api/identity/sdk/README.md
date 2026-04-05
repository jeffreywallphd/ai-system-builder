# Local Identity Auth API Contract

This module defines the transport-facing request/response contracts for local account registration and login.

## Requests

- `RegisterLocalIdentityApiRequest`
- `LoginLocalIdentityApiRequest`
- `ResolveAuthenticatedSessionApiRequest`

## Success responses

- `RegisterLocalIdentityApiResponse`
- `LoginLocalIdentityApiResponse`
- `ResolveAuthenticatedSessionApiResponse`

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
