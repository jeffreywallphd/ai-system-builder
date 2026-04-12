# AI Companion: System Secret Bootstrap and Migration Operations

## Purpose

Story 8.3.3 baseline for Feature 8 / Epic 8.3: add host startup bootstrap checks for required system secrets and provide a migration path for legacy environment-based secret values into the formal secret service.

## Canonical files

- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SystemSecretBootstrapService.test.ts`
- `src/hosts/server/tests/IdentityServerHost.test.ts`
- `.env.example`

## Behavior summary

- Host startup now calls `assertSystemSecretBootstrapSafe(...)` after secret service composition.
- Server-scoped provider/signing bootstrap resolution runs through the durable server backend used by `ISecretProviderMaterialResolutionPort`.
- Backend initialization performs a fail-closed repository readiness check before server-scope operations.
- Required system secret IDs are configured via `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`.
- Bootstrap verifies required secrets are present and runtime-retrievable through formal secret retrieval paths.
- Missing required secrets can be auto-migrated from supported legacy env values when migration is enabled.
- Policy-eligible signing material can be bootstrap-created when missing, then stored through provider backends with bootstrap metadata tags/labels for diagnostics and rotation workflows.
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

## Story 3.3.2 key bootstrap creation policy update

- `secret:server:signing:identity-session` now uses explicit bootstrap creation policy:
  - first choice: migrate from `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY` when present and migration is enabled
  - fallback choice: generate an Ed25519 PKCS#8 private key during bootstrap and persist it via provider bootstrap port
- Bootstrap-generated signing keys are tagged with metadata indicating bootstrap source/policy and remain durable across restarts.
- Runtime critical-material resolver no longer performs provider bootstrap writes during lookup; mutation now stays in explicit bootstrap flows.

## Test posture

Coverage verifies:

- successful migration from legacy env into required system secret records,
- invalid startup state when required secrets are missing,
- invalid migration state when encryption is unavailable,
- durable server backend initialization failure propagates as an invalid startup state,
- authoritative host fail-closed startup on missing required system secret,
- authoritative host successful startup when required secret is migrated during bootstrap.
