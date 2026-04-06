# Encryption-at-Rest Shared Policy Contracts

This note captures Story 11.1.2 for Feature 11 / Epic 11.1.

## Scope

Implemented in this slice:

- expanded shared encryption-at-rest contracts for workspace/storage policy exchange, metadata protection posture, decryption allowances, and encrypted material descriptors
- DTO request/response contracts for workspace and storage encryption policy upsert/query surfaces
- schema-validation contracts for transport and persistence payloads that enforce Story 11.1.1 invariants at boundaries
- validation adapters that produce stable issue-path details for API and persistence adapters

Out of scope in this slice:

- repository persistence implementation for encryption policy records
- HTTP/IPC handler wiring for encryption policy endpoints
- runtime worker/preview enforcement adapters

## Canonical files

- `src/shared/contracts/security/EncryptionAtRestPolicyContracts.ts`
- `src/shared/contracts/security/tests/EncryptionAtRestPolicyContracts.test.ts`
- `src/shared/dto/security/EncryptionAtRestPolicyDtos.ts`
- `src/shared/dto/security/tests/EncryptionAtRestPolicyDtos.test.ts`
- `src/shared/schemas/security/EncryptionAtRestPolicySchemaContracts.ts`
- `src/shared/schemas/security/tests/EncryptionAtRestPolicySchemaContracts.test.ts`

## Contract surface summary

Shared contracts now provide explicit exchange-safe shapes for:

- `WorkspaceEncryptionAtRestPolicyDto`
- `StorageInstanceEncryptionAtRestPolicyDto`
- `MetadataProtectionConfigurationDto`
- `DecryptionAllowanceDto`
- `EncryptedMaterialDescriptorDto`

The contracts preserve Story 11.1.1 vocabulary (`encryptionMode`, `keyScope`, `protectedDataClass`, policy `scope`) and avoid infrastructure-specific storage/runtime details.

## Validation behavior

`EncryptionAtRestPolicySchemaContracts.ts` encodes boundary validation with fail-closed behavior:

- decryption allowance consistency between nested and flattened fields
- mode/key-scope/decryption compatibility (`none`, `metadata-only`, `scoped-content`)
- metadata protection restrictions for `secret-metadata` and `sensitive-metadata`
- scope-specific identity rules (`platform`, `workspace`, `storage-instance`)
- descriptor scope-linkage checks for workspace/storage identifiers
- request-level identity consistency (route/workspace/storage ids matching embedded policy payloads)

These schemas are suitable for future API handlers and persistence adapters without leaking domain internals into transport callers.

## Boundary guidance

Keep in shared contracts/schemas:

- payload-level shape contracts
- boundary-level validation and issue formatting
- projection helpers for domain-to-contract mapping

Keep in application/infrastructure (future slices):

- authorization for policy mutation operations
- persistence orchestration, optimistic concurrency, and auditing
- runtime execution behavior for preview/worker policy enforcement
