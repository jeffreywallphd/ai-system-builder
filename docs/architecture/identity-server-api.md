# Identity Server API

This note documents the authoritative HTTP server endpoints for local identity registration and login.

## Endpoint surface

- `POST /api/v1/identity/register`
- `POST /api/v1/identity/login`
- `POST /api/v1/identity/dev-login` (development-only, enabled when `NODE_ENV` is not `production` unless overridden)
- `GET /api/v1/identity/session` (authenticated)
- `POST /api/v1/identity/credential/change` (authenticated)
- `POST /api/v1/identity/logout` (authenticated)
- `POST /api/v1/identity/session/revoke` (authenticated)
- `GET /api/v1/identity/admin/accounts` (authenticated)
- `GET /api/v1/identity/admin/accounts/:userIdentityId` (authenticated)
- `POST /api/v1/identity/admin/accounts/:userIdentityId/status` (authenticated)
- `GET /api/v1/identity/trusted-devices` (authenticated)
- `GET /api/v1/identity/trusted-devices/:trustedDeviceId` (authenticated)
- `POST /api/v1/identity/trusted-devices/:trustedDeviceId/revoke` (authenticated)
- `POST /api/v1/identity/trusted-devices/:trustedDeviceId/display-name` (authenticated)
- `POST /api/v1/identity/trusted-devices/pairing/initiate` (authenticated)
- `POST /api/v1/identity/trusted-devices/pairing/validate` (authenticated)
- `POST /api/v1/identity/trusted-devices/pairing/complete` (authenticated)
- `GET /api/v1/security/certificates/authority/status` (authenticated, trusted session required)
- `GET /api/v1/security/certificates` (authenticated, trusted session required)
- `GET /api/v1/security/certificates/:serialNumber` (authenticated, trusted session required)
- `POST /api/v1/security/certificates/:serialNumber/revoke` (authenticated, trusted session required)
- `POST /api/v1/security/certificates/:serialNumber/renew` (authenticated, trusted session required)
- `POST /api/v1/assets/register` (authenticated)
- `POST /api/v1/assets/:assetId/uploads/initiate` (authenticated)

Implemented transport and host composition:

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
- `src/hosts/server/IdentityServerHost.ts`

UI entry points now consume this same HTTP surface through renderer identity adapters:

- shared transport client: `src/ui/shared/identity/IdentityAuthClient.ts`
- desktop endpoint resolver: `src/ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`
- web/thin-client endpoint resolver: `src/ui/web/identity/resolveWebIdentityApiBaseUrl.ts`
- UI-facing service: `src/ui/services/IdentityAuthService.ts`
- admin UI surface: `src/ui/pages/IdentityAdminPage.tsx` (account list, status inspection, enable/disable actions)
- trusted-device UI surface: `src/ui/pages/TrustedDevicesPage.tsx` (pairing initiation/validation/completion + trusted-device list/revocation flows)

Browser development host wiring (`npm run dev:browser`) now self-bootstraps the identity server through the Vite runtime plugin:

- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts` starts `IdentityServerHost` on browser-dev startup.
- The plugin injects browser runtime bootstrap env (`window.aiLoomBrowserDevelopment.env.VITE_IDENTITY_API_BASE_URL`) so runtime config and web identity resolver use the managed identity base URL without requiring a manual `.env` override.

Development-login route guard:

- `AI_LOOM_ENABLE_DEV_LOGIN=true|false` explicitly enables or disables `POST /api/v1/identity/dev-login`.
- When unset, the route is enabled for non-production runtime (`NODE_ENV !== production`) and disabled in production.

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
  "sessionTrustRequirement": "allow-untrusted | allow-pairing | require-trusted (optional)",
  "client": {
    "userAgent": "string (optional)",
    "ipAddress": "string (optional)",
    "deviceId": "string (optional)",
    "trustedDeviceBindingId": "string (optional, future trusted-device seam)",
    "trustMarker": "string (optional, future trusted-device seam)"
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

### Credential change request

`POST /api/v1/identity/credential/change`

Requires:

- `Authorization: Bearer <session-token>`

Request body:

```json
{
  "providerId": "string (optional)",
  "providerSubject": "string (optional)",
  "credentialPolicyId": "string (optional)",
  "newCredential": {
    "candidate": "string"
  },
  "verification": {
    "mode": "current-credential (default) | reset-assertion",
    "currentCredential": "string (required for current-credential mode)",
    "resetAssertion": "string (required for reset-assertion mode)"
  }
}
```

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

### Trusted-device requests

Trusted-device transport contracts are defined in `src/infrastructure/api/identity/sdk/PublicIdentityAuthApiContract.ts` and include:

- device management: list, detail, revoke, and display-name update request/response contracts
- pairing lifecycle: initiation, validation, and completion request/response contracts
- all trusted-device routes run through authenticated session guard middleware and resolve actor context from bearer session state

### Admin account list request

`GET /api/v1/identity/admin/accounts`

Requires:

- `Authorization: Bearer <session-token>`

Optional query params:

- `providerId` (defaults to local provider in backend API)
- `status` (repeatable; one of `pending-activation`, `active`, `suspended`, `locked`, `deactivated`)
- `limit`
- `offset`

### Admin account status request

`GET /api/v1/identity/admin/accounts/:userIdentityId`

Requires:

- `Authorization: Bearer <session-token>`

Optional query params:

- `providerId`

### Admin account status mutation request

`POST /api/v1/identity/admin/accounts/:userIdentityId/status`

Requires:

- `Authorization: Bearer <session-token>`

Request body:

```json
{
  "action": "enable | disable",
  "providerId": "string (optional)"
}
```

### Certificate operations requests

`GET /api/v1/security/certificates/authority/status`

Optional query params:

- `asOf` (ISO-8601 timestamp)
- `rotationWarningWindowDays` (integer >= 1)
- `certificateExpiryWarningWindowDays` (integer >= 1)

`GET /api/v1/security/certificates`

Optional query params:

- `certificateAuthorityId`
- repeatable `status` (`issued | revoked | expired | superseded`)
- repeatable `subjectReferenceKind` (`node | device | service`)
- `subjectReferenceId`
- `linkedNodeId`
- `subjectCommonNameContains`
- repeatable `usage` (`server-auth | client-auth | mutual-tls | node-enrollment | device-trust | service-identity`)
- `issuedAfter`, `issuedBefore`, `asOf` (ISO-8601 timestamps)
- repeatable `trustStatus` (`active | revoked | expired | superseded | not-yet-valid | not-found | subject-inactive | invalid`)
- `includeRevoked` (`true | false`)
- `limit` (integer >= 1), `offset` (integer >= 0)

`GET /api/v1/security/certificates/:serialNumber`

Optional query params:

- `asOf` (ISO-8601 timestamp)

`POST /api/v1/security/certificates/:serialNumber/revoke`

Request body:

```json
{
  "revocationReason": "unspecified | key-compromise | ca-compromise | affiliation-changed | superseded | cessation-of-operation | privilege-withdrawn | policy-violation",
  "revokedAt": "string (optional, ISO-8601)",
  "note": "string (optional)",
  "reason": "string (optional)",
  "correlationId": "string (optional)"
}
```

`POST /api/v1/security/certificates/:serialNumber/renew`

Request body:

```json
{
  "operationKey": "string (optional)",
  "validityDays": "number (optional)",
  "publicKeyPem": "string",
  "publicKeyAlgorithm": "string",
  "publicKeyFingerprintSha256": "string (optional)",
  "signatureAlgorithm": "string (optional)",
  "certificateMaterialRef": "string",
  "certificateChainMaterialRef": "string (optional)",
  "trustMaterialRef": "string (optional)",
  "certificateMaterialSecretRef": "string (optional)",
  "certificateMaterialKeyScope": "string (optional)",
  "certificateChainMaterialSecretRef": "string (optional)",
  "certificateChainMaterialKeyScope": "string (optional)",
  "previousCertificateDisposition": "supersede | preserve (optional)",
  "gracePeriodDays": "number (optional)",
  "occurredAt": "string (optional, ISO-8601)",
  "reason": "string (optional)",
  "correlationId": "string (optional)"
}
```

## Response contracts

All responses use one envelope:

- success: `{ "ok": true, "data": ... }`
- failure: `{ "ok": false, "error": { "code": "...", "message": "...", "validationErrors"?: [...] } }`
- registration policy/input failures preserve specific actionable `error.message` text (for example, credential policy violations), while keeping the stable `invalid-request` code.

Trusted-device responses are allowlist-projected and intentionally exclude:

- raw device fingerprint material
- pairing token hashes
- trust material references and other internal trust persistence fields

Certificate operations responses are metadata/action projected and intentionally exclude:

- private keys, PEM leaf material, and certificate chain payloads
- trust-material storage locators and protected secret references
- internal material-reference fields from issued-certificate records (`certificateMaterialRef`, `certificateChainMaterialRef`, `trustMaterialRef`)

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
    "sessionAccessChannel": "thin-client",
    "sessionDeviceId": "device:example",
    "sessionTrustedDeviceBindingId": "trusted-device:example",
    "sessionTrustMarker": "marker:example"
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
      "deviceId": "device:example",
      "trustedDeviceBindingId": "trusted-device:example",
      "trustMarker": "marker:example",
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

### Credential change success

```json
{
  "ok": true,
  "data": {
    "userIdentityId": "user-identity:...",
    "providerId": "provider:local-password",
    "providerSubject": "normalized-subject",
    "credentialPolicyId": "policy:local-password",
    "supersededCredentialMaterialId": "credential:...",
    "credentialMaterialId": "credential:...",
    "changedAt": "2026-04-04T18:12:00.000Z",
    "verificationMode": "current-credential"
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

### Admin account list success

```json
{
  "ok": true,
  "data": {
    "accounts": [
      {
        "userIdentityId": "user-identity:...",
        "username": "normalized-username",
        "email": "user@example.com",
        "displayName": "optional",
        "accountStatus": "active",
        "providerId": "provider:local-password",
        "providerSubject": "normalized-subject",
        "credentialStatus": "active",
        "linkedAt": "2026-04-04T18:00:00.000Z",
        "activeSessionCount": 1,
        "createdAt": "2026-04-04T18:00:00.000Z",
        "updatedAt": "2026-04-04T18:00:00.000Z"
      }
    ]
  }
}
```

### Admin account status success

```json
{
  "ok": true,
  "data": {
    "account": {
      "userIdentityId": "user-identity:...",
      "username": "normalized-username",
      "accountStatus": "active",
      "providerId": "provider:local-password",
      "providerSubject": "normalized-subject",
      "activeSessionCount": 1,
      "createdAt": "2026-04-04T18:00:00.000Z",
      "updatedAt": "2026-04-04T18:00:00.000Z"
    }
  }
}
```

### Admin account status mutation success

```json
{
  "ok": true,
  "data": {
    "userIdentityId": "user-identity:...",
    "status": "suspended",
    "changed": true,
    "affectedSessionIds": ["identity-session:..."],
    "updatedAt": "2026-04-04T18:20:00.000Z"
  }
}
```

Protected endpoint behavior:

- `IdentityHttpServer` now includes authenticated-session guard infrastructure for bearer-token routes.
- The guard validates token format and resolves session/principal through `IdentityAuthBackendApi.resolveAuthenticatedSession(...)`.
- On success, the guard passes authenticated principal/session context into downstream handlers.
- Missing, invalid, expired, and revoked sessions are rejected consistently with `401` + `authentication-failed`.
- Logout and session-revoke routes share the same bearer-token guard.
- High-assurance routes require trusted session assurance and return `403` + `forbidden` when trust is insufficient:
  - `POST /api/v1/identity/credential/change`
  - `GET|POST /api/v1/identity/admin/accounts*`
  - `GET /api/v1/security/certificates/authority/status`
  - `GET /api/v1/security/certificates*`
  - `POST /api/v1/security/certificates/:serialNumber/revoke`
  - `POST /api/v1/security/certificates/:serialNumber/renew`

## Secure transport adapter setup (story 7.2.1)

- `IdentityHttpServer` now supports explicit secure transport adapter configuration:
  - `secureTransport.requireHttps`
  - `secureTransport.allowInsecureLoopback`
- The adapter enforces secure transport at the top of the `/api/*` request pipeline.
- Insecure API requests are denied consistently before route handlers execute when HTTPS is required and loopback fallback is not allowed.
- Authenticated route context now includes normalized transport metadata:
  - channel type (`http`/`https`)
  - encrypted transport and mTLS flags
  - peer certificate presence/serial metadata
  - loopback detection and socket address metadata
  - trust-validation routing metadata (scenario/actor/remote peer + enforcement state)
- `IdentityServerHost` composes these options from `HostSecureTransportConfig` and injects them into the HTTP adapter, preserving host-level composition boundaries.

Session issuance notes:

- Login success now issues and persists a production session in the same API flow.
- Session lifecycle metadata persists in `identity_sessions`.
- Token/signing material persists separately in `identity_session_token_material` as token hash metadata (raw token is not persisted).
- Revocation and logout invalidate token material (`invalidated_at`) and mark session lifecycle state `revoked`, so protected session validation fails on the next request without additional eventual-consistency delay in this local persistence slice.
- Session expiry behavior is policy-driven through environment-backed configuration (`IDENTITY_SESSION_*` variables for desktop/thin-client TTL, refresh, and optional inactivity timeout), so returned `sessionExpiresAt` values reflect configured policy instead of fixed constants.
- Session context includes trusted-device seam fields (`trustedDeviceBindingId`, `trustMarker`) and trust context (`deviceTrustContext`) derived from trusted-device repository state.
- Login/session issuance now supports trust posture (`allow-untrusted`, `allow-pairing`, `require-trusted`) and can deny issuance when trusted requirements are not met.
- Validation fails closed for bound sessions when trusted-device state is missing, revoked, expired, or mismatched.

## Stable error mapping

Error codes exposed to clients:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `internal`
- `not-found`
- `forbidden`

HTTP status mapping:

- `400` -> `invalid-request`
- `401` -> `authentication-failed`
- `403` -> `account-inactive`
- `409` -> `conflict`
- `422` -> `unsupported-provider`
- `404` -> `not-found`
- `500` -> `internal`

Application identity failures are translated through `IdentityAuthBackendApi` into this stable external set.

## Secure logging, redaction, and observability hooks

Authentication flow observability is centralized in:

- `src/infrastructure/api/identity/IdentityAuthObservability.ts`
- `src/infrastructure/api/identity/IdentityAuthRedaction.ts`
- `src/infrastructure/api/identity/IdentityAuthResponseSerializers.ts`

`IdentityAuthBackendApi` emits structured auth/admin/trusted-device API completion events through this seam for both success and failure outcomes. The observability seam includes:

- centralized recursive payload and freeform-string redaction (`redactSensitiveAuthPayload`, `redactSensitiveText`) shared across backend and HTTP transport logs
- structured flow events (`identity-auth.local-register.completed`, `identity-auth.local-login.completed`)
- structured flow events now include administration flows (`identity-auth.admin-accounts-list.completed`, `identity-auth.admin-account-get.completed`, `identity-auth.admin-account-status-set.completed`)
- structured flow events now include trusted-device flows (self-service list/get/revoke/rename, pairing initiate/validate/complete, and admin trusted-device list/revoke)
- `IdentityAuthAuditEventSink` hook interface for audit/event-service integration without changing auth flow orchestration
- safe-by-default response serialization in `IdentityAuthResponseSerializers.ts` so transport payloads are allowlist-mapped instead of use-case object pass-through
- trusted-device lifecycle governance audit events are additionally emitted through the application lifecycle-event publisher seam and persisted by default in host composition via `SqliteIdentityLifecycleEventPublisher`

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
- `trustedDeviceBindingId`
- `trustMarker`
- `username`
- `providerSubject`
- `email`

`IdentityHttpServer` continues to emit transport-level request lifecycle logs and now uses the same shared redaction utility for validation, response-path logging, and unhandled error normalization.

## UI session persistence hardening (Story 1.4.5)

Renderer session persistence is intentionally minimized:

- `src/ui/shared/identity/IdentityAuthSessionStore.ts` now persists a narrowed `IdentityAuthPersistedSession` allowlist instead of the full login/session payload.
- persisted session records retain only fields required for authenticated runtime continuity (`userIdentityId`, `username`, `displayName`, `providerId`, session id/token/type/timing/channel).
- recovery-sensitive and trust-seam metadata (`email`, `providerSubject`, trusted-device binding id, trust marker, client-device metadata) is not persisted to local session storage by default.

## Test coverage

- `src/infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `src/infrastructure/api/identity/IdentityAuthObservability.ts`
- `src/infrastructure/api/security/tests/CertificateOperationsBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerCertificateOperations.test.ts`
- trusted-device API route and contract coverage in the same backend/HTTP test suites
- `src/ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `src/ui/pages/tests/IdentityAdminPage.test.tsx`
- `src/ui/pages/tests/TrustedDevicesPage.test.tsx`

## Related docs

- Session subsystem architecture and integration expectations: `docs/architecture/identity-session-architecture.md`
