# Identity Foundation

This note documents the implemented identity foundation for local accounts in AI Loom Studio. It captures current contracts, persistence shape, invariants, and extension seams for future providers.

## Scope

Implemented in this slice:

- identity domain model for providers, users, credentials, and sessions
- identity policy normalization and validation
- application ports for lookup, persistence, credential material, and sessions
- bootstrap service for first local admin account
- SQLite persistence adapters and migrations
- shared identity error/result taxonomy

Out of scope in this slice:

- full end-user registration/login API handlers
- external identity provider protocol adapters (OIDC/OAuth/SAML/passkey)
- device trust scoring and device attestation
- runtime/tool trust policy engines

## Layered Architecture

### Domain

Primary files:

- `src/domain/identity/IdentityDomain.ts`
- `src/domain/identity/IdentityPolicy.ts`
- `application/identity/services/IdentitySessionLifecycleService.ts`
- `application/identity/services/IdentityAuthenticatedSessionService.ts`

Core concepts:

- `AuthProvider`: provider identity, kind, category (`local` or `external`), lifecycle status
- `CredentialPolicy`: password/credential policy rules
- `CredentialState`: per-provider-link credential state
- `UserIdentity`: account identity with linked provider subjects
- `Session`: issued login/session token record and lifecycle

Key invariants enforced in domain code:

- every user has at least one provider link and exactly one primary link
- provider links are unique by `providerId + providerSubject` within a user
- user lifecycle transitions are constrained (`pending-activation -> active`, etc.)
- session lifecycle transitions are constrained (`active -> rotated|expired|revoked`)
- session expiry must be later than issue time
- session access channels are explicit (`desktop` and `thin-client`) for channel-specific policy handling
- locked credentials require `lockoutUntil`
- credential policy constraints are validated at creation and candidate evaluation

### Application

Primary files:

- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/ports/IIdentityLookupRepository.ts`
- `application/identity/ports/IIdentityPersistenceRepository.ts`
- `application/identity/ports/ICredentialMaterialRepository.ts`
- `application/identity/ports/IIdentitySessionRepository.ts`
- `application/identity/ports/IIdentitySessionTokenMaterialRepository.ts`
- `application/identity/ports/IIdentitySessionTokenService.ts`
- `application/identity/ports/IIdentityClock.ts`
- `application/identity/ports/IIdentityIdGenerator.ts`
- `application/identity/ports/IIdentityCredentialAuthenticator.ts`
- `application/identity/ports/IIdentityCredentialResetVerifier.ts`
- `application/identity/ports/ILocalPasswordCredentialService.ts`
- `application/identity/services/IdentityPolicyService.ts`
- `application/identity/services/IdentityProviderCatalog.ts`
- `application/identity/services/LocalPasswordIdentityAuthenticator.ts`
- `application/identity/services/IdentityBootstrapService.ts`
- `src/application/identity/use-cases/RegisterLocalAccountUseCase.ts`
- `src/application/identity/use-cases/VerifyLocalPasswordCredentialUseCase.ts`
- `src/application/identity/use-cases/LoginLocalAccountUseCase.ts`
- `src/application/identity/use-cases/ChangeLocalPasswordCredentialUseCase.ts`
- `infrastructure/security/identity/OpaqueIdentitySessionTokenService.ts`

Application responsibilities:

- normalize registration/provider-reference inputs using domain policy
- perform uniqueness checks across username/email/provider subject
- expose deterministic conflict ordering and typed operation results
- bootstrap first local admin account only when no users exist
- resolve or create required local provider and credential policy for bootstrap
- persist first identity and first credential material record

### Infrastructure

Filesystem adapter path:

- `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
- `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`

`src` adapter path (same contracts, mapper-separated):

- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceMigrations.ts`
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
- `src/infrastructure/persistence/identity/IdentityPersistenceMapper.ts`

Both adapters implement the same application ports and preserve the same schema/invariant intent.

## Persistence Design

Current schema version: `4`

Tables:

- `identity_auth_providers`
- `identity_credential_policies`
- `identity_user_identities`
- `identity_user_provider_links`
- `identity_credential_material_records`
- `identity_sessions`
- `identity_session_token_material`
- `identity_repository_migrations`

Design choices:

- profile/account identity data is in `identity_user_identities`
- provider-link and credential status state is in `identity_user_provider_links`
- credential hash material is isolated in `identity_credential_material_records`
- session lifecycle state is isolated in `identity_sessions`
- opaque token hash/signing material is isolated in `identity_session_token_material`
- provider metadata and policy metadata are normalized into dedicated tables

Important constraints/indexes:

- unique username and unique non-null email
- unique provider subject per provider (`provider_id + provider_subject`)
- unique active primary provider link per user
- unique active credential material per provider subject
- status `CHECK` constraints for provider/user/credential/session enums
- foreign keys between users, providers, policies, credential records, sessions

## Error and Result Contracts

Identity operations use explicit typed results from `IdentityApplicationContracts.ts`:

- success: `{ ok: true, value }`
- failure: `{ ok: false, error }`

Canonical error codes include:

- `identity-duplicate`
- `identity-invalid-credentials`
- `identity-inactive-account`
- `identity-policy-violation`
- `identity-unsupported-provider`
- `identity-invalid-session-state`
- `identity-invalid-request`
- `identity-invalid-state`
- `identity-not-found`

This keeps failure mapping deterministic across domain/application/infrastructure seams.

## Bootstrap Assumptions

`IdentityBootstrapService.bootstrapFirstLocalAdmin(...)` is intentionally first-run only:

- bootstrap is allowed only when `countUserIdentities() === 0`
- default provider id: `provider:local-password`
- default policy id: `policy:local-password`
- provider must resolve to active local-password semantics
- caller must provide hash metadata (`hashAlgorithm`, `hashValue`; optional salt/pepper version)

The service does not generate a password or perform hashing; it consumes already-generated credential material and persists it.

## Local Registration Use Case

`RegisterLocalAccountUseCase.execute(...)` provides the reusable application-layer registration flow for local-password identities:

- normalizes profile and provider-subject inputs through `IdentityPolicyService`
- resolves provider descriptors/capabilities and requires a local provider that supports the selected authenticator
- enforces username/email/provider-subject uniqueness through lookup ports
- enforces credential candidate policy before persistence
- normalizes and hashes password candidates through `IIdentityCredentialAuthenticator` (`LocalPasswordIdentityAuthenticator` wraps `ILocalPasswordCredentialService`)
- persists `UserIdentity` and active credential material using application ports only
- returns typed operation results for success and structured failure paths

The use case intentionally keeps hashing behind the authenticator contract so secret-handling stays in infrastructure/security code while persistence still stores only hash material (`hashAlgorithm`, `hashValue`, optional salt/pepper metadata).

## Local Credential Verification Use Case

`VerifyLocalPasswordCredentialUseCase.execute(...)` provides the password-verification seam used by login/auth flows:

- validates provider/authenticator compatibility through `IdentityProviderCatalog`
- normalizes local provider-subject references through `IdentityPolicyService`
- resolves active credential material from `ICredentialMaterialRepository`
- verifies candidate passwords via `IIdentityCredentialAuthenticator`
- returns generic invalid-credential failures on missing or mismatched secrets

This keeps password verification logic in an application port + infrastructure adapter seam that can coexist with future passkey or external-provider sign-in flows.

## Local Login Use Case

`LoginLocalAccountUseCase.execute(...)` provides the transport-agnostic local login orchestration for AI Loom accounts:

- normalizes local provider-subject references through `IdentityPolicyService`
- validates local provider path compatibility through provider capability metadata (`local`, `active`, supports selected authenticator)
- resolves the linked local identity and enforces account/provider-link credential-state rules
- verifies credential candidates against active credential material records via the authenticator contract
- returns authenticated-principal payload fields for downstream session issuance and device-trust composition
- returns structured operation failures for unknown identity, invalid credentials, inactive/disabled account state, unsupported auth path, and invalid/misaligned requests

## Authoritative Server API Surface

Local identity registration/login is now exposed through an authoritative HTTP transport surface:

- `POST /api/v1/identity/register`
- `POST /api/v1/identity/login`

Primary transport files:

- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`
- `infrastructure/api/identity/sdk/PublicIdentityAuthApiContract.ts`
- `hosts/server/IdentityServerHost.ts`

Transport behavior:

- request payloads are validated at the HTTP boundary with strict schemas
- application-layer identity errors are translated to stable public API error codes
- structured logs redact sensitive credential fields before serialization

