# Secrets Envelope Encryption and Master Key Handling

This note captures Story 8.1.3 (Feature 8 / Epic 8.1): production-facing encryption-at-rest infrastructure for secret plaintext values.

## Scope

Implemented in this slice:

- envelope encryption service with per-secret data-encryption-keys (DEKs)
- master key (KEK) abstraction with environment-backed bootstrap loader
- filesystem encrypted-payload store for secret ciphertext envelopes
- concrete `ISecretEncryptionPort` implementation for application-layer secret workflows
- deterministic envelope serialization and strict envelope parsing/validation
- failure-closed behavior for tamper, key mismatch, key unavailability, and invalid key material

Out of scope in this slice:

- external KMS integrations (cloud provider-managed KEKs/HSM)
- key rotation orchestration jobs and policy automation
- transport/API handlers for secret management flows

## Canonical artifacts

- `src/infrastructure/security/encryption/SecretEnvelopeEncryption.ts`
- `src/infrastructure/security/secrets/SecretEncryptedPayloadStore.ts`
- `src/infrastructure/security/secrets/FileSystemSecretEncryptedPayloadStore.ts`
- `src/infrastructure/security/secrets/EnvelopeSecretEncryptionPort.ts`
- `src/infrastructure/security/encryption/tests/SecretEnvelopeEncryption.test.ts`
- `src/infrastructure/security/secrets/tests/EnvelopeSecretEncryptionPort.test.ts`

## Cryptographic design

`SecretEnvelopeEncryptionService` performs envelope encryption with AES-256-GCM:

1. Generate random 32-byte DEK per encryption operation.
2. Encrypt plaintext with DEK (`payload` envelope section).
3. Wrap DEK using active KEK from `ISecretMasterKeyProvider` (`keyWrap` envelope section).
4. Bind payload and key-wrap to secret identity/scope ownership using AAD.

Envelope payload includes:

- schema + version markers
- payload algorithm, IV, ciphertext, auth tag
- key-wrap algorithm, key id/version, IV, wrapped DEK, auth tag
- secret ownership context (`secretId`, scope, workspace/user ownership identifiers)

## Master key handling

`ISecretMasterKeyProvider` is the isolation seam for KEK resolution:

- `getActiveKey()` resolves the active key for new encrypt operations
- `getKeyById(...)` resolves specific keys for decrypt/unwrapping (supports historical versions)

`createSecretMasterKeyProviderFromEnvironment(...)` provides a deployment bootstrap path:

- `AI_LOOM_SECRET_MASTER_KEY_ID`
- `AI_LOOM_SECRET_MASTER_KEY`
- optional `AI_LOOM_SECRET_MASTER_KEY_VERSION`
- optional `AI_LOOM_SECRET_MASTER_KEYS_BY_ID` for additional historical key material

This keeps application contracts stable while allowing future profiles (KMS, HSM, managed secrets) to swap the provider implementation.

## Persistence posture

- Secret plaintext is never persisted in application/persistence records.
- Encrypted envelope JSON is persisted by payload reference through `ISecretEncryptedPayloadStore`.
- Secret version rows persist structured metadata:
  - `encrypted_payload_ref`
  - `payload_digest_sha256`
  - `payload_byte_length`
  - `key_encryption_context_json`

This preserves explicit policy and metadata semantics while isolating cryptographic details behind ports.

## Failure behavior

Decryption fails cleanly with explicit errors when:

- envelope payload is tampered or authentication tags do not validate
- secret ownership context does not match expected secret/version context
- required KEK id/version is unavailable
- digest validation fails
- configured key material is invalid

## Tests

- `SecretEnvelopeEncryption.test.ts` validates:
  - round-trip encryption/decryption
  - stable envelope serialization
  - tamper failure
  - invalid key material handling
- `EnvelopeSecretEncryptionPort.test.ts` validates:
  - encrypted payload is stored at rest without plaintext leakage
  - decrypt-by-version round trip through `ISecretEncryptionPort` semantics
