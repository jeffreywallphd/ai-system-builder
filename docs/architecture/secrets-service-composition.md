# Secret Service Composition and Host Wiring

This note documents Story 8.1.7 (Feature 8 / Epic 8.1): wire secret services into authoritative server composition.

## Canonical artifacts

- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `hosts/server/IdentityServerHost.ts`
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
  - `SecretScopeResolver`

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

## Runtime smoke coverage

`IdentityServerHost.test.ts` now verifies:

- authoritative host startup composes and exposes secret service runtime collaborators
- composed secret create/metadata use cases execute successfully under configured master-key settings
- host fails closed on partial secret master-key configuration
