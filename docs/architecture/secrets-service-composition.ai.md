# AI Companion: Secret Service Composition and Host Wiring

## Purpose

Quick baseline for Story 8.1.7 (Feature 8 / Epic 8.1): compose secret services into authoritative server host runtime with architecture-safe dependency wiring.

## Canonical files

- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `hosts/server/IdentityServerHost.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`
- `.env.example`

## Composition summary

- Added host composition seam `composeServerSecretService(...)`.
- Runtime wiring is host/infrastructure only:
  - repository: `SqliteSecretRecordPersistenceAdapter`
  - crypto: `EnvelopeSecretEncryptionPort` from environment-backed master-key provider
  - policy: domain-backed secret access decision adapter
  - observability: `SecretObservabilityReporter`
  - audit: host-supplied callback hook
- Composed service exposes formal application use cases (`CreateSecretUseCase`, `GetSecretMetadataUseCase`, `RetrieveSecretPlaintextForRuntimeUseCase`, `RotateSecretUseCase`, `ReEncryptSecretsUseCase`, `DisableSecretUseCase`, `DeleteSecretUseCase`, `ListSecretsUseCase`, `SecretScopeResolver`) instead of leaving secret collaborators disconnected.
- Composed service now also exposes runtime credential helpers through `runtimeSecretConsumptionAdapters` (see `docs/architecture/secrets-service-consumption-adapters.md`) so other runtime modules can consume secrets through formal retrieval seams.

## Audit hook contract update

- Secret service host audit hook now receives structured events for both:
  - `secret.access-decision`
  - `secret.operation`
- This keeps audit integration centralized at composition while preserving redaction-safe, plaintext-free payload boundaries.

## Configuration posture

- Required when enabling encryption:
  - `AI_LOOM_SECRET_MASTER_KEY_ID`
  - `AI_LOOM_SECRET_MASTER_KEY`
- Optional:
  - `AI_LOOM_SECRET_MASTER_KEY_VERSION`
  - `AI_LOOM_SECRET_MASTER_KEYS_BY_ID`
  - `AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY`
- Default payload directory: `<database-directory>/secret-envelopes`.

## Fail-closed and startup behavior

- Partial master-key configuration fails startup.
- Fully configured key material composes encryption service and allows secret create/metadata flows.
- Missing key configuration keeps service composition resolvable while reporting encryption unavailable status.
- Declared required system secrets (`AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`) must be present and runtime-retrievable at startup; otherwise startup fails closed.
- Startup can migrate supported legacy environment secret values into required system secret records (enabled by default; controlled by `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV`).

## Test posture

Host runtime tests now cover:

- successful secret-service composition and use-case execution in authoritative server runtime
- fail-closed startup on partial master-key configuration
- fail-closed startup when required system secrets are missing
- successful startup when required system secrets are migrated from supported legacy env values
