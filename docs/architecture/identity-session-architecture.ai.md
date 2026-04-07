# AI Companion: Identity Session Architecture

## Purpose

Provide the implementation-aligned baseline for session lifecycle, issuance, validation, revocation, policy controls, client behavior, and trusted-device seams.

## Core files

- `src/domain/identity/IdentityDomain.ts`
- `src/application/identity/services/IdentitySessionLifecycleService.ts`
- `src/application/identity/services/IdentityAuthenticatedSessionService.ts`
- `src/application/identity/use-cases/LogoutIdentitySessionUseCase.ts`
- `src/application/identity/use-cases/RevokeIdentitySessionUseCase.ts`
- `src/infrastructure/config/IdentitySessionPolicyConfig.ts`
- `src/infrastructure/security/identity/OpaqueIdentitySessionTokenService.ts`
- `src/infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/ui/shared/identity/IdentityAuthSessionCoordinator.ts`
- `src/ui/shared/identity/IdentityAuthSessionStore.ts`

## Session subsystem boundaries

- Session metadata lifecycle is stored in `identity_sessions`.
- Token lookup/invalidation material is stored separately in `identity_session_token_material`.
- Raw bearer tokens are never persisted; only token hashes are stored.
- Trust/device fields are context seams, not default authorization decisions.

## Lifecycle semantics

- statuses: `active`, `rotated`, `expired`, `revoked`
- legal transitions: `active -> rotated|expired|revoked`
- terminal statuses: `rotated`, `expired`, `revoked`

Service ownership:

- `IdentitySessionLifecycleService`: issue/refresh/revoke/expiry-sweep + policy math.
- `IdentityAuthenticatedSessionService`: token issuance, bearer-token resolution, invalidation, optional trust-evaluator integration.

## Guard and endpoint behavior

Guarded endpoints:

- `GET /api/v1/identity/session`
- `POST /api/v1/identity/credential/change`
- `POST /api/v1/identity/logout`
- `POST /api/v1/identity/session/revoke`
- `GET /api/v1/identity/admin/accounts`
- `GET /api/v1/identity/admin/accounts/:userIdentityId`
- `POST /api/v1/identity/admin/accounts/:userIdentityId/status`

`IdentityHttpServer.requireAuthenticatedSession(...)`:

- extracts bearer token
- resolves principal/session via backend API
- injects shared actor metadata (`actor.userIdentityId`, `actor.username`) into downstream route context
- normalizes missing/invalid/expired/revoked to `401` + `authentication-failed`
- account disablement now revokes all active sessions for the target account with `admin` reason in administration status-mutation flow

`IdentityHttpServer.requireAuthenticatedWorkspaceSession(...)`:

- composes authenticated-session resolution with workspace-scope resolution for converged routes
- supplies workspace metadata (`workspace.workspaceId`) before route handler execution
- preserves shared semantics: unauthenticated `401/authentication-failed`, authenticated missing workspace `400/invalid-request`

## Policy controls

Environment variables:

- `IDENTITY_SESSION_DESKTOP_TTL_MINUTES`
- `IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH`
- `IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH`
- `IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES`
- `IDENTITY_SESSION_DESKTOP_TRUST_REQUIREMENT` (`allow-untrusted` | `allow-pairing` | `require-trusted`)
- `IDENTITY_SESSION_THIN_CLIENT_TRUST_REQUIREMENT` (`allow-untrusted` | `allow-pairing` | `require-trusted`)

Defaults:

- desktop: 30 days, refresh disabled
- thin-client: 12 hours, refresh enabled
- trust defaults: desktop `allow-pairing`, thin-client `allow-untrusted`

Validation rules:

- TTL/inactivity must be integer >= 1
- inactivity timeout cannot exceed TTL

## Client integration expectations

- login includes channel (`desktop`/`thin-client`) and optional client metadata
- UI stores session token, validates via `/api/v1/identity/session` on bootstrap
- visibility return re-validates and clears stale/revoked sessions
- desktop uses preload storage bridge when available; web uses local storage

## Session trust model

- sessions now carry structured device trust context (`deviceTrust`) in addition to legacy compatibility fields:
  - `trustedDeviceId`
  - `issuedOnTrustedDevice`
  - `sessionAssuranceLevel`
  - `snapshot` (`state`, `evaluatedAt`)
  - `invalidationReasons` (`trusted-device-revoked`, `trusted-device-trust-lost`, `trusted-device-expired`, `trusted-device-mismatch`)
- persistence now includes dedicated trust columns on `identity_sessions` (migration version `6`) for trusted device id, assurance level, trust-state snapshot, and invalidation reasons JSON.
- login issuance and session-resolution contracts accept/return structured trust context while preserving legacy `trustedDeviceBindingId` / `trustMarker` fields for compatibility.
- optional `IIdentitySessionTrustEvaluator` can deny sessions and return trust invalidation reasons for deterministic runtime failure context.
- `TrustedDeviceSessionTrustService` is now wired by the runtime host and evaluates trusted-device bindings against repository state during session validation.
- Validation now fails closed for bound sessions when trusted device state is missing, revoked, expired, or mismatched.
- Trust-evaluation denial now performs lazy runtime invalidation: the active session is revoked (`security`) and bearer token material is invalidated immediately.
- Trust-evaluation invalidation now emits a dedicated lifecycle audit event (`identity.session.trust-invalidated`) including session id, user identity, trusted-device linkage (when present), invalidation reasons, and invalidation timestamp.
- Session validation failures caused by trust now surface a distinct trust-failure response path in API errors (`error.trustFailure.reason`, `error.trustFailure.invalidationReasons`) for user handling and observability.
- Trusted-session trust markers are now material-aware; marker mismatch against current trusted-device material is treated as stale/mismatched trust and rejected.
- Login/session issuance now resolves trust from repository state (not client-asserted trust claims), supports request-level trust posture (`allow-untrusted`, `allow-pairing`, `require-trusted`), and can deny issuance when trust requirements are unmet.

## Primary tests

- `src/application/identity/tests/IdentitySessionLifecycleService.test.ts`
- `src/application/identity/tests/IdentityAuthenticatedSessionService.test.ts`
- `src/application/identity/tests/LogoutIdentitySessionUseCase.test.ts`
- `src/application/identity/tests/RevokeIdentitySessionUseCase.test.ts`
- `src/infrastructure/config/tests/IdentitySessionPolicyConfig.test.ts`
- `src/infrastructure/config/tests/IdentitySessionTrustPolicyConfig.test.ts`
- `src/infrastructure/security/identity/tests/OpaqueIdentitySessionTokenService.test.ts`
- `src/infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/application/identity/tests/TrustedDeviceSessionTrustService.test.ts`

