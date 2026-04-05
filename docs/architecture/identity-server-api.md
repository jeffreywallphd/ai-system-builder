# Identity Server API

This note documents the authoritative HTTP server endpoints for local identity registration and login.

## Endpoint surface

- `POST /api/v1/identity/register`
- `POST /api/v1/identity/login`
- `GET /api/v1/identity/session` (authenticated)
- `POST /api/v1/identity/logout` (authenticated)
- `POST /api/v1/identity/session/revoke` (authenticated)

Implemented transport and host composition:

- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `hosts/server/IdentityServerHost.ts`

UI entry points now consume this same HTTP surface through renderer identity adapters:

- shared transport client: `ui/shared/identity/IdentityAuthClient.ts`
- desktop endpoint resolver: `ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`
- web/thin-client endpoint resolver: `ui/web/identity/resolveWebIdentityApiBaseUrl.ts`
- UI-facing service: `ui/services/IdentityAuthService.ts`

## Request contracts

### Register request

```json
{
  "username": "string",
  "email": "string (optional)",
  "displayName": "string (optional)",
  "providerId": "string (optional)",
  "providerSubject": "string (optional)",
  "credentialPolicyId": "string (optional)",
  "credential": {
    "candidate": "string"
  }
}
```

### Login request

```json
{
  "providerId": "string (optional)",
  "providerSubject": "string",
  "accessChannel": "desktop | thin-client (optional, defaults to thin-client)",
  "client": {
    "userAgent": "string (optional)",
    "ipAddress": "string (optional)",
    "deviceId": "string (optional)"
  },
  "credential": {
    "candidate": "string"
  }
}
```

### Authenticated session resolve request

`GET /api/v1/identity/session`

Requires:

- `Authorization: Bearer <session-token>`

### Logout request

`POST /api/v1/identity/logout`

Requires:

- `Authorization: Bearer <session-token>`

No request body is required.

### Session revoke request

`POST /api/v1/identity/session/revoke`

Requires:

- `Authorization: Bearer <session-token>`

Request body:

```json
{
  "sessionId": "identity-session:...",
  "reason": "logout | security | rotation | admin (optional)"
}
```

Validation is performed with `zod` at the HTTP transport boundary.

## Response contracts

All responses use one envelope:

- success: `{ "ok": true, "data": ... }`
- failure: `{ "ok": false, "error": { "code": "...", "message": "...", "validationErrors"?: [...] } }`

### Register success

```json
{
  "ok": true,
  "data": {
    "userIdentityId": "user-identity:...",
    "providerId": "provider:local-password",
    "providerSubject": "normalized-subject",
    "registeredAt": "2026-04-04T18:00:00.000Z"
  }
}
```

### Login success

```json
{
  "ok": true,
  "data": {
    "userIdentityId": "user-identity:...",
    "username": "normalized-username",
    "email": "user@example.com",
    "displayName": "optional",
    "providerId": "provider:local-password",
    "providerSubject": "normalized-subject",
    "authPath": "password",
    "authenticatedAt": "2026-04-04T18:00:00.000Z",
    "sessionId": "identity-session:...",
    "sessionToken": "opaque-bearer-session-token",
    "sessionTokenType": "Bearer",
    "sessionIssuedAt": "2026-04-04T18:00:00.000Z",
    "sessionExpiresAt": "2026-04-05T06:00:00.000Z",
    "sessionAccessChannel": "thin-client"
  }
}
```

### Authenticated session success

```json
{
  "ok": true,
  "data": {
    "principal": {
      "userIdentityId": "user-identity:...",
      "username": "normalized-username",
      "email": "user@example.com",
      "displayName": "optional"
    },
    "session": {
      "sessionId": "identity-session:...",
      "providerId": "provider:local-password",
      "providerSubject": "normalized-subject",
      "accessChannel": "thin-client",
      "issuedAt": "2026-04-04T18:00:00.000Z",
      "expiresAt": "2026-04-05T06:00:00.000Z"
    }
  }
}
```

### Logout success

```json
{
  "ok": true,
  "data": {
    "sessionId": "identity-session:...",
    "userIdentityId": "user-identity:...",
    "revokedAt": "2026-04-04T18:10:00.000Z",
    "revocationReason": "logout"
  }
}
```

### Session revoke success

```json
{
  "ok": true,
  "data": {
    "sessionId": "identity-session:...",
    "userIdentityId": "user-identity:...",
    "revokedAt": "2026-04-04T18:15:00.000Z",
    "revocationReason": "security"
  }
}
```

Protected endpoint behavior:

- `IdentityHttpServer` now includes authenticated-session guard infrastructure for bearer-token routes.
- The guard validates token format and resolves session/principal through `IdentityAuthBackendApi.resolveAuthenticatedSession(...)`.
- On success, the guard passes authenticated principal/session context into downstream handlers.
- Missing, invalid, expired, and revoked sessions are rejected consistently with `401` + `authentication-failed`.
- Logout and session-revoke routes share the same bearer-token guard.

Session issuance notes:

- Login success now issues and persists a production session in the same API flow.
- Session lifecycle metadata persists in `identity_sessions`.
- Token/signing material persists separately in `identity_session_token_material` as token hash metadata (raw token is not persisted).
- Revocation and logout invalidate token material (`invalidated_at`) and mark session lifecycle state `revoked`, so protected session validation fails on the next request without additional eventual-consistency delay in this local persistence slice.
- Session expiry behavior is policy-driven through environment-backed configuration (`IDENTITY_SESSION_*` variables for desktop/thin-client TTL, refresh, and optional inactivity timeout), so returned `sessionExpiresAt` values reflect configured policy instead of fixed constants.

## Stable error mapping

Error codes exposed to clients:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `internal`

HTTP status mapping:

- `400` -> `invalid-request`
- `401` -> `authentication-failed`
- `403` -> `account-inactive`
- `409` -> `conflict`
- `422` -> `unsupported-provider`
- `500` -> `internal`

Application identity failures are translated through `IdentityAuthBackendApi` into this stable external set.

## Secure logging, redaction, and observability hooks

Authentication flow observability is centralized in:

- `infrastructure/api/identity/IdentityAuthObservability.ts`

`IdentityAuthBackendApi` emits structured registration/login completion events through this seam for both success and failure outcomes. The observability seam includes:

- recursive payload redaction (`redactSensitiveAuthPayload`) shared across backend and HTTP transport logs
- structured flow events (`identity-auth.local-register.completed`, `identity-auth.local-login.completed`)
- `IdentityAuthAuditEventSink` hook interface for future audit/event-service integration without changing auth flow orchestration

Redacted keys include:

- `credential`
- `candidate`
- `password`
- `secret`
- `token`
- `authorization`
- `bearerToken`
- `hashValue`
- `salt`
- `pepperVersion`
- `username`
- `providerSubject`
- `email`

`IdentityHttpServer` continues to emit transport-level request lifecycle logs and now uses the same shared redaction utility for validation and response-path logging.

## Test coverage

- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/api/identity/IdentityAuthObservability.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
