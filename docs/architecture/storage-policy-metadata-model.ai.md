# AI Companion: Storage Policy Metadata Model

## Purpose

Story 9.1.4 defines explicit, typed storage policy metadata so encryption, preview, worker, sharing, and admin policy features can extend from a stable core contract.

## Canonical files

- `src/domain/storage/StorageDomain.ts`
- `src/domain/storage/tests/StorageDomain.test.ts`
- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`

## Typed policy metadata added

- security:
  - `encryptionMode` (`none | platform-managed | customer-managed`)
  - `contentEncryptionRequired`
  - `keyScope` (`workspace | storage-instance | platform`)
  - `allowPreviewDecryption`
  - `allowWorkerDecryption`
- lifecycle:
  - `retentionExpiryAction` (`none | archive | delete`)
  - optional `purgeGracePeriodDays`

## Deterministic defaults

- encryption mode defaults to platform-managed.
- content encryption is required by default.
- key scope defaults to workspace.
- preview/worker decryption defaults to false.
- retention expiry action defaults to none.

## Validation posture

Domain and schema layers reject contradictory policy combinations, including:

- no-encryption mode with required content encryption or any decryption allowance
- missing key reference for customer-managed mode
- key reference leakage into platform-managed mode
- retention-expiry hooks without retention anchor (`retentionDays`)
- purge-grace metadata outside delete-on-expiry policy

## Why this matters

This gives later storage features a stable policy foundation that is explicit, secure-by-default, and forward-extensible without requiring a policy-schema rewrite.
