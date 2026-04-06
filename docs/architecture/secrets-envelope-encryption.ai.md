# AI Companion: Secrets Envelope Encryption and Master Key Handling

## Purpose

Quick baseline for Story 8.1.3 (Feature 8 / Epic 8.1): protect secret plaintext at rest with envelope encryption while keeping crypto policy explicit and isolated behind ports.

## Canonical files

- `src/infrastructure/security/encryption/SecretEnvelopeEncryption.ts`
- `src/infrastructure/security/secrets/SecretEncryptedPayloadStore.ts`
- `src/infrastructure/security/secrets/FileSystemSecretEncryptedPayloadStore.ts`
- `src/infrastructure/security/secrets/EnvelopeSecretEncryptionPort.ts`
- `src/infrastructure/security/encryption/tests/SecretEnvelopeEncryption.test.ts`
- `src/infrastructure/security/secrets/tests/EnvelopeSecretEncryptionPort.test.ts`
- `docs/architecture/secrets-envelope-encryption.md`

## Design summary

- AES-256-GCM envelope design:
  - random DEK per encryption operation,
  - plaintext encrypted under DEK,
  - DEK wrapped under master key/KEK.
- Envelope includes schema/version + payload section + key-wrap section + secret ownership context.
- AAD binds encryption and key-wrap to `secretId` and scope ownership fields.
- Envelope serialization is deterministic via canonical field ordering.

## Boundary posture

- Cryptographic behavior is isolated in infrastructure security components.
- Application layer still depends only on `ISecretEncryptionPort`.
- Master key retrieval is abstracted by `ISecretMasterKeyProvider`.
- Payload persistence is abstracted by `ISecretEncryptedPayloadStore`.
- Concrete filesystem adapters are replaceable by future KMS/HSM-backed adapters without changing application contracts.

## Operational assumptions

- `AI_LOOM_SECRET_MASTER_KEY_ID` + `AI_LOOM_SECRET_MASTER_KEY` are required for environment bootstrap.
- Optional `AI_LOOM_SECRET_MASTER_KEY_VERSION` and `AI_LOOM_SECRET_MASTER_KEYS_BY_ID` support decrypting historical material.
- Key material must be 32-byte AES keys (base64 or hex).
- Missing/invalid key material fails closed.

## Verification posture

- Round-trip encryption/decryption is covered.
- Tampered ciphertext fails authentication/decrypt.
- Wrong or missing key material fails with explicit errors.
- Persisted payload artifacts do not contain plaintext values.
