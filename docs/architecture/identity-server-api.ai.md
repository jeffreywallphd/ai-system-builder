# AI Companion: Identity Server API

## What this slice adds

- Authoritative HTTP endpoints for local identity registration and login:
  - `POST /api/v1/identity/register`
  - `POST /api/v1/identity/login`
- Transport validation at the boundary (`zod`) with stable failure envelopes.
- Deterministic translation from inner identity errors to public API error codes.
- Structured HTTP logging with credential redaction.

## Main files

- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `infrastructure/api/identity/sdk/PublicIdentityAuthApiContract.ts`
- `hosts/server/IdentityServerHost.ts`

Renderer client surface now uses the same endpoint contract:

- `ui/shared/identity/IdentityAuthClient.ts`
- `ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`
- `ui/web/identity/resolveWebIdentityApiBaseUrl.ts`
- `ui/services/IdentityAuthService.ts`

## Public error contract

Public error codes are intentionally bounded:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `internal`

HTTP mapping:

- `400` invalid request
- `401` authentication failure
- `403` inactive account
- `409` conflict
- `422` unsupported provider
- `500` internal

## Redaction guarantee

HTTP transport logging redacts sensitive fields (`credential`, `candidate`, `hashValue`, `salt`, `pepperVersion`, auth token fields) before writing structured log entries.

## Tests

- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
