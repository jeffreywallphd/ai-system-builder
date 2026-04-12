# Encryption-at-Rest Policy Foundation

This note captures Story 11.1.1 foundation work for Feature 11 / Epic 11.1.

## Scope

Implemented in this slice:

- canonical encryption-at-rest domain contracts in `src/domain/security/EncryptionAtRestPolicyDomain.ts`
- first-class value objects for encryption mode, key scope, protected data class, decryption allowance, encrypted material references, and policy scope
- domain invariants for always-encrypted secrets and strongly protected metadata
- inheritance/override evaluation contracts across platform, workspace, and storage-instance policy scopes
- shared contract projection in `src/shared/contracts/security/EncryptionAtRestPolicyContracts.ts`

Out of scope in this slice:

- persistence schema/repository implementation for encryption policies
- runtime enforcement adapters in storage/asset pipelines
- UI policy editing and transport handlers

## Canonical files

- `src/domain/security/EncryptionAtRestPolicyDomain.ts`
- `src/domain/security/tests/EncryptionAtRestPolicyDomain.test.ts`
- `src/shared/contracts/security/EncryptionAtRestPolicyContracts.ts`
- `src/shared/contracts/security/tests/EncryptionAtRestPolicyContracts.test.ts`

## Domain model summary

`EncryptionAtRestPolicyDomain.ts` establishes explicit domain concepts:

- `EncryptionMode`: `none | metadata-only | scoped-content`
- `EncryptionKeyScope`: `server | workspace | storage-instance`
- `ProtectedDataClass`: `secret-material | secret-metadata | sensitive-metadata | asset-content`
- `DecryptionAllowance` with bounded preview/worker decryption toggles
- `EncryptedMaterialReference` value object for encrypted payload metadata and key-scope binding
- `EncryptionAtRestPolicyDefinition` at scope levels (`platform`, `workspace`, `storage-instance`)
- `EncryptionPolicyEvaluationResult` for deterministic effective-policy resolution

## Invariant posture

Core fail-closed invariants now live in the domain layer:

- Secret material must always be encrypted with `scoped-content` and explicit key scope.
- Secret metadata and sensitive metadata cannot use `none` mode.
- `scoped-content` requires explicit key scope.
- `none` mode cannot include key scope or decryption allowances.
- Worker decryption is only valid for `scoped-content`.
- Preview decryption is rejected for `metadata-only` and for protected metadata classes.
- Platform baseline policy must define secret-material and metadata protection rules.

## Inheritance and override rules

`evaluateEncryptionAtRestPolicy(...)` enforces deterministic policy inheritance:

- baseline policy source order: platform -> workspace -> storage-instance
- child scope rules may strengthen posture but may not weaken parent encryption mode
- child scope rules may further restrict decryption allowances but may not broaden them
- evaluation returns resolved source, inherited path, and normalized effective posture fields

This gives a stable contract for future application services that must evaluate policy without embedding precedence logic in adapters.

## Domain vs application boundary

Rules that remain in domain entities/value objects:

- policy shape validation
- protected data class invariants
- key-scope and decryption-allowance consistency
- inheritance and override precedence correctness
- encrypted material reference compatibility checks

Rules that belong in application services (future slices):

- loading/merging persisted policy records from repositories
- workspace/storage ownership authorization for policy changes
- audit/event emission for policy updates and evaluation decisions
- orchestration-level compatibility handling for previews/worker pipelines

## Tests

- `src/domain/security/tests/EncryptionAtRestPolicyDomain.test.ts` validates invariant failures, inheritance behavior, and encrypted-reference compatibility checks.
- `src/shared/contracts/security/tests/EncryptionAtRestPolicyContracts.test.ts` validates stable DTO projections and deterministic registry serialization.
