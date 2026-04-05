# AI Companion: Identity Server API

## What this slice adds

- Authoritative HTTP endpoints for local identity registration and login:
  - `POST /api/v1/identity/register`
  - `POST /api/v1/identity/login`
- Authenticated session validation endpoint and guard:
  - `GET /api/v1/identity/session` with `Authorization: Bearer <session-token>`
- Login success now issues and persists authenticated sessions and returns bearer session credentials.
- Transport validation at the boundary (`zod`) with stable failure envelopes.
- Deterministic translation from inner identity errors to public API error codes.
- Structured authentication observability with centralized redaction and audit-ready event hooks.

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

Auth observability is centralized in `infrastructure/api/identity/IdentityAuthObservability.ts`.

`IdentityAuthBackendApi` emits structured register/login completion events through this seam (success and failure), and the seam exposes `IdentityAuthAuditEventSink` for later audit-service integration.

Shared redaction (`redactSensitiveAuthPayload`) is reused by both backend and HTTP transport logging so sensitive fields never appear in logs. Redacted fields include credential/token material and identity-sensitive request fields (`username`, `providerSubject`, `email`).

## Session issuance contract update

- Login request now accepts optional session-context fields:
  - `accessChannel` (`desktop` or `thin-client`; default `thin-client`)
  - optional `client` context (`userAgent`, `ipAddress`, `deviceId`)
- Login success now includes issued-session fields:
  - `sessionId`
  - `sessionToken`
  - `sessionTokenType` (`Bearer`)
  - `sessionIssuedAt`
  - `sessionExpiresAt`
  - `sessionAccessChannel`
- Session metadata and token material are separated in persistence (`identity_sessions` vs `identity_session_token_material`).

## Authenticated-session guard contract update (story 1.3.3)

- `IdentityHttpServer` now includes guard-style request infrastructure for protected routes.
- Guard extracts bearer tokens from `Authorization` headers, validates active session state through `IdentityAuthBackendApi.resolveAuthenticatedSession(...)`, and supplies downstream handler context with:
  - resolved principal (`userIdentityId`, `username`, optional profile fields)
  - resolved session metadata (`sessionId`, provider/channel, issue/expiry times)
- Protected route `GET /api/v1/identity/session` now returns that context for authenticated clients.
- Missing, invalid, expired, and revoked sessions are consistently rejected as `401` + `authentication-failed`.

## Tests

- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/api/identity/IdentityAuthObservability.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
