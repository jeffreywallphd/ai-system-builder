# AI Companion: Secret-Backed Feature Contributor Guide

## Purpose

Story 8.3.7 operational companion for Feature 8 / Epic 8.3: give contributors a concrete setup + implementation checklist for secret-backed features.

## Setup baseline

- Configure host envelope encryption (`AI_LOOM_SECRET_MASTER_KEY_ID`, `AI_LOOM_SECRET_MASTER_KEY`).
- Configure required bootstrap secrets when needed (`AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`).
- Validate health/diagnostics before integrating dependent runtime features.

## Startup Security Material Baseline (Story 3.1.6)

- Production-like startup must use durable configured values for critical token/encryption secrets:
  - `AI_LOOM_ASSET_DOWNLOAD_GRANT_SECRET`
  - `AI_LOOM_ASSET_CONTENT_ENCRYPTION_KEY` (or durable legacy `AI_LOOM_SECRET_MASTER_KEY` source)
  - `AI_LOOM_IMAGE_ASSET_STORAGE_TOKEN_SECRET` (or durable legacy `AI_LOOM_SECRET_MASTER_KEY` source)
  - `AI_LOOM_IMAGE_ASSET_UPLOAD_SESSION_TOKEN_SECRET` (or durable legacy `AI_LOOM_SECRET_MASTER_KEY` source)
  - `AI_LOOM_GENERATED_RESULT_PREVIEW_ACCESS_TOKEN_SECRET` (or durable legacy `AI_LOOM_SECRET_MASTER_KEY` source)
  - non-empty `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` for required system signing/provider secret IDs.
- Development/test startup may continue with warning diagnostics when startup policy marks material optional with governed ephemeral fallback.
- Managed TLS startup policy:
  - if `AI_LOOM_INTERNAL_CA_SERVER_MANAGED_TLS_ENABLED=true`, configure `AI_LOOM_INTERNAL_CA_SERVER_TLS_PRIVATE_KEY_MATERIAL_REF` and a server-scoped `AI_LOOM_INTERNAL_CA_SERVER_REFERENCE_ID` (`server:*`).
  - if managed TLS is disabled, managed-CA key-reference validation is not required for startup.

## Contributor implementation rules

- Choose scope by ownership (`server`, `workspace`, `user`) and keep it explicit.
- Runtime secret reads go through adapters/use cases, not env vars/persistence shortcuts.
- Keep command/query DTO boundaries strict: plaintext only for mutation input.
- Enforce log/audit redaction; plaintext and decrypted values are never allowed.
- Handle `forbidden`/`conflict` outcomes deterministically; do not retry with broadened scope silently.
- Treat rotation as active-version replacement; use optimistic version matching for sensitive update flows.

## Recommended adapters

- workspace credential: `resolveWorkspaceProviderCredential(...)`
- user personal API key: `resolveUserPersonalApiKey(...)`
- server signing/provider credentials: `ServerPlatformSecretConsumers`

## Related docs

- `docs/architecture/secrets-feature-extension-guidance.md`
- `docs/architecture/secrets-service-consumption-adapters.md`
- `docs/secret-bootstrap-and-migration-operations.md`
- `docs/secret-health-and-operational-diagnostics.md`

## Story 8.3.8 regression baseline

Final production-readiness hardening now expects these regression seams to stay green:

- `src/application/security/tests/ReEncryptSecretsUseCase.test.ts`
  - ensures re-encryption failure status uses safe fixed messages and does not persist raw exception text.
- `src/infrastructure/security/secrets/tests/SecretServiceGovernance.integration.test.ts`
  - validates end-to-end lifecycle consistency across create/rotate/retrieve/re-encrypt/delete with audit redaction checks.
- `src/infrastructure/api/security/tests/SecretMetadataBackendApi.test.ts`
  - validates API error sanitization for opaque sensitive token-like values.
