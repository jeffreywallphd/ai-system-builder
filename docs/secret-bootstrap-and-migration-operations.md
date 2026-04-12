# System Secret Bootstrap and Migration Operations

This runbook documents the hardened bootstrap path for required system secrets and legacy migration in authoritative and auth-minimal hosts.

## Canonical artifacts

- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/hosts/server/composition/ServerSecretCompositionModule.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/hosts/server/AuthMinimalIdentityServerHost.ts`
- `src/infrastructure/security/secrets/tests/SystemSecretBootstrapService.test.ts`
- `src/hosts/server/tests/IdentityServerHost.test.ts`
- `.env.example`

## Required secret catalog

Currently supported required IDs:

- `secret:server:provider:openai`
- `secret:server:provider:huggingface`
- `secret:server:signing:identity-session`

Configured with:

- `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`

If this variable is empty/unset, bootstrap validation succeeds with no required-secret checks.

## Startup execution order

1. Compose server secret service (`composeServerSecretService`).
2. Run `assertSystemSecretBootstrapSafe(...)`.
3. Resolve metadata existence for each required secret through scoped provider retrieval.
4. If missing, attempt migration/bootstrap creation according to policy.
5. Re-resolve metadata and perform runtime retrieval validation.
6. Fail startup when any required secret remains missing/unusable.

## Production configuration expectations

For production-capable startup:

- configure envelope encryption for durable secret operations:
  - `AI_LOOM_SECRET_MASTER_KEY_ID`
  - `AI_LOOM_SECRET_MASTER_KEY`
- configure required secret IDs with `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`
- provide legacy migration inputs only for migration windows, not permanent runtime dependency

Migration toggle:

- `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV` (`true` by default)

Supported legacy env mappings:

- `OPENAI_API_KEY` -> `secret:server:provider:openai`
- `HUGGINGFACE_API_TOKEN` -> `secret:server:provider:huggingface`
- `AI_LOOM_IDENTITY_SESSION_SIGNING_PRIVATE_KEY` -> `secret:server:signing:identity-session`

## Development/test allowances

Lifecycle stage is environment-driven (`production`/`development`/`test`) and governs optional fallback behavior.

- provider credentials remain fail-fast required by default policy
- identity-session signing material can be optional in development policy
- when policy allows and migration value is absent, signing material can be bootstrap-generated (Ed25519 PKCS#8) and persisted durably
- startup and diagnostics now emit explicit governance assertions for development-only allowances with `warning` or `blocked` enforcement

## Failure diagnostics matrix

- `unsupported-required-secret`: required id is not registered for bootstrap
- `required-secret-missing`: required secret does not exist and no allowed creation path succeeded
- `required-secret-unusable`: metadata/runtime retrieval validation failed
- `legacy-migration-unavailable`: migration needed but secret encryption is unconfigured
- `legacy-migration-failed`: migration create/read path failed
- `bootstrap-creation-unavailable`: generation path needed but secret encryption is unconfigured
- `bootstrap-creation-failed`: generated bootstrap create path failed

Any `error` severity diagnostic yields invalid bootstrap state and startup failure.
Governance assertions with `enforcement=blocked` must be treated as production-policy violations.

## Operational procedure

1. Set durable master-key configuration.
2. Declare required secret IDs.
3. For initial migration, provide temporary legacy env values (if used).
4. Start host and verify startup does not throw bootstrap validation errors.
5. Validate health/diagnostics endpoints:
   - `GET /api/v1/security/secrets/health`
   - `GET /api/v1/security/secrets/diagnostics`
6. Remove temporary legacy env inputs after durable secret records are confirmed.

## Extension guidance

When adding a new required system secret:

1. Register it in `SystemSecretDefinitions` with classification + hierarchy + lifecycle policy.
2. Assign creation policy (`migrate-legacy-only` or `migrate-legacy-or-generate`) and optional generation strategy.
3. Add migration mapping only if explicitly needed.
4. Add bootstrap tests for success, missing, migration failure, and policy-specific behavior.
5. Update this runbook and diagnostics documentation.

## Audit and safety posture

- bootstrap metadata/existence/runtime checks emit secret audit events
- bootstrap create/activation lifecycle events are auditable
- diagnostics and audit payloads are metadata-only and redacted
- plaintext secret values and key bytes are not emitted
