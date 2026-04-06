# Secret Service Composition and Host Wiring

This note documents Story 8.1.7 (Feature 8 / Epic 8.1): wire secret services into authoritative server composition.

## Canonical artifacts

- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `hosts/server/tests/IdentityServerHost.test.ts`

## Composition behavior

- Authoritative server host now composes a formal secret service at startup through `composeServerSecretService(...)`.
- Composition remains outer-layer only:
  - secret record persistence: `SqliteSecretRecordPersistenceAdapter`
  - encryption port: `EnvelopeSecretEncryptionPort` (environment-backed master-key provider)
  - access policy collaborator: domain-backed `evaluateSecretAccessDecision(...)`
  - observability collaborator: `SecretObservabilityReporter`
  - access audit collaborator: host-provided audit hook callback
- The composed service exposes application-level use cases:
  - `CreateSecretUseCase`
  - `GetSecretMetadataUseCase`
  - `RetrieveSecretPlaintextForRuntimeUseCase`
  - `RotateSecretUseCase`
  - `ReEncryptSecretsUseCase`
  - `DisableSecretUseCase`
  - `DeleteSecretUseCase`
  - `ListSecretsUseCase`
  - `SecretScopeResolver`
- Composition now additionally exposes `runtimeSecretConsumptionAdapters` so runtime callers can use formal secret retrieval adapters instead of ad hoc credential access paths.

### Secret audit hook contract

- Secret composition audit hook now receives structured secret audit events from two families:
  - `secret.access-decision`
  - `secret.operation`
- Host logging can route both decision and operation events through one callback without plaintext exposure.

## Environment posture

Secret envelope encryption in host composition uses:

- `AI_LOOM_SECRET_MASTER_KEY_ID`
- `AI_LOOM_SECRET_MASTER_KEY`
- optional `AI_LOOM_SECRET_MASTER_KEY_VERSION`
- optional `AI_LOOM_SECRET_MASTER_KEYS_BY_ID`
- optional `AI_LOOM_SECRET_ENCRYPTED_PAYLOAD_DIRECTORY`

Default encrypted payload directory (when not configured) is:

- `<directory-of-host-database>/secret-envelopes`

## Fail-closed behavior

- If neither master-key id nor key is configured, host composes the secret service in a disabled encryption posture (service resolves; encryption operations are unavailable until configured).
- If only one of the required key settings is provided, host startup fails closed with explicit configuration error.
- Invalid key material during configured startup also fails host startup.
- Required system secrets (when declared by `AI_LOOM_SECRET_BOOTSTRAP_REQUIRED_SYSTEM_SECRET_IDS`) are now validated at startup and fail closed when missing/unusable.
- Legacy environment secret values can be migrated into required secret records during startup (default enabled via `AI_LOOM_SECRET_BOOTSTRAP_MIGRATE_LEGACY_ENV`).

## Runtime smoke coverage

`IdentityServerHost.test.ts` now verifies:

- authoritative host startup composes and exposes secret service runtime collaborators
- composed secret create/metadata use cases execute successfully under configured master-key settings
- host fails closed on partial secret master-key configuration
- host fails closed when required system secrets are missing
- host can migrate required system secrets from supported legacy environment values
