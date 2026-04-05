# AI Companion: Identity Session Architecture

## Purpose

Provide the implementation-aligned baseline for session lifecycle, issuance, validation, revocation, policy controls, client behavior, and trusted-device seams.

## Core files

- `src/domain/identity/IdentityDomain.ts`
- `application/identity/services/IdentitySessionLifecycleService.ts`
- `application/identity/services/IdentityAuthenticatedSessionService.ts`
- `src/application/identity/use-cases/LogoutIdentitySessionUseCase.ts`
- `src/application/identity/use-cases/RevokeIdentitySessionUseCase.ts`
- `infrastructure/config/IdentitySessionPolicyConfig.ts`
- `infrastructure/security/identity/OpaqueIdentitySessionTokenService.ts`
- `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
- `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `hosts/server/IdentityServerHost.ts`
- `ui/shared/identity/IdentityAuthSessionCoordinator.ts`
- `ui/shared/identity/IdentityAuthSessionStore.ts`

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
- `POST /api/v1/identity/logout`
- `POST /api/v1/identity/session/revoke`

`IdentityHttpServer.requireAuthenticatedSession(...)`:

- extracts bearer token
- resolves principal/session via backend API
- normalizes missing/invalid/expired/revoked to `401` + `authentication-failed`

## Policy controls

Environment variables:

- `IDENTITY_SESSION_DESKTOP_TTL_MINUTES`
- `IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH`
- `IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH`
- `IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES`

Defaults:

- desktop: 30 days, refresh disabled
- thin-client: 12 hours, refresh enabled

Validation rules:

- TTL/inactivity must be integer >= 1
- inactivity timeout cannot exceed TTL

## Client integration expectations

- login includes channel (`desktop`/`thin-client`) and optional client metadata
- UI stores session token, validates via `/api/v1/identity/session` on bootstrap
- visibility return re-validates and clears stale/revoked sessions
- desktop uses preload storage bridge when available; web uses local storage

## Trusted-device seam

- optional fields: `trustedDeviceBindingId`, `trustMarker`
- persisted on sessions and returned in resolution payloads
- optional `IIdentitySessionTrustEvaluator` can deny sessions
- no default evaluator is composed in host wiring yet

## Primary tests

- `application/identity/tests/IdentitySessionLifecycleService.test.ts`
- `application/identity/tests/IdentityAuthenticatedSessionService.test.ts`
- `application/identity/tests/LogoutIdentitySessionUseCase.test.ts`
- `application/identity/tests/RevokeIdentitySessionUseCase.test.ts`
- `infrastructure/config/tests/IdentitySessionPolicyConfig.test.ts`
- `infrastructure/security/identity/tests/OpaqueIdentitySessionTokenService.test.ts`
- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`