Detailed request/response examples and status/error mappings are documented in `docs/architecture/identity-server-api.md`.

## Local Credential Change Use Case

`ChangeLocalPasswordCredentialUseCase.execute(...)` provides authenticated credential rotation for local-password identities:

- resolves authenticated account context from `userIdentityId` and enforces local provider-link account/credential-state eligibility
- requires old-credential verification in the default `current-credential` path
- enforces replacement credential policy rules before mutation, including minimum password age and recent credential-history reuse constraints from `CredentialPolicy`
- re-hashes replacement credentials through the authenticator contract and persists a new active credential-material record
- supersedes prior active credential material and updates provider-link credential state (`passwordChangedAt`, reset failure posture)
- returns structured operation failures for invalid credentials, policy violations, unsupported providers, inactive/invalid account state, and invalid requests

This keeps credential mutation in application-layer orchestration while preserving secret-handling boundaries in the infrastructure authenticator implementation.

## Reset-Ready Credential Verification Seam

Credential change now supports verification modes:

- `current-credential` (implemented now): verifies the current credential material before rotation
- `reset-assertion` (extension seam): delegated to `IIdentityCredentialResetVerifier`

The reset verifier contract (`application/identity/ports/IIdentityCredentialResetVerifier.ts`) is intentionally transport/token agnostic and allows future reset-token or administrator-assisted reset workflows to authorize credential replacement without adding speculative token issuance systems in this slice.

If `reset-assertion` is requested without a configured verifier, the use case deterministically fails with `identity-invalid-request`.

## Extension Seams for Future Providers

The model is provider-oriented, not local-password hardcoded:

- provider categories and kinds already include external options (`oidc`, `oauth2`, `saml`, `passkey`, `custom`)
- application provider descriptors now expose local capability metadata (supported authenticators, credential-policy/material expectations, usernameless sign-in readiness)
- application authenticator enums now include both `password` and `passkey`
- `UserIdentity` links to provider subjects rather than assuming username-only login
- lookup contracts support principal and provider-subject paths
- credential material records are keyed by provider/subject and support history/supersede
- normalization rules can vary by provider kind (current example: local-password subject lowercasing)

Recommended extension path:

1. Add provider-specific auth adapters in infrastructure.
2. Add provider-specific application use cases for registration/login/session issuance.
3. Reuse existing domain lifecycle transitions and operation-result taxonomy.
4. Keep provider-specific credential/token details isolated in provider adapters and dedicated persistence fields/tables.

## Provider Abstraction Formalization (Story 1.4.1)

Auth provider abstraction is now explicit in application services so local auth is one provider path inside a broader provider model:

- `application/identity/services/IdentityProviderCatalog.ts` now defines provider descriptors with:
  - provider category/kind mapping
  - authenticator capability metadata (`supportedAuthenticators`, usernameless sign-in support)
  - provider-specific credential handling seams (`materialMode`, credential-policy support, credential-material-record support)
  - identity linkage semantics (`provider-subject` linkage under platform-owned `UserIdentity`)
- shared provider validation rules now evaluate runtime provider records against descriptor requirements (category, status, authenticator compatibility, credential handling requirements) through `validateIdentityProvider(...)`

Current local-account flows now consume the same provider abstraction instead of duplicating local-only checks:

- `IdentityBootstrapService.resolveBootstrapProvider(...)`
- `RegisterLocalAccountUseCase.resolveLocalProvider(...)`
- `LoginLocalAccountUseCase.resolveLocalProvider(...)`
- `VerifyLocalPasswordCredentialUseCase.resolveLocalProvider(...)`
- `ChangeLocalPasswordCredentialUseCase.resolveLocalProvider(...)`

This keeps local auth fully functional while making provider-path assumptions explicit and testable, so adding OIDC/Google/Microsoft/SAML-style providers can follow descriptor + adapter composition without changing identity ownership semantics (`UserIdentity` remains the authorization subject with provider-subject links).

## Local Account Administration Use Cases (Story 1.4.2)

Core local account administration flows are now implemented as explicit application use cases and authenticated server APIs:

