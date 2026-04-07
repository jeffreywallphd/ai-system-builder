# Storage Policy Metadata Model

This note documents Story 9.1.4 (Feature 9 / Epic 9.1): explicit typed policy metadata for managed storage instances.

## Canonical artifacts

- `src/domain/storage/StorageDomain.ts`
- `src/domain/storage/tests/StorageDomain.test.ts`
- `src/shared/contracts/storage/StorageTransportContracts.ts`
- `src/shared/dto/storage/StorageTransportDtos.ts`
- `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- `src/shared/schemas/storage/tests/StorageTransportSchemaContracts.test.ts`

## Policy model

Storage policy metadata now includes explicit security and lifecycle controls rather than free-form policy JSON:

- `security.encryptionMode`: `none | platform-managed | customer-managed`
- `security.contentEncryptionRequired`: boolean
- `security.keyScope`: `workspace | storage-instance | platform`
- `security.allowPreviewDecryption`: boolean
- `security.allowWorkerDecryption`: boolean
- `lifecycle.retentionExpiryAction`: `none | archive | delete`
- `lifecycle.purgeGracePeriodDays?`: positive integer when applicable

Existing policy posture fields remain part of the core contract:

- `encryption.profileId`
- `encryption.keyReferenceId?`
- `encryption.envelopeRequired`
- `retentionDays?`

## Deterministic defaults

Domain and transport schema defaults are deterministic:

- `security.encryptionMode = platform-managed`
- `security.contentEncryptionRequired = true`
- `security.keyScope = workspace`
- `security.allowPreviewDecryption = false`
- `security.allowWorkerDecryption = false`
- `lifecycle.retentionExpiryAction = none`
- `lifecycle.purgeGracePeriodDays = undefined`

## Invalid combination rules

Contradictory combinations are rejected in domain construction and transport schema validation:

- `encryptionMode=none` cannot require content encryption, envelope encryption, key references, or preview/worker decryption.
- `encryptionMode=customer-managed` requires key reference material.
- `encryptionMode=platform-managed` cannot include key reference material.
- customer-managed encryption cannot use `keyScope=platform`.
- `retentionExpiryAction` of `archive` or `delete` requires `retentionDays`.
- `purgeGracePeriodDays` is allowed only when `retentionExpiryAction=delete`.

## Architecture mapping

This story establishes the policy seams required by storage architecture for later implementation work:

- encryption and key-management rollout can bind directly to `security.encryptionMode` + `security.keyScope`
- preview/worker decryption authorization can bind directly to explicit allow flags
- lifecycle enforcement and retention cleanup jobs can bind directly to `retentionExpiryAction` + grace metadata
- policy model extensions can add typed fields in `security` or `lifecycle` without replacing the core model shape

## Story 11.3.1 alignment note

Story 11.3.1 keeps this policy model authoritative by exposing the same typed `security` fields through storage administration create/update application contracts and persisted storage-instance metadata, so future encryption enforcement flows do not require alternate policy schemas.
