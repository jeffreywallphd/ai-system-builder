# Identity Session Architecture

This note documents the production session subsystem used by local identity in AI Loom Studio. It is implementation-aligned and focused on lifecycle, issuance, validation, revocation, policy controls, runtime integration, and trusted-device extension seams.

## Scope and boundaries

In scope:

- identity session lifecycle rules and transitions
- authenticated session issuance and opaque token material handling
- bearer-token validation and protected-route guard behavior
- logout and targeted session revocation flows
- channel-aware policy configuration and inactivity behavior
- renderer session bootstrap/refresh expectations
- trusted-device linkage seams currently present in contracts/persistence

Out of scope:

- external identity protocols (OIDC/OAuth/SAML/passkey adapters)
- full device attestation, trust scoring, or risk engines
- refresh-token family semantics (current model is single opaque bearer token per session id)

## Responsibilities by layer

### Domain

- `src/domain/identity/IdentityDomain.ts`

Responsibilities:

- canonical session model (`Session`) and status set (`active`, `rotated`, `expired`, `revoked`)
- lifecycle transition matrix (`IdentitySessionLifecycleTransitions`)
- transition guard (`isSessionTransitionAllowed(...)`)
- immutable state transition helpers (`createSession`, `rotateSession`, `revokeSession`, `expireSession`)
- session client context shape, including trusted-device seam fields

### Application

- `application/identity/services/IdentitySessionLifecycleService.ts`
- `application/identity/services/IdentityAuthenticatedSessionService.ts`
- `src/application/identity/use-cases/LogoutIdentitySessionUseCase.ts`
- `src/application/identity/use-cases/RevokeIdentitySessionUseCase.ts`
- `application/identity/ports/IIdentitySessionRepository.ts`
- `application/identity/ports/IIdentitySessionTokenMaterialRepository.ts`
- `application/identity/ports/IIdentitySessionTokenService.ts`
- `application/identity/ports/IIdentitySessionTrustEvaluator.ts`

Responsibilities:

- issue sessions from policy + channel context
- calculate absolute and rolling expiry windows
- resolve authenticated session by bearer token hash lookup
- enforce lifecycle status, expiry, token invalidation, and optional trust evaluation
- revoke current (logout) or specific (revoke) sessions with deterministic failure contracts

### Infrastructure and host

- `infrastructure/security/identity/OpaqueIdentitySessionTokenService.ts`
- `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
- `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`
- `infrastructure/config/IdentitySessionPolicyConfig.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `hosts/server/IdentityServerHost.ts`

Responsibilities:

- generate opaque tokens (`loom_sess_*`) and hash with SHA-256 (base64url)
- persist session metadata separately from token hash material
- parse environment policy config and inject into lifecycle service
- expose HTTP endpoints and guard for bearer-authenticated session routes
- compose all dependencies into the identity server runtime

### UI/runtime integration

- `ui/shared/identity/IdentityAuthClient.ts`
- `ui/services/IdentityAuthService.ts`
- `ui/shared/identity/IdentityAuthEnvironment.ts`
- `ui/shared/identity/IdentityAuthSessionStore.ts`
- `ui/shared/identity/IdentityAuthSessionCoordinator.ts`
- `ui/App.tsx`

Responsibilities:

- send channel/client context on login
- persist issued session token in desktop bridge storage or browser local storage
- bootstrap authenticated state via `GET /api/v1/identity/session`
- clear local session on expiry, invalidation, or validation failure
- refresh session validity on app visibility return

## Data model and persistence split

Session metadata table:

- `identity_sessions`
- contains lifecycle and client context:
  - ids/principal linkage (`session_id`, `user_identity_id`, `provider_id`, `provider_subject`)
  - lifecycle fields (`status`, `issued_at`, `expires_at`, `rotated_at`, `replaced_by_session_id`, `revocation_reason`, `revoked_at`)
  - context fields (`client_access_channel`, `client_user_agent`, `client_ip_address`, `client_device_id`, `client_trusted_device_binding_id`, `client_trust_marker`)

Token material table:

- `identity_session_token_material`
- contains token lookup and invalidation fields:
  - `session_id`
  - `token_hash` (unique)
  - `hash_algorithm` (`sha256`)
  - `token_type` (`opaque-bearer`)
  - `created_at`, `updated_at`, `expires_at`, `invalidated_at`