- `src/application/identity/use-cases/ListLocalIdentityAccountsUseCase.ts`
- `src/application/identity/use-cases/GetLocalIdentityAccountStatusUseCase.ts`
- `src/application/identity/use-cases/SetLocalIdentityAccountStatusUseCase.ts`

Implemented administration capabilities in this slice:

- list local identities with account/provider-link status and active-session counts
- query a specific local identity account status payload for operations support
- enable (`suspended|locked -> active`) or disable (`* -> suspended`) local accounts through application orchestration
- revoke active sessions with `admin` revocation reason during account disablement so existing bearer tokens are invalid on next guarded request

Authorization and audit readiness posture:

- all administration use-case inputs require an explicit administrative action context (`actorUserIdentityId`, optional authorization/audit context metadata)
- identity application logic does not perform role/permission policy decisions in this slice, keeping identity lifecycle concerns separate from future authorization policy engines
- backend observability/audit flow taxonomy now includes administration flows for later audit sink integration

## Separation From Device Trust and Session Trust

Identity in this foundation answers:

- who the account is (`UserIdentity`)
- which provider subject is linked (`UserIdentityProviderLink`)
- what credential policy/state applies (`CredentialPolicy`, `CredentialState`)
- what session lifecycle status exists (`Session`)

Identity does not currently represent device trust posture or runtime trust posture.

Specifically:

- `Session.client` fields (`accessChannel`, `userAgent`, `ipAddress`, `deviceId`, `trustedDeviceBindingId`, `trustMarker`) are informational/session-context metadata, not a trust decision model.
- MCP/runtime trust policy code lives in separate trust modules (for example `domain/mcp/McpToolTrust.ts`) and is not coupled into identity domain logic.
- No identity rule depends on device-attestation state, runtime sandbox trust state, or tool trust decisions.

## Session Lifecycle Policy Service (Story 1.3.1)

Session lifecycle orchestration is now centralized in:

- `application/identity/services/IdentitySessionLifecycleService.ts`

This service defines and applies production session rules for:

- session issuance (`issueSession`) with policy-derived TTL by channel
- session refresh/rotation (`refreshSession`) when allowed by channel policy
- explicit revocation (`revokeSession`) with structured revocation reasons
- expiration sweeps (`expireDueSessions`) for active sessions past `expiresAt`

Policy defaults are explicit and channel-oriented:

- `desktop`: long-lived sessions, refresh disabled by default
- `thin-client`: shorter TTL sessions, refresh enabled by default

Domain lifecycle state transitions are exported and explicit via:

- `IdentitySessionLifecycleTransitions`
- `isSessionTransitionAllowed(...)`

This keeps session semantics separate from login-attempt workflows and trusted-device posture, while still carrying optional device context for later trust-layer composition.

This separation keeps local account lifecycle stable while enabling later device/session trust layers to compose on top instead of being embedded in core identity entities.

## Session Issuance and Token Persistence Services (Story 1.3.2)

Session issuance is now completed as an authenticated-session flow with explicit token-material separation:

- `IdentityAuthenticatedSessionService.issueAuthenticatedSession(...)` composes successful authentication with `IdentitySessionLifecycleService.issueSession(...)`, issues an opaque bearer session token, persists only token hash material, and returns token plaintext once at issuance.
- `IdentityAuthenticatedSessionService.resolveAuthenticatedSessionByToken(...)` validates token hash lookup against persisted token-material records, enforces active-session state, and performs expiry invalidation.
- `IdentityAuthenticatedSessionService.invalidateAuthenticatedSession(...)` revokes the active session and invalidates associated token material.

Token material boundaries:

- token generation and hashing are encapsulated in `IIdentitySessionTokenService` (`OpaqueIdentitySessionTokenService` infrastructure implementation).
- durable token material storage is encapsulated in `IIdentitySessionTokenMaterialRepository` and persisted separately from session metadata in `identity_session_token_material`.
- session metadata (`identity_sessions`) remains focused on lifecycle/client context and avoids raw token/signing persistence.

Local login transport now issues durable sessions in the same call path:

- `IdentityAuthBackendApi.loginLocalAccount(...)` performs credential authentication via `LoginLocalAccountUseCase`, then issues/persists an authenticated session and returns session id/token/expiry metadata in the login success contract.

## Authenticated Session Validation Guard (Story 1.3.3)

Authenticated session validation for protected APIs is now implemented through transport guard infrastructure composed with application identity services:

