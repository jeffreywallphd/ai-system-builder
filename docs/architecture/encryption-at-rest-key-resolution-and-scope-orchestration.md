# Encryption-at-Rest Key Resolution and Scope Orchestration

This note captures Story 11.2.1 for Feature 11 / Epic 11.2.

## Scope

Implemented in this slice:

- application-level key resolution contracts and orchestration service that determine effective key scope from policy inputs
- material-class-aware key resolution (`secret-material`, `signing-material`, `secret-metadata`, `sensitive-metadata`, `asset-content`)
- deterministic key catalog port for active key selection by server/workspace/storage-instance scope owners
- concrete infrastructure adapter for metadata-only key catalogs with active/retiring/retired lifecycle support
- stored key-reference lookup contract to keep encrypted payload records decoupled from raw key bytes and rotation workflows

Out of scope in this slice:

- persistence-backed key-catalog repositories
- cloud KMS/HSM adapters
- runtime wiring changes for all secret/storage/asset pipelines

## Canonical files

- `src/application/security/ports/EncryptionKeyResolutionPorts.ts`
- `src/application/security/ports/EncryptionEnforcementObservabilityPorts.ts`
- `src/application/security/use-cases/EncryptionKeyResolutionServiceContracts.ts`
- `src/application/security/use-cases/EncryptionKeyResolutionService.ts`
- `src/application/security/tests/EncryptionKeyResolutionService.test.ts`
- `src/application/security/tests/EncryptionKeyResolutionServiceContracts.test.ts`
- `src/infrastructure/security/encryption/StaticEncryptionKeyCatalogPort.ts`
- `src/infrastructure/security/encryption/tests/StaticEncryptionKeyCatalogPort.test.ts`
- `src/infrastructure/security/EncryptionEnforcementObservabilityReporter.ts`
- `src/infrastructure/security/tests/EncryptionEnforcementObservabilityReporter.test.ts`

## Key-scope behavior

`EncryptionKeyResolutionService` resolves key material in two steps:

1. evaluate effective encryption policy (existing `IEncryptionPolicyEvaluationService`) to determine whether scoped-content encryption is required and which key scope applies (`server`, `workspace`, or `storage-instance`);
2. resolve the active key descriptor for that scope owner via `IEncryptionKeyCatalogPort`.

Scope-owner derivation is fail-closed:

- `server` scope rejects workspace/storage identifiers
- `workspace` scope requires `workspaceId`
- `storage-instance` scope requires both `workspaceId` and `storageInstanceId`

Missing active keys return deterministic `key-unavailable` outcomes instead of implicit fallback behavior.

## Always-encrypted posture for secrets and signing material

- `signing-material` intentionally maps to policy data class `secret-material`.
- `secret-material` and `signing-material` therefore inherit domain invariants that require `scoped-content` encryption with explicit key scope.
- callers cannot resolve a permissive no-key path for these classes through the key-resolution service.

## Rotation compatibility posture

This slice separates persisted key references from key material:

- encrypted records are expected to store `keyReferenceId` (and related metadata) rather than raw key bytes
- `resolveStoredKeyReference(...)` allows decryption/re-encryption workflows to recover key metadata by reference
- catalog entries expose lifecycle metadata (`active`, `retiring`, `retired`) and activation timestamps for future rotation orchestration

The static adapter is intentionally metadata-only and does not expose or persist raw cryptographic key bytes.

## Story 11.3.4 operational diagnostics

- `EncryptionKeyResolutionService` now emits best-effort diagnostics for:
  - key-scope resolution success
  - policy-denied/rejected scope-owner outcomes
  - missing active-key outcomes
  - stored key-reference resolution success/missing/failure outcomes
- Diagnostics intentionally expose only safe operational context:
  - visible: material class, policy data class, scope owner scope, policy source, key lifecycle state
  - hidden/redacted: key ids, key references, raw key material, payload/plaintext fields, filesystem/object paths

