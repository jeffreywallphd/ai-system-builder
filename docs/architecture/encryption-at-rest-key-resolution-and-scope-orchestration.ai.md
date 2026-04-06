# AI Companion: Encryption-at-Rest Key Resolution and Scope Orchestration

## Purpose

Story 11.2.1 baseline for Feature 11 / Epic 11.2: centralize policy-scoped encryption key selection so server/workspace/storage key decisions stay deterministic and out of UI/raw-path layers.

## Canonical files

- `src/application/security/ports/EncryptionKeyResolutionPorts.ts`
- `src/application/security/use-cases/EncryptionKeyResolutionServiceContracts.ts`
- `src/application/security/use-cases/EncryptionKeyResolutionService.ts`
- `src/application/security/tests/EncryptionKeyResolutionService.test.ts`
- `src/application/security/tests/EncryptionKeyResolutionServiceContracts.test.ts`
- `src/infrastructure/security/encryption/StaticEncryptionKeyCatalogPort.ts`
- `src/infrastructure/security/encryption/tests/StaticEncryptionKeyCatalogPort.test.ts`
- `docs/architecture/encryption-at-rest-key-resolution-and-scope-orchestration.md`

## What was added

- policy-driven key resolution service:
  - material class -> policy data class mapping
  - effective key-scope derivation via existing encryption-policy evaluation service
  - fail-closed active-key lookup via key-catalog port
- key-catalog metadata contracts:
  - `keyReferenceId`, `keyId`, `keyVersion`, algorithm, scope owner, lifecycle state, activation timestamps
  - no raw key bytes in application contracts
- deterministic infrastructure adapter:
  - static metadata catalog with server/workspace/storage-owner normalization
  - active-key selection by scope owner + optional timestamp for rotation-aware lookups
  - direct lookup by `keyReferenceId` for decrypt/re-encrypt paths

## Security/rotation posture

- `signing-material` is resolved as `secret-material` policy class, preserving always-encrypted invariants.
- missing active keys fail as explicit `key-unavailable`, not fallback.
- key references are separated from encrypted payload records to support future key rotation and replay-safe re-encryption workflows.