Key boundary:

- plaintext bearer token is returned once at issuance and is never stored in `identity_sessions` or `identity_session_token_material`

## Lifecycle and policy behavior

### Session statuses and legal transitions

- `active -> rotated | expired | revoked`
- `rotated`, `expired`, and `revoked` are terminal in current implementation

### Issuance rules

- session issuance requires non-empty `userIdentityId`, `providerId`, `providerSubject`, and supported `accessChannel`
- access-channel policy determines TTL and inactivity behavior
- initial `expiresAt` is calculated via rolling policy anchored at issuance time

### Validation rules

Bearer-token validation path (`resolveAuthenticatedSessionByToken`) enforces:

1. token is present and normalizable
2. token hash resolves to persisted token material
3. token material is not invalidated
4. linked session exists
5. session has not passed `expiresAt`; expired sessions are marked `expired` and token material is invalidated
6. session status is `active`
7. optional trust evaluator allows session (if injected)
8. rolling expiry is extended on activity when policy allows and resulting expiry exceeds current value
9. token material `updated_at` and `expires_at` are synchronized with resolved session

### Revocation rules

- logout (`POST /api/v1/identity/logout`) revokes the currently authenticated session with reason `logout`
- targeted revoke (`POST /api/v1/identity/session/revoke`) revokes a specific session id; actor ownership is enforced by use case when actor id is supplied
- revocation updates both persistence surfaces:
  - session status becomes `revoked` with revocation metadata
  - token material `invalidated_at` is set

### Refresh/rotation seam

- `IdentitySessionLifecycleService.refreshSession(...)` supports policy-gated refresh that rotates to a new session id and marks prior session `rotated`
- this seam is implemented but not currently exposed as a public HTTP endpoint in this slice

## HTTP contract and guard posture

Current session-related endpoints:

- `GET /api/v1/identity/session` (authenticated)
- `POST /api/v1/identity/logout` (authenticated)
- `POST /api/v1/identity/session/revoke` (authenticated)

Guard behavior in `IdentityHttpServer`:

- extracts `Authorization: Bearer <token>`
- resolves session/principal through `IdentityAuthBackendApi.resolveAuthenticatedSession(...)`
- injects authenticated context into route handlers
- normalizes missing/invalid/expired/revoked session states to `401` + `authentication-failed`

Operational expectation:

- revocation or expiry is effective on the next guarded request under local SQLite consistency

## Policy controls

Environment-backed policy source:

- `infrastructure/config/IdentitySessionPolicyConfig.ts`

Variables:

- `IDENTITY_SESSION_DESKTOP_TTL_MINUTES`
- `IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH`
- `IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH`
- `IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES`

Validation constraints:

- `ttlMinutes >= 1`
- `allowRefresh` must parse as boolean
- optional `inactivityTimeoutMinutes >= 1`
- optional `inactivityTimeoutMinutes <= ttlMinutes`

Default posture:

- desktop: `ttlMinutes=43200` (30 days), `allowRefresh=false`
- thin-client: `ttlMinutes=720` (12 hours), `allowRefresh=true`
- inactivity timeout unset for both channels unless configured

## Client integration expectations

Login request should include:

- `accessChannel` from runtime (`desktop` or `thin-client`)
- optional `client.userAgent`, and optional future trust metadata fields

Client session-state flow:

1. on login success, persist returned session payload/token
2. on app bootstrap, call `resolveAuthenticatedSession` using stored token
3. if validation fails or session is expired, clear local session and route to sign-in
4. on visibility regain, re-validate to detect server-side revocation/expiry
5. on logout action, call logout API then clear local session regardless of transport success

Storage selection:

- desktop: `window.aiLoomDesktop.storage` when present
- thin-client/web: `window.localStorage`

## Trusted-device linkage seam

Current seam fields:

- login/session context fields: `trustedDeviceBindingId`, `trustMarker`
- persisted in `identity_sessions` as `client_trusted_device_binding_id` and `client_trust_marker`
- surfaced by session-resolution contracts and UI-hydrated session state

Evaluation seam:

