# Encryption-at-Rest Protected Value Encryption Ports

This note captures Story 11.2.2 for Feature 11 / Epic 11.2.

## Scope

Implemented in this slice:

- application-facing encryption/decryption ports for protected values and key-material resolution
- versioned encrypted payload descriptor contract for future rehydration and key-rotation workflows
- infrastructure AES-256-GCM adapter that performs authenticated encryption and returns opaque payload packages
- static key-material adapter for deterministic local testing/bootstrap scenarios
- explicit safe failure surfaces for malformed payloads, unavailable keys, unsupported algorithms, and authentication failures

Out of scope in this slice:

- KMS/HSM-backed key-material adapters
- persistence orchestration for encrypted payload records
- policy evaluation or key-scope resolution logic (handled by prior Feature 11 stories)

## Canonical files

- `src/application/security/ports/ProtectedValueEncryptionPorts.ts`
- `src/application/security/tests/ProtectedValueEncryptionPorts.test.ts`
- `src/infrastructure/security/encryption/VersionedAesGcmProtectedValueEncryptionPort.ts`
- `src/infrastructure/security/encryption/StaticEncryptionKeyMaterialPort.ts`
- `src/infrastructure/security/encryption/tests/VersionedAesGcmProtectedValueEncryptionPort.test.ts`
- `src/infrastructure/security/encryption/tests/StaticEncryptionKeyMaterialPort.test.ts`

## Descriptor and payload posture

Encrypted results are returned as:

- a versioned descriptor (`protected-value-payload/v1`) that carries key reference metadata (`keyReferenceId`, `keyId`, optional `keyVersion`), scope linkage (`keyScope`, optional workspace/storage owner ids), algorithm, and `encryptedAt`
- an opaque payload package (`payloadBase64`) that callers persist/transport without handling crypto internals directly

The descriptor gives decryption and re-encryption workflows enough metadata to:

- resolve key material by stable key reference id
- verify scope expectations before decryption
- reason about historical encrypted records during key rotation

## Security and failure behavior

- authenticated encryption uses AES-256-GCM with AAD binding
- payload package stores an AAD digest and decryption fails closed when AAD does not match
- payload parsing validates descriptor version and package shape before cryptographic operations
- key material unavailability is explicit (`protected-value-encryption-key-unavailable`) and does not fallback to other keys
- error messages avoid plaintext/ciphertext leakage and only return safe operational metadata
