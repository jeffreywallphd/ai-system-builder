# AI Companion: Encryption-at-Rest Policy Foundation

## Purpose

Story 11.1.1 baseline for Feature 11 / Epic 11.1: make encryption-at-rest policy a first-class domain concept with explicit invariants and reusable contracts.

## Canonical files

- `src/domain/security/EncryptionAtRestPolicyDomain.ts`
- `src/domain/security/tests/EncryptionAtRestPolicyDomain.test.ts`
- `src/shared/contracts/security/EncryptionAtRestPolicyContracts.ts`
- `src/shared/contracts/security/tests/EncryptionAtRestPolicyContracts.test.ts`
- `docs/architecture/encryption-at-rest-policy-foundation.md`

## Domain concepts added

- `encryptionMode`: `none | metadata-only | scoped-content`
- `keyScope`: `server | workspace | storage-instance`
- `protectedDataClass`: `secret-material | secret-metadata | sensitive-metadata | asset-content`
- explicit `decryption` allowance (`allowPreview`, `allowWorker`)
- `EncryptedMaterialReference` for encrypted payload locator + key-scope contract
- scoped policy definitions (`platform`, `workspace`, `storage-instance`) with typed rules
- deterministic effective-policy evaluation contracts and source tracing

## Invariant posture

- Secret material is always encrypted (`scoped-content`) with explicit key scope.
- Secret/sensitive metadata cannot be set to `none`.
- `scoped-content` requires key scope.
- `none` mode rejects key scope and decryption allowances.
- Overrides cannot weaken parent encryption mode.
- Overrides cannot broaden parent decryption allowances.

## Boundary guidance

Keep in domain:

- value-object normalization
- policy/rule invariants
- inheritance/override correctness
- encrypted-reference compatibility checks

Keep in application services:

- repository loading and persistence orchestration
- authorization and audit workflows for policy changes
- runtime pipeline-specific fallback/compatibility orchestration
