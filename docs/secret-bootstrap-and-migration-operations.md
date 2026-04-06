# System Secret Bootstrap and Migration Operations

This note documents Story 8.3.3 (Feature 8 / Epic 8.3): bootstrap required system secrets during authoritative host startup and migrate legacy environment-based secret values into the formal secret service.

## Canonical artifacts

- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SystemSecretBootstrapService.test.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`
- `.env.example`

## Startup behavior

`startIdentityServerHost(...)` now runs system secret bootstrap validation immediately after composing the secret service.

- If no required system secrets are configured, startup proceeds unchanged.
- If required system secrets are configured:
  - each required secret must be present in the secret service and runtime-retrievable, or
  - the secret must be migrated from a supported legacy environment variable value.
- If validation or migration fails, startup fails closed with a clear bootstrap validation error.

## Required system secret configuration

Use `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` to declare required server-scoped system secret records.

Supported IDs in this slice:

- `secret:server:provider:openai`
- `secret:server:provider:huggingface`
- `secret:server:signing:identity-session`

## Legacy migration behavior

Migration is enabled by default and can be disabled with:

- `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV=false`

Supported legacy environment migration sources:

- `OPENAI_API_KEY` -> `secret:server:provider:openai`
- `HUGGINGFACE_API_TOKEN` -> `secret:server:provider:huggingface`
- `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY` -> `secret:server:signing:identity-session`

Migration only occurs when the required secret is missing from the secret service and the mapped legacy environment value is present.

## Initial setup steps

1. Configure secret envelope encryption (`AI_LOOM_SECRET_MASTER_KEY_ID` + `AI_LOOM_SECRET_MASTER_KEY`).
2. Set `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS` with required IDs for your deployment.
3. For first migration boot, provide matching legacy environment values or pre-create those secrets through secret metadata operations.
4. Start the host and verify startup succeeds.
5. After migration, remove legacy environment values and continue managing those records through the secret service.

## Fail-safe posture

- Missing required system secrets fail startup.
- Unsupported required secret identifiers fail startup.
- Migration attempts fail startup when encryption is unavailable or create/runtime validation fails.
- Runtime validation checks do not expose plaintext in diagnostics.