- `IIdentitySessionTrustEvaluator` can be injected into `IdentityAuthenticatedSessionService`
- evaluator can deny runtime session validity with existing `identity-invalid-session-state` outcomes

Current behavior:

- no default trust evaluator is wired by `IdentityServerHost`
- trusted-device fields are context-carrying metadata only in this slice

## Sequence diagrams

### Login + issuance

```text
Client -> IdentityHttpServer: POST /api/v1/identity/login
IdentityHttpServer -> IdentityAuthBackendApi: loginLocalAccount(request)
IdentityAuthBackendApi -> LoginLocalAccountUseCase: execute(credentials)
LoginLocalAccountUseCase --> IdentityAuthBackendApi: authenticated principal
IdentityAuthBackendApi -> IdentityAuthenticatedSessionService: issueAuthenticatedSession(...)
IdentityAuthenticatedSessionService -> IdentitySessionLifecycleService: issueSession(...)
IdentitySessionLifecycleService -> IIdentitySessionRepository: saveSession(active session)
IdentityAuthenticatedSessionService -> IIdentitySessionTokenService: issueToken() + hash
IdentityAuthenticatedSessionService -> IIdentitySessionTokenMaterialRepository: saveSessionTokenMaterial(token hash)
IdentityAuthBackendApi --> IdentityHttpServer: login success + bearer token + session metadata
IdentityHttpServer --> Client: 200 { ok: true, data: ... }
```

### Guarded request validation

```text
Client -> IdentityHttpServer: GET /api/v1/identity/session (Bearer token)
IdentityHttpServer -> IdentityAuthBackendApi: resolveAuthenticatedSession(token)
IdentityAuthBackendApi -> IdentityAuthenticatedSessionService: resolveAuthenticatedSessionByToken(token)
IdentityAuthenticatedSessionService -> TokenMaterialRepo: lookup by token hash
IdentityAuthenticatedSessionService -> SessionRepo: getSessionById
IdentityAuthenticatedSessionService -> (optional) TrustEvaluator: evaluateSessionTrust
IdentityAuthenticatedSessionService -> SessionRepo/TokenRepo: persist rolling expiry + updatedAt
IdentityAuthBackendApi -> IdentityLookupRepository: findUserIdentityById
IdentityAuthBackendApi --> IdentityHttpServer: principal + session context
IdentityHttpServer --> Client: 200 { ok: true, data: ... }
```

### Logout/revoke

```text
Client -> IdentityHttpServer: POST /api/v1/identity/logout (Bearer token)
IdentityHttpServer -> IdentityAuthBackendApi: logoutAuthenticatedSession(token)
IdentityAuthBackendApi -> LogoutIdentitySessionUseCase: execute(token)
LogoutIdentitySessionUseCase -> IdentityAuthenticatedSessionService: invalidateAuthenticatedSession(token, logout)
IdentityAuthenticatedSessionService -> IdentitySessionLifecycleService: revokeSession(sessionId, logout)
IdentityAuthenticatedSessionService -> TokenMaterialRepo: invalidateSessionTokenMaterial(sessionId)
IdentityHttpServer --> Client: 200 revoked metadata
```

## Contributor integration checklist

- new protected identity routes should use `requireAuthenticatedSession(...)` in `IdentityHttpServer`
- avoid direct token parsing/validation logic in route handlers; use backend API + application services
- keep session metadata and token material updates consistent across both tables
- preserve bounded external error surface (`invalid-request`, `authentication-failed`, etc.)
- when adding trust enforcement, inject `IIdentitySessionTrustEvaluator` via host composition without coupling trust rules into domain session invariants

## Test coverage map

Primary tests for this subsystem:

- `application/identity/tests/IdentitySessionLifecycleService.test.ts`
- `application/identity/tests/IdentityAuthenticatedSessionService.test.ts`
- `application/identity/tests/LogoutIdentitySessionUseCase.test.ts`
- `application/identity/tests/RevokeIdentitySessionUseCase.test.ts`
- `infrastructure/config/tests/IdentitySessionPolicyConfig.test.ts`
- `infrastructure/security/identity/tests/OpaqueIdentitySessionTokenService.test.ts`
- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `infrastructure/filesystem/identity/tests/SqliteIdentityRepository.test.ts`

