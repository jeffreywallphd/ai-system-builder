# AI Companion: Secret-Backed Feature Contributor Guide

## Purpose

Story 8.3.7 operational companion for Feature 8 / Epic 8.3: give contributors a concrete setup + implementation checklist for secret-backed features.

## Setup baseline

- Configure host envelope encryption (`AI_LOOM_SECRET_MASTER_KEY_ID`, `AI_LOOM_SECRET_MASTER_KEY`).
- Configure required bootstrap secrets when needed (`AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`).
- Validate health/diagnostics before integrating dependent runtime features.

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
- `infrastructure/api/security/tests/SecretMetadataBackendApi.test.ts`
  - validates API error sanitization for opaque sensitive token-like values.
