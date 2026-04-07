# AI Companion: Identity Server API

## What this slice adds

- Authoritative HTTP endpoints for local identity registration and login:
  - `POST /api/v1/identity/register`
  - `POST /api/v1/identity/login`
  - `POST /api/v1/identity/dev-login` (development-only fallback login route)
- Authenticated session validation endpoint and guard:
  - `GET /api/v1/identity/session` with `Authorization: Bearer <session-token>`
  - `GET /api/v1/identity/session/context` with `Authorization: Bearer <session-token>`
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
- Authenticated certificate operations endpoints (trusted session required):
  - `GET /api/v1/security/certificates/authority/status`
  - `GET /api/v1/security/certificates`
  - `GET /api/v1/security/certificates/:serialNumber`
  - `POST /api/v1/security/certificates/:serialNumber/revoke`
  - `POST /api/v1/security/certificates/:serialNumber/renew`
- Authenticated asset upload initiation endpoints:
  - `POST /api/v1/assets/register`
  - `POST /api/v1/assets/:assetId/uploads/initiate`
- Authenticated runtime mutation + read/list endpoints:
  - `POST /api/v1/runtime/runs/start`
  - `POST /api/v1/runtime/runs/:executionId/cancel`
  - `GET /api/v1/runtime/runs/:executionId/status`
  - `GET /api/v1/runtime/runs/:executionId/result`
  - `GET /api/v1/runtime/runs/:executionId/trace`
  - `GET /api/v1/runtime/queue`
  - `POST /api/v1/runtime/queue/:queueItemId/dequeue`
- Authoritative run submission now resolves through canonical run orchestration validation + creation flow instead of local-only runtime launch shims:
  - authenticated actor/workspace context is enforced at transport boundary
  - canonical run identifiers and mutation metadata are returned from authoritative backend composition
  - stable shared failure semantics are preserved (`invalid-request`, `forbidden`, `not-found`, `conflict`, etc.)
- Authenticated authoritative runtime realtime websocket endpoint:
  - `GET /ws` websocket upgrade (bearer-authenticated)
- Login success now issues and persists authenticated sessions and returns bearer session credentials.
- Transport validation at the boundary (`zod`) with stable failure envelopes.
- Deterministic translation from inner identity errors to public API error codes.
- Structured authentication observability with centralized redaction and audit-ready event hooks.

## Main files

- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `src/infrastructure/api/assets/AssetManagementBackendApi.ts`
- `src/infrastructure/api/runs/AuthoritativeRunSubmissionBackendApi.ts`
- `src/infrastructure/api/identity/sdk/PublicIdentityAuthApiContract.ts`
- `src/hosts/server/IdentityServerHost.ts`

Renderer client surface now uses the same endpoint contract:

- `src/ui/shared/identity/IdentityAuthClient.ts`
- `src/ui/desktop/identity/resolveDesktopIdentityApiBaseUrl.ts`
- `src/ui/web/identity/resolveWebIdentityApiBaseUrl.ts`
- `src/ui/services/IdentityAuthService.ts`
- `src/ui/pages/IdentityAdminPage.tsx` (authenticated identity administration UI surface)
- `src/ui/pages/TrustedDevicesPage.tsx` (authenticated trusted-device pairing/management UI surface)

Browser development host wiring now self-bootstraps identity transport for `dev:browser`:

- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts` now starts `IdentityServerHost` during Vite serve bootstrap.
- The plugin injects browser runtime bootstrap env (`window.aiLoomBrowserDevelopment.env.VITE_IDENTITY_API_BASE_URL`) so runtime config and the web identity endpoint resolver consume the managed identity API base URL without requiring manual `.env` setup.

Development-login route policy:

- `AI_LOOM_ENABLE_DEV_LOGIN=true|false` explicitly overrides development-login route exposure.
- When unset, `IdentityServerHost` enables `POST /api/v1/identity/dev-login` only when `NODE_ENV` is not `production`.

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

Registration invalid-request responses now preserve specific actionable message text from policy/request validation outcomes (for example, credential policy failures) rather than collapsing to a generic registration-invalid message.

## Redaction guarantee

Auth observability and redaction are centralized in:

- `src/infrastructure/api/identity/IdentityAuthObservability.ts`
- `src/infrastructure/api/identity/IdentityAuthRedaction.ts`
- `src/infrastructure/api/identity/IdentityAuthResponseSerializers.ts`

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

Session actor-context bootstrap responses are allowlist-projected and intentionally exclude:
- trusted-device trust-material refs and secret locators
- legacy trust marker and trusted-device binding marker fields

Certificate operations transport responses are metadata/action projected and intentionally exclude:
- private key payloads and certificate PEM payloads
- trust-material storage locators and protected secret references
- secret-bearing issued-certificate material refs (`certificateMaterialRef`, `certificateChainMaterialRef`, `trustMaterialRef`)

## UI state hardening (story 1.4.5)

Renderer session persistence now stores a narrowed allowlist shape (`IdentityAuthPersistedSession`) in `src/ui/shared/identity/IdentityAuthSessionStore.ts` instead of persisting the full login response payload.

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
  - `GET /api/v1/security/certificates/authority/status`
  - `GET /api/v1/security/certificates*`
  - `POST /api/v1/security/certificates/:serialNumber/revoke`
  - `POST /api/v1/security/certificates/:serialNumber/renew`

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

## Authoritative session-aware middleware and route guards (story 14.1.4)

- `IdentityHttpServer` now composes a reusable `requireAuthenticatedWorkspaceSession(...)` guard for converged workspace-scoped routes.
- The guard enforces a shared sequence: resolve authenticated session -> resolve workspace scope -> execute route handler.
- Shared guard context now carries actor metadata (`actor.userIdentityId`, `actor.username`) and workspace metadata (`workspace.workspaceId`) so downstream transport handlers avoid repeated parsing logic.
- Storage and asset converged routes now use this shared pipeline and preserve shared failure semantics:
- Runtime run-control, queue-control, and run-read routes now also use this shared pipeline and preserve shared failure semantics:
  - unauthenticated requests return `401` + `authentication-failed`
  - authenticated requests missing required workspace scope return `400` + `invalid-request`
- Runtime queue route follows shared list query conventions:
  - required `workspaceId`
  - optional `limit`/`offset`
  - repeatable `status` filters (`queued`, `running`, `completed`, `failed`, `cancelled`)

## Runtime realtime websocket delivery (story 14.2.6)

- Transport endpoint: `GET /ws` with websocket upgrade headers.
- Authentication for websocket upgrade accepts:
  - `Authorization: Bearer <session-token>` header (canonical),
  - runtime auth subprotocol token on `Sec-WebSocket-Protocol` (`ai-loom-auth-bearer.<base64url(session-token)>`) with runtime protocol `ai-loom-runtime-realtime.v1`.
- Runtime realtime subscribe action is message-driven after upgrade:
  - client masked text frame:
    - `action: "runtime-realtime.subscribe"`
    - `request.topics[]` with shared topic contracts (`runtime.run.status`, `runtime.queue`, `runtime.connectivity`, `runtime.admin`)
    - optional `mode` (`live-only` | `resume-from-cursor`)
    - optional reconnect cursor (`reconnect.afterCursor`)
- Server frame contracts:
  - `runtime-realtime.subscription-ack`
  - `runtime-realtime.event` (canonical shared envelope from `SystemRuntimeRealtimeEventContracts`)
  - `runtime-realtime.error` (`invalid-request` | `forbidden` | `internal`)
- Session-aware enforcement:
  - actor identity is derived from authenticated session context, not accepted from client payload
  - websocket `workspaceId` and topic `workspaceId` must align when scoped
  - purpose/topic gating is enforced:
    - `status` -> connectivity
    - `queue-monitoring` -> queue/run-status/connectivity
    - `run-monitoring` -> run-status/queue/connectivity
    - `stream-control` -> admin/connectivity
- Reconnect and initial-state posture:
  - bounded replay is supported with `resume-from-cursor` + cursor
  - initial queue/run snapshots are not auto-streamed on subscribe; clients should call authoritative HTTP read APIs first, then subscribe for live deltas

## Converged session + actor-context bootstrap endpoint (story 14.2.2)

- Added authenticated bootstrap endpoint: `GET /api/v1/identity/session/context`.
- Optional query: `workspaceId` to request preferred workspace resolution.
- Endpoint returns a unified bootstrap payload for desktop and thin clients:
  - actor profile (`userIdentityId`, `username`, optional display/email)
  - current session context (`sessionId`, provider/channel/device timing, assurance level)
  - safe trusted-device projection for the current session when available
  - workspace context projection (`requestedWorkspaceId`, `resolvedWorkspaceId`, and actor-visible workspace summaries)
- Workspace context is resolved through the authoritative workspace administration backend API seam when composed in host runtime.
- Endpoint is guarded by the same bearer-session validation pipeline as `GET /api/v1/identity/session`, so trust-invalid/revoked sessions are denied with the same authenticated failure semantics.

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

## Tests

- `src/infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `src/infrastructure/api/identity/IdentityAuthObservability.ts`
- `src/infrastructure/api/security/tests/CertificateOperationsBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerCertificateOperations.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerWebSocketTransportTrust.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeRealtimeWebSocket.test.ts`
- trusted-device transport lifecycle coverage in backend + HTTP integration tests (list/detail/revoke/rename + pairing initiate/validate/complete)
- `src/ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `src/ui/pages/tests/IdentityAdminPage.test.tsx`
- `src/ui/pages/tests/TrustedDevicesPage.test.tsx`

## Related docs

- `docs/architecture/identity-session-architecture.md` (session subsystem baseline)

## Converged protected asset transfer seam update (story 14.2.5)

- Converged asset transfer routes for upload/download/preview remain authoritative server routes under `/api/v1/assets/*`.
- Upload-content ingestion remains server-mediated through upload session endpoints:
  - `POST /api/v1/assets/upload-sessions/:uploadSessionId/content`
- Download and preview content retrieval remain policy-gated through tokenized routes:
  - `POST /api/v1/assets/:assetId/downloads/authorize`
  - `GET /api/v1/assets/:assetId/downloads/content`
- Transport response posture was tightened for converged clients:
  - upload-initiation responses no longer expose `storageInstanceId`/`objectKey`
  - preview-resolution responses no longer expose `previewStorageInstanceId`/`previewObjectKey`
