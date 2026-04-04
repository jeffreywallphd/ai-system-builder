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
- locked credentials require `lockoutUntil`
- credential policy constraints are validated at creation and candidate evaluation

### Application

Primary files:

- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/ports/IIdentityLookupRepository.ts`
- `application/identity/ports/IIdentityPersistenceRepository.ts`
- `application/identity/ports/ICredentialMaterialRepository.ts`
- `application/identity/ports/IIdentitySessionRepository.ts`
- `application/identity/ports/IIdentityClock.ts`
- `application/identity/ports/IIdentityIdGenerator.ts`
- `application/identity/ports/ILocalPasswordCredentialService.ts`
- `application/identity/services/IdentityPolicyService.ts`
- `application/identity/services/IdentityBootstrapService.ts`
- `src/application/identity/use-cases/RegisterLocalAccountUseCase.ts`
- `src/application/identity/use-cases/VerifyLocalPasswordCredentialUseCase.ts`

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

Current schema version: `1`

Tables:

- `identity_auth_providers`
- `identity_credential_policies`
- `identity_user_identities`
- `identity_user_provider_links`
- `identity_credential_material_records`
- `identity_sessions`
- `identity_repository_migrations`

Design choices:

- profile/account identity data is in `identity_user_identities`
- provider-link and credential status state is in `identity_user_provider_links`
- credential hash material is isolated in `identity_credential_material_records`
- session lifecycle state is isolated in `identity_sessions`
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
- requires configured active local-password provider and credential policy dependencies
- enforces username/email/provider-subject uniqueness through lookup ports
- enforces credential candidate policy before persistence
- normalizes and hashes password candidates through `ILocalPasswordCredentialService`
- persists `UserIdentity` and active credential material using application ports only
- returns typed operation results for success and structured failure paths

The use case intentionally keeps hashing behind `ILocalPasswordCredentialService` so secret-handling stays in infrastructure/security code while persistence still stores only hash material (`hashAlgorithm`, `hashValue`, optional salt/pepper metadata).

## Local Credential Verification Use Case

`VerifyLocalPasswordCredentialUseCase.execute(...)` provides the password-verification seam used by login/auth flows:

- normalizes local provider-subject references through `IdentityPolicyService`
- resolves active credential material from `ICredentialMaterialRepository`
- verifies candidate passwords via `ILocalPasswordCredentialService`
- returns generic invalid-credential failures on missing or mismatched secrets

This keeps password verification logic in an application port + infrastructure adapter seam that can coexist with future passkey or external-provider sign-in flows.

## Extension Seams for Future Providers

The model is provider-oriented, not local-password hardcoded:

- provider categories and kinds already include external options (`oidc`, `oauth2`, `saml`, `passkey`, `custom`)
- `UserIdentity` links to provider subjects rather than assuming username-only login
- lookup contracts support principal and provider-subject paths
- credential material records are keyed by provider/subject and support history/supersede
- normalization rules can vary by provider kind (current example: local-password subject lowercasing)

Recommended extension path:

1. Add provider-specific auth adapters in infrastructure.
2. Add provider-specific application use cases for registration/login/session issuance.
3. Reuse existing domain lifecycle transitions and operation-result taxonomy.
4. Keep provider-specific credential/token details isolated in provider adapters and dedicated persistence fields/tables.

## Separation From Device Trust and Session Trust

Identity in this foundation answers:

- who the account is (`UserIdentity`)
- which provider subject is linked (`UserIdentityProviderLink`)
- what credential policy/state applies (`CredentialPolicy`, `CredentialState`)
- what session lifecycle status exists (`Session`)

Identity does not currently represent device trust posture or runtime trust posture.

Specifically:

- `Session.client` fields (`userAgent`, `ipAddress`, `deviceId`) are informational context, not a trust decision model.
- MCP/runtime trust policy code lives in separate trust modules (for example `domain/mcp/McpToolTrust.ts`) and is not coupled into identity domain logic.
- No identity rule depends on device-attestation state, runtime sandbox trust state, or tool trust decisions.

This separation keeps local account lifecycle stable while enabling later device/session trust layers to compose on top instead of being embedded in core identity entities.

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
- `infrastructure/filesystem/identity/tests/SqliteIdentityRepository.test.ts`
- `infrastructure/security/identity/tests/ScryptLocalPasswordCredentialService.test.ts`
- `src/infrastructure/persistence/identity/tests/IdentityPersistenceMapper.test.ts`
- `src/infrastructure/persistence/identity/tests/SqliteIdentityPersistenceAdapter.test.ts`

These cover domain invariants, policy normalization/evaluation, contract semantics, bootstrap behavior, migrations, adapter round-trip behavior, and key DB constraints.

