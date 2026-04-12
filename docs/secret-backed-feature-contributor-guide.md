# Secret-Backed Feature Contributor Guide

This guide documents Story 8.3.7 (Feature 8 / Epic 8.3) and defines the expected setup and implementation workflow for contributors building secret-backed platform features.

## When to use this guide

Use this document when implementing any feature that needs:

- provider API credentials,
- signing material,
- runtime tokens, or
- any value that should not live in plaintext configuration.

## Prerequisites and platform setup

1. Configure envelope encryption for the host:
   - `AI_LOOM_SECRET_MASTER_KEY_ID`
   - `AI_LOOM_SECRET_MASTER_KEY`
2. Configure required bootstrap secret IDs where relevant:
   - `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`
3. For migration-first environments, optionally enable/use:
   - `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV` (default `true`)
4. Start the host and verify operational posture:
   - `GET /api/v1/security/secrets/health`
   - `GET /api/v1/security/secrets/diagnostics` (trusted session)

If health is `degraded` or `unhealthy`, resolve repository/encryption/bootstrap diagnostics before adding dependent runtime features.

## Startup security material baseline (Story 3.1.6)

Authoritative startup now enforces regression-tested fail-fast behavior for security-critical material. Use this baseline when running locally:

- Production-like startup (`AI_LOOM_ENVIRONMENT_NAME=production` or `NODE_ENV=production`) requires durable configured values for:
  - `AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET`
  - `AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY` (or durable `AI_LOOM_SECRET_MASTER_KEY` legacy source)
  - `AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET` (or durable `AI_LOOM_SECRET_MASTER_KEY` legacy source)
  - `AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET` (or durable `AI_LOOM_SECRET_MASTER_KEY` legacy source)
  - `AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET` (or durable `AI_LOOM_SECRET_MASTER_KEY` legacy source)
  - `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` (non-empty list for required system secrets such as signing/provider secrets)
- Development/test startup (`AI_LOOM_ENVIRONMENT_NAME=development`, `NODE_ENV=development`, or `NODE_ENV=test`) can continue with warning diagnostics when optional ephemeral fallback policy applies.
- Managed TLS startup is policy-gated:
  - when `AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED=true`, set `AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF` and keep `AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID` server-scoped (`server:*`),
  - when managed TLS is disabled, CA private-key reference validation is not required for startup.

Recommended local development pattern:

1. Keep explicit durable values in your local environment for production-like validation runs.
2. Use development profile for day-to-day work when intentionally exercising governed warning-only fallback behavior.
3. Include signing/provider material IDs in `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` so startup checks validate the same critical inventory expected in deployment.

## Scope and ownership decision guide

Use ownership-first selection:

- `server`: credential belongs to platform host operations.
- `workspace`: credential is shared by members/services of one workspace.
- `user`: credential belongs to one user identity.

Selection checks:

- prefer the narrowest valid owner scope;
- avoid promoting user credentials to workspace/server scope;
- document secret ID conventions in the feature notes.

## Safe implementation pattern

### 1. Define secret dependency contract in application layer

- Accept secret ID(s) and runtime governance context (`operationKey`, `serviceIdentity`, justification).
- Depend on `ISecretRuntimeConsumptionAdapters` or `ServerPlatformSecretConsumers`.
- Keep domain entities free from secret retrieval logic.

### 2. Keep transport contracts plaintext-safe

- Plaintext accepted only in create/rotate command paths.
- Metadata/list/detail responses remain plaintext-free.
- Reuse shared secret DTO/schema patterns before introducing new secret transport models.

### 3. Enforce redaction in logs and diagnostics

- Sanitize all secret-related structured logs.
- Never log raw secret submission payloads.
- Keep audit payloads metadata-only.

### 4. Handle authorization and policy outcomes explicitly

- Surface forbidden/conflict/not-found outcomes deterministically.
- Do not add fallback retrieval from env vars or direct persistence reads.
- Treat denied access as final unless actor context is intentionally changed by an authorized flow.

### 5. Account for rotation behavior

- Assume active-version retrieval semantics only.
- Use `expectedCurrentVersionId` when rotation depends on prior-read version state.
- On `secret-conflict`, reload metadata and retry through explicit operator action.

## Service integration examples

- Workspace runtime module needing provider credential:
  - use `resolveWorkspaceProviderCredential(...)`.
- User-specific provider key path:
  - use `resolveUserPersonalApiKey(...)`.
- Server signing/session material:
  - use `resolveIdentitySessionSigningMaterial(...)` via `ServerPlatformSecretConsumers`.

## Contributor review checklist

Before opening a PR:

- secret scope and ownership rationale is documented.
- runtime retrieval uses formal adapters/use cases only.
- no plaintext appears in query DTOs, API responses, logs, or audit details.
- denied/conflict behavior is tested or covered by existing test seams.
- operational docs are updated if new secret IDs, bootstrap requirements, or rotation behaviors are introduced.

## Final regression suite (Story 8.3.8)

Feature 8 now includes a production-readiness regression baseline that should remain green before shipping changes to secret-backed flows:

- `src/application/security/tests/ReEncryptSecretsUseCase.test.ts`
  - verifies re-encryption progress, resume behavior, and redaction-safe failure status (`lastErrorMessage` does not leak raw adapter exception text).
- `src/infrastructure/security/secrets/tests/SecretServiceGovernance.integration.test.ts`
  - verifies cross-layer lifecycle coverage: create, rotate, runtime retrieval, re-encrypt, delete/soft-delete visibility, and audit redaction.
- `src/infrastructure/api/security/tests/SecretMetadataBackendApi.test.ts`
  - verifies metadata/admin API error shaping keeps opaque sensitive tokens out of client-visible error messages.

When extending Feature 8, update these tests (or add equivalent coverage) so lifecycle, redaction, and authorization posture remain stable.

## Related references

- `docs/architecture/secrets-feature-extension-guidance.md`
- `docs/architecture/secrets-service-composition.md`
- `docs/architecture/secrets-service-consumption-adapters.md`
- `docs/architecture/secrets-authorization-policies.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.md`
- `docs/architecture/secrets-rotation-and-version-activation-workflows.md`
- `docs/secret-bootstrap-and-migration-operations.md`
- `docs/secret-health-and-operational-diagnostics.md`
