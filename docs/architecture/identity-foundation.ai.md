# AI Companion: Identity Foundation

## What this slice does

- Defines local identity domain contracts for providers, users, credentials, and sessions.
- Defines identity application ports for lookup/persistence/credential/session operations.
- Adds first-run local admin bootstrap orchestration.
- Adds reusable local account registration orchestration for non-bootstrap flows.
- Adds SQLite migrations/adapters for durable identity storage.
- Standardizes typed identity operation results and error taxonomy.

## Final handoff doc

- `docs/architecture/identity-feature-1-final-baseline.md` is the downstream implementation baseline for trusted device, workspace membership, and authorization follow-on work.

## Main files to cite

- `src/domain/identity/IdentityDomain.ts`
- `src/domain/identity/IdentityPolicy.ts`
- `application/identity/services/IdentitySessionLifecycleService.ts`
- `application/identity/services/IdentityAuthenticatedSessionService.ts`
- `application/contracts/IdentityApplicationContracts.ts`
- `application/contracts/IdentityLifecycleEventContracts.ts`
- `application/identity/ports/*`
- `application/identity/services/IdentityPolicyService.ts`
- `application/identity/ports/IIdentityLifecycleEventPublisher.ts`
- `application/identity/services/IdentityLifecycleEventPublishing.ts`
- `application/identity/services/IdentityBootstrapService.ts`
- `src/application/identity/use-cases/RegisterLocalAccountUseCase.ts`
- `src/application/identity/use-cases/VerifyLocalPasswordCredentialUseCase.ts`
- `src/application/identity/use-cases/LoginLocalAccountUseCase.ts`
- `src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase.ts`
- `src/application/identity/use-cases/LogoutIdentitySessionUseCase.ts`
- `src/application/identity/use-cases/RevokeIdentitySessionUseCase.ts`
- `src/application/identity/use-cases/ListLocalIdentityAccountsUseCase.ts`
- `src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase.ts`
- `src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `hosts/server/IdentityServerHost.ts`
- `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
- `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
- `application/identity/ports/IIdentityCredentialAuthenticator.ts`
- `application/identity/ports/IIdentityCredentialResetVerifier.ts`
- `application/identity/services/IdentityProviderCatalog.ts`
- `application/identity/services/LocalPasswordIdentityAuthenticator.ts`
- `application/identity/ports/ILocalPasswordCredentialService.ts`
- `infrastructure/security/identity/ScryptLocalPasswordCredentialService.ts`
- `infrastructure/security/identity/OpaqueIdentitySessionTokenService.ts`

## Persistence shape

- Tables: providers, policies, users, provider links, credential material history, sessions, session token material, migrations.
- Constraints enforce uniqueness for username/email/provider subject and single active credential material per provider subject.
- Credential hash material is isolated in `identity_credential_material_records`.
- Session token hash/signing material is isolated in `identity_session_token_material`.

## Provider extension seam

- Provider model already supports `local-password`, `oidc`, `oauth2`, `saml`, `passkey`, `custom`.
- Application provider descriptors include local capability metadata for authenticator support and credential expectations.
- Application authenticator contracts include extensible authenticator kinds (`password`, `passkey`) without requiring passkey implementation now.
- Identity links are provider-subject based, so external provider integration can reuse current contracts.
- Local-password specific normalization is isolated in policy logic, not hardcoded through the whole stack.

## Provider abstraction formalization (story 1.4.1)

- `application/identity/services/IdentityProviderCatalog.ts` now acts as the explicit provider abstraction surface:
  - descriptor map per provider kind/category
  - capability metadata (`supportedAuthenticators`, usernameless sign-in support)
  - credential-handling metadata (`materialMode`, credential-policy support, credential-material-record support)
  - identity-linkage semantics (provider-subject linkage with platform-owned `UserIdentity` as authorization subject)
- shared provider validation (`validateIdentityProvider(...)`) now checks runtime providers against required capabilities/status/category for each auth flow.
- Local auth use cases and bootstrap now rely on the shared provider abstraction instead of inline local-provider checks:
  - `IdentityBootstrapService`
  - `RegisterLocalAccountUseCase`
  - `LoginLocalAccountUseCase`
  - `VerifyLocalPasswordCredentialUseCase`
  - `ChangeLocalPasswordCredentialUseCase`
- Result: local identity remains operational while future OIDC/OAuth/SAML/Google/Microsoft provider additions can plug into descriptor + adapter seams without redesigning identity ownership or provider-link semantics.

## Local account administration use cases (story 1.4.2)

- New application use cases:
  - `src/application/identity/use-cases/ListLocalIdentityAccountsUseCase.ts`
  - `src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase.ts`
  - `src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase.ts`
- New behavior:
  - list local accounts with identity/provider-link/session status summaries
  - view a specific local account status payload
  - enable/disable local accounts through application orchestration
  - account disablement revokes active sessions with `admin` reason so bearer tokens fail on next guarded use
- Readiness seam:
  - admin operations require explicit action context (`actorUserIdentityId` plus optional authorization/audit context fields) without embedding role-policy decisions inside identity use cases
  - backend observability/audit flow taxonomy now includes administration operation types

## Identity administration server + UI surface (story 1.4.3)

- Authoritative admin routes are exposed for list/get/status-set:
  - `GET /api/v1/identity/admin/accounts`
  - `GET /api/v1/identity/admin/accounts/:userIdentityId`
  - `POST /api/v1/identity/admin/accounts/:userIdentityId/status`
- Renderer identity client/service seams now include those contracts:
  - `ui/shared/identity/IdentityAuthClient.ts`
  - `ui/services/IdentityAuthService.ts`
- Renderer administration UI now lives in:
  - `ui/pages/IdentityAdminPage.tsx`
- Current renderer behavior:
  - authenticated account listing + status inspection use real backend endpoints
  - enable/disable actions update persisted backend state and refresh list/status views
- empty/loading/error states are explicit in the administration surface

## Identity lifecycle event hooks (story 1.4.4)

- Identity lifecycle event contracts are now formalized in:
  - `application/contracts/IdentityLifecycleEventContracts.ts`
- The event publisher seam is an application port:
  - `application/identity/ports/IIdentityLifecycleEventPublisher.ts`
- Emission is best-effort by design through:
  - `application/identity/services/IdentityLifecycleEventPublishing.ts`
  - emission failures are intentionally swallowed so identity behavior does not hard depend on unfinished audit infrastructure.
- Current local identity lifecycle emission points:
  - `RegisterLocalAccountUseCase`: `identity.local-account.registered`
  - `LoginLocalAccountUseCase`: `identity.local-account.login-succeeded`, `identity.local-account.login-failed`
  - `ChangeLocalPasswordCredentialUseCase`: `identity.local-account.credential-changed`
  - `SetLocalIdentityAccountStatusUseCase` (disable path): `identity.local-account.disabled`
  - `IdentityAuthenticatedSessionService.issueAuthenticatedSession(...)`: `identity.session.created`
  - `LogoutIdentitySessionUseCase`: `identity.session.logged-out`
  - trusted-device services/session trust now also emit:
    - `identity.trusted-device.pairing-initiated`
    - `identity.trusted-device.pairing-completed`
    - `identity.trusted-device.pairing-failed`
    - `identity.trusted-device.revoked`
    - `identity.trusted-device.trust-status-changed`
    - `identity.session.trust-invalidated`

Identity server host now composes a default SQLite lifecycle-event publisher (`SqliteIdentityLifecycleEventPublisher`) so lifecycle audit events persist by default while preserving the same `IIdentityLifecycleEventPublisher` abstraction boundary.

## Sensitive-data redaction hardening (story 1.4.5)

Identity data-handling now uses centralized redaction and serializer seams to prevent accidental leakage of credential material, bearer/session secrets, and recovery-sensitive identity metadata.

Primary hardening seams:

- `infrastructure/api/identity/IdentityAuthRedaction.ts`
  - recursive object/array redaction by sensitive-key policy
  - freeform string redaction for bearer/session token patterns in error/log text
- `infrastructure/api/identity/IdentityAuthResponseSerializers.ts`
  - explicit allowlist mapping for identity API response payloads (including admin list/get/status outputs)
- `ui/shared/identity/IdentityAuthSessionStore.ts`
  - narrowed persisted session allowlist shape (`IdentityAuthPersistedSession`) for local runtime continuity without persisting non-required sensitive/trust metadata

Operational effect:

- backend observability, audit events, and transport logs all share one redaction posture
- identity API payloads avoid direct use-case object pass-through
- UI local storage no longer retains provider-subject/email/trust-marker/trusted-device metadata by default

## Local registration seam

- `RegisterLocalAccountUseCase` runs full local registration orchestration in the application layer.
- It validates/normalizes profile + provider subject, checks deterministic uniqueness conflicts, enforces credential policy, validates provider/authenticator compatibility, hashes password candidates through `IIdentityCredentialAuthenticator`, and persists identity + credential material.
- It depends only on identity application ports plus `IdentityPolicyService`, with structured operation results for duplicate/policy/provider/state failures.

## Local verification seam

- `VerifyLocalPasswordCredentialUseCase` provides local password verification for login/auth flows.
- It resolves provider capability metadata, normalizes local provider references, resolves active credential material, and verifies candidates through `IIdentityCredentialAuthenticator`.
- Missing credential material and password mismatches map to the same invalid-credentials failure contract.

## Local login seam

- `LoginLocalAccountUseCase` provides the transport-agnostic local login flow for local-password identities.
- It normalizes provider references, validates local provider-path compatibility via provider capability metadata, resolves the linked identity, enforces account/provider-link credential-state checks, and verifies credential candidates via the authenticator contract against active credential material.
- It returns authenticated-principal result fields intended for subsequent session issuance and device-trust checks.
- It emits structured failures for unknown identity, invalid credentials, inactive or disabled account state, and unsupported auth paths.

## Authoritative server API seam

- Registration and login are now exposed on authoritative HTTP endpoints:
- `POST /api/v1/identity/register`
- `POST /api/v1/identity/login`
- `POST /api/v1/identity/credential/change` (authenticated)
- HTTP transport validates requests at the boundary (strict schemas), maps inner identity failures to stable public API error codes, and returns bounded response envelopes.
- HTTP logging now redacts credential material (`credential`/`candidate` and related secret fields) before structured log emission.
- Detailed public API contract/examples are in `docs/architecture/identity-server-api.md`.

## Local credential change seam

- `ChangeLocalPasswordCredentialUseCase` provides the production credential-change orchestration for authenticated local accounts.
- Default mode (`current-credential`) verifies the prior credential material before allowing replacement.
- Replacement candidates are validated against policy constraints before mutation, including min-password-age and password-history reuse checks from `CredentialPolicy`.
- Replacement secrets are re-hashed through `IIdentityCredentialAuthenticator`, active credential material is rotated by superseding the prior active record, and provider-link credential state is refreshed with new `passwordChangedAt`.
- The flow returns deterministic typed failures across invalid credential, policy, account state, and provider/state alignment paths.

## Reset-ready verification seam

- Credential change verification is mode-based: `current-credential` (implemented) and `reset-assertion` (extension seam).
- `reset-assertion` is delegated to `application/identity/ports/IIdentityCredentialResetVerifier.ts`, which is intentionally token/workflow agnostic so reset-token and administrator-assisted flows can plug in later without changing the credential-change core.
- If no reset verifier is configured, reset mode fails deterministically with `identity-invalid-request`.

## Boundary clarity: identity vs trust

- Identity session records carry lifecycle state and optional client context only (`accessChannel`, `userAgent`, `ipAddress`, `deviceId`, `trustedDeviceBindingId`, `trustMarker`).
- Device trust and runtime/tool trust remain separate concerns (for example MCP trust modules).
- No identity invariant currently depends on device-attestation or runtime trust decisions.

## Session lifecycle model (story 1.3.1)

- Session lifecycle transitions are now first-class exports in the domain:
  - `IdentitySessionLifecycleTransitions`
  - `isSessionTransitionAllowed(...)`
- Session access channels are explicit (`desktop`, `thin-client`) so policy can differ by runtime surface.
- `IdentitySessionLifecycleService` now centralizes:
  - issuance with policy-derived TTL,
  - refresh/rotation when applicable,
  - revocation with explicit reasons,
  - expiration sweeps for due active sessions.
- Default policy posture:
  - desktop: long-lived, refresh disabled,
  - thin-client: shorter-lived, refresh enabled.

## Session issuance/persistence model (story 1.3.2)

- `IdentityAuthenticatedSessionService` composes successful login with session issuance and token persistence.
- Opaque bearer token generation/hashing is encapsulated in `IIdentitySessionTokenService` (`OpaqueIdentitySessionTokenService`).
- Token material persistence is encapsulated in `IIdentitySessionTokenMaterialRepository` and stored in `identity_session_token_material`.
- Raw token values are returned only at issuance time and are not persisted in session metadata rows.
- Login API flow now issues a persisted session and returns session metadata + bearer token fields.

## Authenticated-session validation guard model (story 1.3.3)

- `IdentityHttpServer` now includes guard infrastructure for bearer-token protected routes.
- Guard extraction/parsing of `Authorization` headers stays in transport code.
- Session validation and principal resolution are delegated to `IdentityAuthBackendApi.resolveAuthenticatedSession(...)`, which composes:
  - `IdentityAuthenticatedSessionService.resolveAuthenticatedSessionByToken(...)`
  - `IIdentityLookupRepository.findUserIdentityById(...)`
- Successful guard evaluation passes authenticated context (principal + session metadata) to downstream handlers.
- Missing, invalid, expired, and revoked sessions are normalized to the same external failure posture (`401` + `authentication-failed`).
- Current protected endpoint: `GET /api/v1/identity/session`.

## Session logout/revocation model (story 1.3.4)

- Logout is now an explicit application/API flow that revokes the bearer-authenticated current session:
  - `LogoutIdentitySessionUseCase`
  - `POST /api/v1/identity/logout`
- Targeted revocation is now an explicit application/API flow for authenticated principals:
  - `RevokeIdentitySessionUseCase`
  - `POST /api/v1/identity/session/revoke`
- `IdentityAuthenticatedSessionService.revokeAuthenticatedSessionById(...)` now supports system-driven revocation seams by session id.
- Revocation updates both persistence surfaces in this slice:
  - `identity_sessions.status` becomes `revoked`
  - `identity_session_token_material.invalidated_at` is set
- Resulting consistency behavior is immediate for subsequent guard checks in local SQLite-backed runtime state: revoked sessions are rejected as `401` + `authentication-failed`.

## Session policy configuration and expiry controls (story 1.3.5)

- Session policy is now environment-configurable through `infrastructure/config/IdentitySessionPolicyConfig.ts` and injected by `hosts/server/IdentityServerHost.ts` into `IdentitySessionLifecycleService`.
- Per-channel controls now include:
  - absolute TTL (`ttlMinutes`)
  - refresh allowance (`allowRefresh`)
  - optional inactivity timeout (`inactivityTimeoutMinutes`)
- Supported environment variables:
  - `IDENTITY_SESSION_DESKTOP_TTL_MINUTES`
  - `IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH`
  - `IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES`
  - `IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES`
  - `IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH`
  - `IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES`
- Policy evaluation remains in application services:
  - issuance/refresh in `IdentitySessionLifecycleService`
  - validation-time rolling inactivity + absolute-cap expiry in `IdentityAuthenticatedSessionService`
  - transport guard code consumes results only (no transport-level policy logic).
- Default posture remains explicit:
  - desktop: 30-day TTL, refresh disabled, inactivity timeout unset
  - thin-client: 12-hour TTL, refresh enabled, inactivity timeout unset

## Trusted-device binding seams (story 1.3.6)

- Session client context now includes optional trusted-device seam fields:
  - `trustedDeviceBindingId`
  - `trustMarker`
- These are persisted in `identity_sessions` as:
  - `client_trusted_device_binding_id`
  - `client_trust_marker`
- `IdentityAuthenticatedSessionService` now exposes an optional validation extension hook:
  - `application/identity/ports/IIdentitySessionTrustEvaluator.ts`
  - the evaluator can participate in bearer-token session validation and deny sessions with existing invalid-session-state outcomes
- No trust evaluator is wired by default in this slice, so existing local-session behavior remains unchanged.
- Authenticated-session resolution contracts now surface device/trust seam fields (`deviceId`, `trustedDeviceBindingId`, `trustMarker`) so later trusted-device policy work can compose on existing principal/session resolution flows.

## Client session-state exposure (story 1.3.7)

- Renderer auth state is now derived from real session validation (`GET /api/v1/identity/session`) rather than local presence-only assumptions.
- `ui/App.tsx` performs authenticated bootstrap checks before mounting authenticated providers and refreshes session validity on visibility return.
- Session persistence now follows platform conventions through a shared store seam:
  - desktop prefers preload desktop storage bridge (`window.aiLoomDesktop.storage`)
  - thin-client/web uses browser local storage
- Login now sends channel-aware session context (`desktop` or `thin-client`) plus client user-agent metadata through shared environment helpers.
- Expired or revoked sessions are cleared locally and routed back to sign-in with explicit recovery notices.

## Provider/account policy runtime configuration (story 1.4.6)

- Provider/account policy configuration is now centralized in:
  - `infrastructure/config/IdentityProviderAccountPolicyConfig.ts`
- `hosts/server/IdentityServerHost.ts` now composes this config from environment and applies startup seeding/feature toggles:
  - local provider status enablement (`active` vs `disabled`)
  - startup bootstrap seeding for local provider + credential policy defaults
  - local registration toggle
  - identity administration toggle
- local credential policy defaults are environment-driven and validated through domain policy construction (`createCredentialPolicy(...)`) before being persisted.
- invalid or incoherent values fail fast with explicit configuration errors.

## Read next

- Full architecture note: `docs/architecture/identity-foundation.md`
- Server endpoint contract note: `docs/architecture/identity-server-api.md`
- Session subsystem note: `docs/architecture/identity-session-architecture.md`

