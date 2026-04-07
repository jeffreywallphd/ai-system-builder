# AI Companion: System Secret Bootstrap and Migration Operations

## Purpose

Story 8.3.3 baseline for Feature 8 / Epic 8.3: add host startup bootstrap checks for required system secrets and provide a migration path for legacy environment-based secret values into the formal secret service.

## Canonical files

- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SystemSecretBootstrapService.test.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`
- `.env.example`

## Behavior summary

- Host startup now calls `assertSystemSecretBootstrapSafe(...)` after secret service composition.
- Required system secret IDs are configured via `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`.
- Bootstrap verifies required secrets are present and runtime-retrievable through formal secret retrieval paths.
- Missing required secrets can be auto-migrated from supported legacy env values when migration is enabled.
- Startup fails closed when required system secret validation or migration fails.

## Supported required secret IDs

- `secret:server:provider:openai`
- `secret:server:provider:huggingface`
- `secret:server:signing:identity-session`

## Supported legacy env migration sources

- `OPENAI_API_KEY`
- `HUGGINGFACE_API_TOKEN`
- `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY`

Migration toggle:

- `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV` (default `true`)

## Test posture

Coverage verifies:

- successful migration from legacy env into required system secret records,
- invalid startup state when required secrets are missing,
- invalid migration state when encryption is unavailable,
- authoritative host fail-closed startup on missing required system secret,
- authoritative host successful startup when required secret is migrated during bootstrap.
