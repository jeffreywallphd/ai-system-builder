# Feature 1 Final Baseline: Local Identity and Account Lifecycle

This document is the final implementation baseline for Feature 1 and Epic 1.4. It summarizes what is production-ready today and what downstream epics must implement next.

## Baseline status

Feature 1 local identity/account lifecycle is implemented end-to-end for local-password providers:

- local account registration
- local account login
- authenticated session issuance and validation
- local credential change
- logout and session revocation
- local account administration (list/get/enable/disable)
- provider abstraction + lifecycle event hooks + safe redaction/serialization seams

Primary composition root:

- `src/hosts/server/IdentityServerHost.ts`

## Production capability map

### 1. Local identity lifecycle

Core use cases in `src/application/identity/use-cases/`:

- `RegisterLocalAccountUseCase.ts`
- `LoginLocalAccountUseCase.ts`
- `VerifyLocalPasswordCredentialUseCase.ts`
- `ChangeLocalPasswordCredentialUseCase.ts`
- `LogoutIdentitySessionUseCase.ts`
- `RevokeIdentitySessionUseCase.ts`

Core services:

- `src/application/identity/services/IdentityPolicyService.ts`
- `src/application/identity/services/IdentityProviderCatalog.ts`
- `src/application/identity/services/LocalPasswordIdentityAuthenticator.ts`

### 2. Session lifecycle and guard

- `src/application/identity/services/IdentitySessionLifecycleService.ts`
- `src/application/identity/services/IdentityAuthenticatedSessionService.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`

Session policy config:

- `src/infrastructure/config/IdentitySessionPolicyConfig.ts`

### 3. Administration readiness

Admin use cases:

- `ListLocalIdentityAccountsUseCase.ts`
- `GetLocalIdentityAccountStatusUseCase.ts`
- `SetLocalIdentityAccountStatusUseCase.ts`

Administrative action context contract:

- `src/application/identity/use-cases/IdentityAdministrativeContext.ts`

Current behavior:

- local account disablement revokes active sessions (`admin` reason)
- administration actions require actor identity context
- role/permission policy enforcement is intentionally out of scope in this feature

### 4. Persistence and migration state

SQLite adapters:

- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`

Current migration baseline:

- identity schema version `4`

### 5. Authoritative API surface

Transport and API mapping:

- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/identity/sdk/PublicIdentityAuthApiContract.ts`

Implemented endpoints:

- `POST /api/v1/identity/register`
- `POST /api/v1/identity/login`
- `GET /api/v1/identity/session`
- `POST /api/v1/identity/credential/change`
- `POST /api/v1/identity/logout`
- `POST /api/v1/identity/session/revoke`
- `GET /api/v1/identity/admin/accounts`
- `GET /api/v1/identity/admin/accounts/:userIdentityId`
- `POST /api/v1/identity/admin/accounts/:userIdentityId/status`

### 6. Feature policy toggles and startup defaults

Provider/account policy config:

- `src/infrastructure/config/IdentityProviderAccountPolicyConfig.ts`

Host applies startup defaults + policy toggles in:

- `src/hosts/server/IdentityServerHost.ts`

Important toggles:

- `IDENTITY_LOCAL_PROVIDER_ENABLED`
- `IDENTITY_BOOTSTRAP_SEED_DEFAULTS`
- `IDENTITY_ACCOUNT_ALLOW_LOCAL_REGISTRATION`
- `IDENTITY_ACCOUNT_ALLOW_ADMINISTRATION`

## Runtime flow summaries

### Register + login + session issuance

```text
Client -> IdentityHttpServer -> IdentityAuthBackendApi
IdentityAuthBackendApi -> Register/Login use case
Login success -> IdentityAuthenticatedSessionService.issueAuthenticatedSession(...)
Token hash persisted, plaintext token returned once
```

### Authenticated route guard

```text
Bearer token -> IdentityHttpServer.requireAuthenticatedSession(...)
-> IdentityAuthBackendApi.resolveAuthenticatedSession(...)
-> IdentityAuthenticatedSessionService.resolveAuthenticatedSessionByToken(...)
-> principal/session context for handler
```

### Admin disable account

```text
Admin API status-set(action=disable)
-> SetLocalIdentityAccountStatusUseCase
-> account status update + revoke active sessions(reason=admin)
```

## Downstream epic integration notes

### Trusted device pairing (next dependency seam)

Already implemented seams:

- login/session client fields: `trustedDeviceBindingId`, `trustMarker`
- trust evaluator port: `src/application/identity/ports/IIdentitySessionTrustEvaluator.ts`

Downstream work required:

1. Implement trusted-device binding persistence and issuance flows.
2. Implement a real `IIdentitySessionTrustEvaluator` and wire it in host composition.
3. Define pairing APIs/claims lifecycle (challenge, approval, revocation).
4. Define trust-marker rotation/expiry behavior independent from raw session TTL.

### Workspace membership

Already implemented seam:

- authenticated principal identity from `/api/v1/identity/session`

Downstream work required:

1. Introduce workspace membership model keyed by `userIdentityId`.
2. Add membership resolution middleware/use-case boundaries for protected workspace APIs.
3. Keep workspace membership authorization out of identity services; compose it after session resolution.

### Authorization

Already implemented seam:

- admin action context includes `authorization`/`audit` envelopes

Current limitation (intentional):

- identity administration endpoints currently rely on authentication but do not enforce role/permission policy.

Downstream work required:

1. Add a policy engine/authorizer and evaluate privileges before admin use-case execution.
2. Populate `IdentityAdministrativeAuthorizationContext.assertions` from platform authorization decisions.
3. Standardize denial mapping (`forbidden`) with explicit reason/audit attribution.

## Operational notes

- Local provider and credential policy defaults can be seeded at host startup.
- If local registration is disabled via policy, register endpoint returns `forbidden`.
- If local administration is disabled via policy, admin endpoints return `forbidden`.
- Session behavior (TTL, refresh, inactivity) is environment-driven via `IDENTITY_SESSION_*` variables.

## Test coverage baseline

Application tests:

- `src/application/identity/tests/*.test.ts`

Infrastructure/API tests:

- `src/infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `src/infrastructure/api/identity/tests/IdentityAuthRedaction.test.ts`
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/infrastructure/persistence/identity/tests/SqliteIdentityPersistenceAdapter.test.ts`

UI tests covering identity API consumers:

- `src/ui/shared/identity/tests/IdentityAuthClient.test.ts`
- `src/ui/pages/tests/IdentityAdminPage.test.tsx`

## Companion docs

- `docs/architecture/identity-foundation.md`
- `docs/architecture/identity-server-api.md`
- `docs/architecture/identity-session-architecture.md`
