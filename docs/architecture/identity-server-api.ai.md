# AI Companion: Identity Server API

## What this slice adds

- Authoritative HTTP endpoints for local identity registration and login:
  - `POST /api/v1/identity/register`
  - `POST /api/v1/identity/login`
- Authenticated session validation endpoint and guard:
  - `GET /api/v1/identity/session` with `Authorization: Bearer <session-token>`
- Authenticated session termination and revocation endpoints:
  - `POST /api/v1/identity/logout`
  - `POST /api/v1/identity/session/revoke`
- Authenticated credential-rotation endpoint:
  - `POST /api/v1/identity/credential/change`
- Authenticated account-administration endpoints:
  - `GET /api/v1/identity/admin/accounts`
  - `GET /api/v1/identity/admin/accounts/:userIdentityId`
  - `POST /api/v1/identity/admin/accounts/:userIdentityId/status`
- Authenticated trusted-device management and pairing endpoints:
  - `GET /api/v1/identity/trusted-devices`
  - `GET /api/v1/identity/trusted-devices/:trustedDeviceId`
  - `POST /api/v1/identity/trusted-devices/:trustedDeviceId/revoke`
  - `POST /api/v1/identity/trusted-devices/:trustedDeviceId/display-name`
  - `POST /api/v1/identity/trusted-devices/pairing/initiate`
  - `POST /api/v1/identity/trusted-devices/pairing/validate`
  - `POST /api/v1/identity/trusted-devices/pairing/complete`
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
- `ui/pages/IdentityAdminPage.tsx` (authenticated identity administration UI surface)
- `ui/pages/TrustedDevicesPage.tsx` (authenticated trusted-device pairing/management UI surface)

## Public error contract

Public error codes are intentionally bounded:

- `invalid-request`
- `conflict`
- `authentication-failed`
- `account-inactive`
- `unsupported-provider`
- `not-found`
- `forbidden`
- `internal`

HTTP mapping:

- `400` invalid request
- `401` authentication failure
- `403` inactive account
- `409` conflict
- `422` unsupported provider
- `404` not found
- `500` internal

## Redaction guarantee

Auth observability and redaction are centralized in:

- `infrastructure/api/identity/IdentityAuthObservability.ts`
- `infrastructure/api/identity/IdentityAuthRedaction.ts`
- `infrastructure/api/identity/IdentityAuthResponseSerializers.ts`

`IdentityAuthBackendApi` emits structured auth/admin/trusted-device API completion events through this seam (success and failure), and the seam exposes `IdentityAuthAuditEventSink` for audit-service integration.

Administration API flows also emit structured observability/audit events (`admin-accounts-list`, `admin-account-get`, `admin-account-status-set`) through the same seam.

Trusted-device API flows now also emit structured observability/audit event types:
- self-service list/get/revoke/rename
- pairing initiate/validate/complete
- admin trusted-device list/revoke

Trusted-device lifecycle governance auditing additionally uses the application lifecycle-event publisher seam and is now persisted by default in host composition via `SqliteIdentityLifecycleEventPublisher`.

Shared redaction (`redactSensitiveAuthPayload`, `redactSensitiveText`) is reused by backend/audit/HTTP transport logging so sensitive fields and bearer-like token strings never appear in logs. Redacted fields include credential/token material and identity-sensitive request fields (`username`, `providerSubject`, `email`).

API response payload construction is now explicitly serializer-based in `IdentityAuthResponseSerializers.ts`, which keeps response contracts allowlist-mapped and prevents accidental field leakage from future use-case output expansion.

Trusted-device response serialization is now similarly allowlist-mapped and intentionally excludes:
- raw device fingerprints
- pairing token hash material
- internal trust-material persistence references

## UI state hardening (story 1.4.5)

Renderer session persistence now stores a narrowed allowlist shape (`IdentityAuthPersistedSession`) in `ui/shared/identity/IdentityAuthSessionStore.ts` instead of persisting the full login response payload.

Persisted session records now intentionally exclude:

- `email`
- `providerSubject`
- trusted-device and trust-marker metadata
- other client-context metadata not required for authenticated runtime continuity

## Session issuance contract update

