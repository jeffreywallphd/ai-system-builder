# Encryption-at-Rest Protected Value Encryption Ports

This note captures Story 11.2.2 and Story 11.2.3 for Feature 11 / Epic 11.2.

## Scope

Implemented in this slice:

- application-facing encryption/decryption ports for protected values and key-material resolution
- versioned encrypted payload descriptor contract for future rehydration and key-rotation workflows
- infrastructure AES-256-GCM adapter that performs authenticated encryption and returns opaque payload packages
- static key-material adapter for deterministic local testing/bootstrap scenarios
- explicit safe failure surfaces for malformed payloads, unavailable keys, unsupported algorithms, and authentication failures
- secret material persistence integration (`ProtectedValueSecretEncryptionPort`) so newly persisted secret value material uses protected-value descriptors/payloads
- protected secret metadata persistence wrapper (`ProtectedSecretRecordPersistenceRepository`) for strongly protected metadata fields

Out of scope in this slice:

- KMS/HSM-backed key-material adapters
- policy evaluation or key-scope resolution logic (handled by prior Feature 11 stories)
- broad cross-feature migration for all identity/audit/sharing metadata stores

## Canonical files

- `src/application/security/ports/ProtectedValueEncryptionPorts.ts`
- `src/application/security/tests/ProtectedValueEncryptionPorts.test.ts`
- `src/infrastructure/security/encryption/VersionedAesGcmProtectedValueEncryptionPort.ts`
- `src/infrastructure/security/encryption/StaticEncryptionKeyMaterialPort.ts`
- `src/infrastructure/security/encryption/tests/VersionedAesGcmProtectedValueEncryptionPort.test.ts`
- `src/infrastructure/security/encryption/tests/StaticEncryptionKeyMaterialPort.test.ts`
- `src/infrastructure/security/secrets/ProtectedValueSecretEncryptionPort.ts`
- `src/infrastructure/security/secrets/tests/ProtectedValueSecretEncryptionPort.test.ts`
- `src/infrastructure/persistence/security/ProtectedSecretRecordPersistenceRepository.ts`
- `src/infrastructure/persistence/security/tests/ProtectedSecretRecordPersistenceRepository.test.ts`

## Descriptor and payload posture

Encrypted results are returned as:

- a versioned descriptor (`protected-value-payload/v1`) that carries key reference metadata (`keyReferenceId`, `keyId`, optional `keyVersion`), scope linkage (`keyScope`, optional workspace/storage owner ids), algorithm, and `encryptedAt`
- an opaque payload package (`payloadBase64`) that callers persist/transport without handling crypto internals directly

The descriptor gives decryption and re-encryption workflows enough metadata to:

- resolve key material by stable key reference id
- verify scope expectations before decryption
- reason about historical encrypted records during key rotation

Story 11.2.3 integration persists secret material files as:

- `recordType = ai-loom-protected-secret-payload/v1`
- `encryptedPayload = { descriptor, payloadBase64 }`

This keeps protected-value descriptor metadata adjacent to the encrypted blob for replay-safe rehydration.

## Field-level metadata protection rationale

Secret persistence now protects metadata field `secret_records.metadata_description` using protected-value encryption (`secret-metadata` data class).

- protected now: freeform metadata description (high leakage risk, low query dependency)
- intentionally still plaintext: name/scope/status/tags/labels used by query/list semantics and existing governance flows

The wrapper decrypts on repository reads so src/application/domain contracts remain unchanged.

## Migration notes

- Newly written secret material payload files use protected-value records.
- Existing legacy envelope payload files are not rewritten in-place by this story.
- Existing records gain protected metadata description values when they are rewritten through create/save flows.

## Security and failure behavior

- authenticated encryption uses AES-256-GCM with AAD binding
- payload package stores an AAD digest and decryption fails closed when AAD does not match
- payload parsing validates descriptor version and package shape before cryptographic operations
- key material unavailability is explicit (`protected-value-encryption-key-unavailable`) and does not fallback to other keys
- error messages avoid plaintext/ciphertext leakage and only return safe operational metadata
