# AI Companion: Encryption-at-Rest Protected Value Encryption Ports

## Purpose

Story 11.2.2 + Story 11.2.3 baseline for Feature 11 / Epic 11.2: provide reusable encryption/decryption primitives and wire them into secret persistence for always-encrypted material plus strongly protected metadata.

## Canonical files

- `src/application/security/ports/ProtectedValueEncryptionPorts.ts`
- `src/application/security/tests/ProtectedValueEncryptionPorts.test.ts`
- `src/infrastructure/security/encryption/VersionedAesGcmProtectedValueEncryptionPort.ts`
- `src/infrastructure/security/encryption/StaticEncryptionKeyMaterialPort.ts`
- `src/infrastructure/security/encryption/tests/VersionedAesGcmProtectedValueEncryptionPort.test.ts`
- `src/infrastructure/security/encryption/tests/StaticEncryptionKeyMaterialPort.test.ts`
- `src/infrastructure/security/secrets/ProtectedValueSecretEncryptionPort.ts`
- `src/infrastructure/persistence/security/ProtectedSecretRecordPersistenceRepository.ts`
- `docs/architecture/secrets-persistence-contracts.md`
- `docs/architecture/encryption-at-rest-protected-value-encryption-ports.md`

## Design summary

- app boundary introduces:
  - protected payload descriptor + opaque payload contracts
  - encryption/decryption result union with explicit safe error codes
  - key-material resolution port by `keyReferenceId`
- infra adapter provides:
  - AES-256-GCM authenticated encryption/decryption
  - versioned payload package parsing/serialization
  - AAD digest binding + fail-closed authentication mismatch behavior
  - explicit malformed payload / unsupported algorithm / key unavailable outcomes

## Boundary posture

- application and use-case layers depend only on `IProtectedValueEncryptionPort` + `IEncryptionKeyMaterialPort`.
- cryptographic implementation and key-byte handling remain in infrastructure adapters.
- payload consumers receive opaque encrypted payload objects and descriptor metadata only.
- secret service composition now persists secret material through protected-value descriptor/payload records.

## Rotation posture

- descriptors carry key reference metadata (`keyReferenceId`, `keyId`, optional `keyVersion`) and scope linkage data.
- decrypt paths resolve key bytes by key reference instead of embedding key material in persisted records.
- descriptor versioning is explicit (`protected-value-payload/v1`) to support future algorithm/package evolution.

## Story 11.2.3 persistence behavior

- secret material persistence now stores `ai-loom-protected-secret-payload/v1` records in payload storage.
- secret metadata `description` is wrapped/encrypted at repository boundaries via `ProtectedSecretRecordPersistenceRepository`.
- read/list API behavior remains unchanged because decryption occurs before returning domain records.
- query-critical metadata remains plaintext intentionally to preserve existing filter/index behavior.