- Login request now accepts optional session-context fields:
  - `accessChannel` (`desktop` or `thin-client`; default `thin-client`)
  - `sessionTrustRequirement` (`allow-untrusted` | `allow-pairing` | `require-trusted`)
  - optional `client` context (`userAgent`, `ipAddress`, `deviceId`, `trustedDeviceBindingId`, `trustMarker`)
- Login success now includes issued-session fields:
  - `sessionId`
  - `sessionToken`
  - `sessionTokenType` (`Bearer`)
  - `sessionIssuedAt`
  - `sessionExpiresAt`
  - `sessionAccessChannel`
  - optional trusted-device seam fields (`sessionDeviceId`, `sessionTrustedDeviceBindingId`, `sessionTrustMarker`)
- Session metadata and token material are separated in persistence (`identity_sessions` vs `identity_session_token_material`).
- Session expiry/refresh behavior is policy-configurable through environment-backed identity session policy settings (`IDENTITY_SESSION_*`) rather than hard-coded expiry constants.
- Trusted-device seam metadata is context-only in this slice (persisted + returned) and not yet used for authorization decisions.
- Trusted-device-aware issuance now resolves trust against persisted trusted-device state and can deny login issuance when `sessionTrustRequirement=require-trusted` is not satisfied.
- Session validation now fails closed for bound sessions when trusted-device state is missing/revoked/expired/mismatched.
- High-assurance routes now enforce trusted session assurance in middleware:
  - `POST /api/v1/identity/credential/change`
  - `GET|POST /api/v1/identity/admin/accounts*`

## Credential change contract update

- `POST /api/v1/identity/credential/change` is now a bearer-authenticated endpoint for local password rotation.
- Request supports provider override fields and verification mode payloads (`current-credential` default, `reset-assertion` extension seam).
- Endpoint resolves actor identity from bearer-authenticated principal context and delegates to `ChangeLocalPasswordCredentialUseCase`.
- Success responses include superseded/new credential material ids, changed timestamp, and verification mode.
- Error mapping stays in the stable external error set:
  - invalid verification/current credential -> `authentication-failed`
  - policy/request violations -> `invalid-request`
  - inactive account/provider mismatches -> existing `account-inactive` / `unsupported-provider` behaviors.

## Logout and revocation contract update (story 1.3.4)

- `POST /api/v1/identity/logout` revokes the bearer-authenticated current session with reason `logout`.
- `POST /api/v1/identity/session/revoke` revokes an authenticated caller-selected session id (owned by the same principal in this slice) with explicit reason support (`logout`, `security`, `rotation`, `admin`).
- Both routes are protected by the same bearer-session guard pattern used by `GET /api/v1/identity/session`.
- Revocation updates both persistence surfaces:
  - session lifecycle row in `identity_sessions` moves to `revoked`
  - token material row in `identity_session_token_material` is invalidated (`invalidated_at`)
- Guarded resource validation therefore rejects revoked sessions on the next request with `401` + `authentication-failed` under local SQLite consistency.

## Authenticated-session guard contract update (story 1.3.3)

- `IdentityHttpServer` now includes guard-style request infrastructure for protected routes.
- Guard extracts bearer tokens from `Authorization` headers, validates active session state through `IdentityAuthBackendApi.resolveAuthenticatedSession(...)`, and supplies downstream handler context with:
  - resolved principal (`userIdentityId`, `username`, optional profile fields)
  - resolved session metadata (`sessionId`, provider/channel, issue/expiry times, optional `deviceId`, `trustedDeviceBindingId`, `trustMarker`)
- Protected route `GET /api/v1/identity/session` now returns that context for authenticated clients.
- Missing, invalid, expired, and revoked sessions are consistently rejected as `401` + `authentication-failed`.

## Tests

- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/api/identity/IdentityAuthObservability.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- trusted-device transport lifecycle coverage in backend + HTTP integration tests (list/detail/revoke/rename + pairing initiate/validate/complete)
- `ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `ui/pages/tests/IdentityAdminPage.test.tsx`
- `ui/pages/tests/TrustedDevicesPage.test.tsx`

## Related docs

- `docs/architecture/identity-session-architecture.md` (session subsystem baseline)
