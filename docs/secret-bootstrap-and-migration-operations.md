# System Secret Bootstrap and Migration Operations

This note documents Story 8.3.3 (Feature 8 / Epic 8.3): bootstrap required system secrets during authoritative host startup and migrate legacy environment-based secret values into the formal secret service.

## Canonical artifacts

- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SystemSecretBootstrapService.test.ts`
- `src/hosts/server/tests/IdentityServerHost.test.ts`
- `.env.example`

## Startup behavior

`startIdentityServerHost(...)` now runs system secret bootstrap validation immediately after composing the secret service.

- Server-scoped provider/signing bootstrap resolution runs through the durable server backend behind `ISecretProviderMaterialResolutionPort`.
- Backend initialization performs a fail-closed repository readiness check before server-scope operations.
- If no required system secrets are configured, startup proceeds unchanged.
- If required system secrets are configured:
  - each required secret must be present in the secret service and runtime-retrievable, or
  - the secret must be migrated from a supported legacy environment variable value, or
  - for policy-eligible signing material, bootstrap creates durable key material and persists it through provider backends.
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

## Story 3.3.2 key bootstrap creation policy update

- `secret:server:signing:identity-session` now follows an explicit bootstrap creation policy:
  - try legacy migration from `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY` first (when migration is enabled);
  - otherwise generate an Ed25519 PKCS#8 private key in bootstrap and persist it through `ISecretProviderMaterialResolutionPort`.
- Bootstrap-created signing material is tagged with bootstrap source/policy metadata and persists durably across restarts.
- Runtime critical material resolution no longer writes/bootstrap-creates provider records during lookup; mutation is confined to explicit bootstrap flows.

## Story 3.4.3 security material lifecycle audit hooks

- Scoped provider metadata/existence/runtime retrieval checks now emit secret audit events for:
  - access decisions (`allowed` / `denied`)
  - operation outcomes (`succeeded` / `missing` / `denied` / `rejected` / `failed`)
- Bootstrap lifecycle paths now produce audit records for:
  - bootstrap creation and first activation of required secrets
  - bootstrap validation attempts that fail due to missing or unusable material
  - backend-resolved metadata/runtime checks (including backend kind in safe details where available)
- Secret lifecycle mutation events (`create`, `rotate`, `revoke-version`, `retire-version`) now carry safe contextual details in audit payloads.
- Audit payload safety posture:
  - no raw secret plaintext, key bytes, or token material is emitted
  - operation details are redacted through shared secret-redaction safeguards before authoritative persistence.

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
- Durable server backend initialization failures fail startup.
- Runtime validation checks do not expose plaintext in diagnostics.