- `IdentityHttpServer` provides bearer-token guard handling for authenticated routes in the HTTP transport layer.
- `IdentityAuthBackendApi.resolveAuthenticatedSession(...)` composes session-token validation with principal lookup using application ports (`IdentityAuthenticatedSessionService` + `IIdentityLookupRepository`).
- Guard success passes authenticated context (principal + session metadata) to downstream route handlers without leaking transport concerns into application/domain logic.
- Guard failures normalize missing, invalid, expired, and revoked sessions to stable client behavior (`401` + `authentication-failed`).

Current protected route:

- `GET /api/v1/identity/session` (requires `Authorization: Bearer <session-token>`)

## Session Revocation and Logout Flows (Story 1.3.4)

Session termination now includes explicit user logout and targeted session revocation orchestration:

- `src/application/identity/use-cases/LogoutIdentitySessionUseCase.ts`
- `src/application/identity/use-cases/RevokeIdentitySessionUseCase.ts`
- `IdentityAuthenticatedSessionService.revokeAuthenticatedSessionById(...)`

Authoritative transport/API additions:

- `POST /api/v1/identity/logout` (revokes current bearer-authenticated session)
- `POST /api/v1/identity/session/revoke` (revokes target session id for the authenticated principal)

Revocation consistency behavior in this local slice:

- `identity_sessions` lifecycle status is persisted as `revoked`
- `identity_session_token_material.invalidated_at` is persisted for the associated session token material
- protected routes reject revoked sessions on subsequent requests with deterministic `401` + `authentication-failed`

Current authorization posture:

- both new endpoints are bearer-token protected
- session revoke enforces actor ownership of the target session in the application use case
- system-driven revocation seams now exist in application services/use cases for future security/device-trust orchestration

## Session Policy Configuration and Expiry Controls (Story 1.3.5)

Session lifecycle policy is now configurable through standard environment-backed config seams rather than hard-coded runtime behavior:

- `infrastructure/config/IdentitySessionPolicyConfig.ts`
- `hosts/server/IdentityServerHost.ts` (policy loading + injection into `IdentitySessionLifecycleService`)

Configurable per-channel policy controls:

- absolute session duration (`ttlMinutes`)
- refresh allowance (`allowRefresh`)
- optional inactivity timeout (`inactivityTimeoutMinutes`)

Environment variables:

- `IDENTITY_SESSION_DESKTOP_TTL_MINUTES`
- `IDENTITY_SESSION_DESKTOP_ALLOW_REFRESH`
- `IDENTITY_SESSION_DESKTOP_INACTIVITY_TIMEOUT_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_TTL_MINUTES`
- `IDENTITY_SESSION_THIN_CLIENT_ALLOW_REFRESH`
- `IDENTITY_SESSION_THIN_CLIENT_INACTIVITY_TIMEOUT_MINUTES`

Policy evaluation remains in application-layer identity services (not transport):

- issuance and refresh use policy-derived expiry windows in `IdentitySessionLifecycleService`
- token/session validation applies rolling inactivity expiry and absolute TTL caps in `IdentityAuthenticatedSessionService`
- protected HTTP routes continue to consume these outcomes through backend APIs/guards without embedding policy logic

Default policy posture remains explicit and secure by default:

- desktop: `ttlMinutes=43200` (30 days), `allowRefresh=false`, inactivity timeout unset
- thin-client: `ttlMinutes=720` (12 hours), `allowRefresh=true`, inactivity timeout unset

When inactivity timeout is configured, validation updates session/token expiry on activity (bounded by absolute TTL), and inactive sessions are expired/rejected once the inactivity window elapses.

## Trusted-Device Session Binding Seams (Story 1.3.6)

Session contracts, persistence rows, and authenticated-session validation now include production-ready seams for future trusted-device integration without introducing a trust implementation in this slice.

Added optional session client context fields:

- `trustedDeviceBindingId` (future association key to trusted-device records)
- `trustMarker` (future opaque trust marker for policy engines)

These fields are persisted in `identity_sessions` as:

- `client_trusted_device_binding_id`
- `client_trust_marker`

Validation seam:

