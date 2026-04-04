# AI Companion: Identity Foundation

## What this slice does

- Defines local identity domain contracts for providers, users, credentials, and sessions.
- Defines identity application ports for lookup/persistence/credential/session operations.
- Adds first-run local admin bootstrap orchestration.
- Adds reusable local account registration orchestration for non-bootstrap flows.
- Adds SQLite migrations/adapters for durable identity storage.
- Standardizes typed identity operation results and error taxonomy.

## Main files to cite

- `src/domain/identity/IdentityDomain.ts`
- `src/domain/identity/IdentityPolicy.ts`
- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/ports/*`
- `application/identity/services/IdentityPolicyService.ts`
- `application/identity/services/IdentityBootstrapService.ts`
- `src/application/identity/use-cases/RegisterLocalAccountUseCase.ts`
- `src/application/identity/use-cases/VerifyLocalPasswordCredentialUseCase.ts`
- `src/application/identity/use-cases/LoginLocalAccountUseCase.ts`
- `infrastructure/filesystem/identity/SqliteIdentityMigrations.ts`
- `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
- `application/identity/ports/ILocalPasswordCredentialService.ts`
- `infrastructure/security/identity/ScryptLocalPasswordCredentialService.ts`

## Persistence shape

- Tables: providers, policies, users, provider links, credential material history, sessions, migrations.
- Constraints enforce uniqueness for username/email/provider subject and single active credential material per provider subject.
- Credential hash material is isolated in `identity_credential_material_records`.

## Provider extension seam

- Provider model already supports `local-password`, `oidc`, `oauth2`, `saml`, `passkey`, `custom`.
- Identity links are provider-subject based, so external provider integration can reuse current contracts.
- Local-password specific normalization is isolated in policy logic, not hardcoded through the whole stack.

## Local registration seam

- `RegisterLocalAccountUseCase` runs full local registration orchestration in the application layer.
- It validates/normalizes profile + provider subject, checks deterministic uniqueness conflicts, enforces credential policy, hashes password candidates through `ILocalPasswordCredentialService`, and persists identity + credential material.
- It depends only on identity application ports plus `IdentityPolicyService`, with structured operation results for duplicate/policy/provider/state failures.

## Local verification seam

- `VerifyLocalPasswordCredentialUseCase` provides local password verification for login/auth flows.
- It normalizes local provider references, resolves active credential material, and verifies candidates through `ILocalPasswordCredentialService`.
- Missing credential material and password mismatches map to the same invalid-credentials failure contract.

## Local login seam

- `LoginLocalAccountUseCase` provides the transport-agnostic local login flow for local-password identities.
- It normalizes provider references, validates local provider-path compatibility, resolves the linked identity, enforces account/provider-link credential-state checks, and verifies credential candidates against active credential material.
- It returns authenticated-principal result fields intended for subsequent session issuance and device-trust checks.
- It emits structured failures for unknown identity, invalid credentials, inactive or disabled account state, and unsupported auth paths.

## Boundary clarity: identity vs trust

- Identity session records carry lifecycle state and optional client context only.
- Device trust and runtime/tool trust remain separate concerns (for example MCP trust modules).
- No identity invariant currently depends on device-attestation or runtime trust decisions.

## Read next

- Full architecture note: `docs/architecture/identity-foundation.md`