- `IdentityAuthenticatedSessionService` now accepts optional `IIdentitySessionTrustEvaluator`.
- When configured, it can evaluate resolved sessions during bearer-token validation and deny runtime access with existing invalid-session-state semantics.
- No default trust evaluator is wired in this slice, so current behavior is unchanged unless a caller explicitly composes one.

Principal/session resolution seam:

- `resolveAuthenticatedSession` responses can now include session `deviceId`, `trustedDeviceBindingId`, and `trustMarker`.
- This allows later trusted-device policy work to enrich authenticated runtime context without refactoring core identity/session layers.

## UI Session-State Exposure (Story 1.3.7)

Renderer auth/session state now uses authenticated-session behavior as the source of truth instead of local placeholder assumptions.

Primary renderer files:

- `ui/App.tsx`
- `ui/routes/AppRouter.tsx`
- `ui/pages/LoginPage.tsx`
- `ui/shared/identity/IdentityAuthSessionCoordinator.ts`
- `ui/shared/identity/IdentityAuthSessionStore.ts`
- `ui/shared/identity/IdentityAuthEnvironment.ts`
- `ui/shared/identity/IdentityAuthClient.ts`
- `ui/services/IdentityAuthService.ts`

Implemented behavior:

- authenticated bootstrap now validates stored session tokens against `GET /api/v1/identity/session` before mounting authenticated provider/runtime state
- session validation is refreshed on visibility return to recover from server-side session revocation/expiry while the client is open
- desktop and thin-client persistence now follows platform seams:
  - desktop uses preload bridge storage when available (`window.aiLoomDesktop.storage`)
  - thin-client/web uses browser local storage
- login requests now include explicit access-channel context (`desktop` or `thin-client`) and user-agent client metadata
- expired/revoked/invalid sessions are deterministically cleared and the UI returns to sign-in with explicit recovery messaging

## Session Architecture Reference (Story 1.3.8)

Session lifecycle, issuance, validation guard behavior, revocation consistency, policy configuration, client expectations, and trusted-device seams are documented in:

- `docs/architecture/identity-session-architecture.md`

Use that note as the authoritative session-subsystem baseline for future security/device-trust stories.

## Implemented Test Coverage

Key tests for this foundation:

- `src/domain/identity/tests/IdentityDomain.test.ts`
- `src/domain/identity/tests/IdentityPolicy.test.ts`
- `application/contracts/tests/IdentityApplicationContracts.test.ts`
- `application/identity/tests/IdentityPortsContracts.test.ts`
- `application/identity/tests/IdentityPolicyService.test.ts`
- `application/identity/tests/IdentityBootstrapService.test.ts`
- `application/identity/tests/RegisterLocalAccountUseCase.test.ts`
- `application/identity/tests/VerifyLocalPasswordCredentialUseCase.test.ts`
- `application/identity/tests/LoginLocalAccountUseCase.test.ts`
- `application/identity/tests/ChangeLocalPasswordCredentialUseCase.test.ts`
- `application/identity/tests/IdentitySessionLifecycleService.test.ts`
- `application/identity/tests/IdentityAuthenticatedSessionService.test.ts`
- `infrastructure/config/tests/IdentitySessionPolicyConfig.test.ts`
- `application/identity/tests/LogoutIdentitySessionUseCase.test.ts`
- `application/identity/tests/RevokeIdentitySessionUseCase.test.ts`
- `application/identity/tests/IdentityAuthenticatorAndProviderCatalog.test.ts`
- `application/identity/tests/LocalIdentityAdministrationUseCases.test.ts`
- `infrastructure/filesystem/identity/tests/SqliteIdentityRepository.test.ts`
- `infrastructure/security/identity/tests/ScryptLocalPasswordCredentialService.test.ts`
- `infrastructure/security/identity/tests/OpaqueIdentitySessionTokenService.test.ts`
- `infrastructure/api/identity/tests/IdentityAuthBackendApi.test.ts`
- `infrastructure/transport/http-server/identity/tests/IdentityHttpServer.test.ts`
- `src/infrastructure/persistence/identity/tests/IdentityPersistenceMapper.test.ts`
- `src/infrastructure/persistence/identity/tests/SqliteIdentityPersistenceAdapter.test.ts`

These cover domain invariants, policy normalization/evaluation, contract semantics, bootstrap behavior, migrations, adapter round-trip behavior, and key DB constraints.

