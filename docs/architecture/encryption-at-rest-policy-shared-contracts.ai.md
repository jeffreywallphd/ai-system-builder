# AI Companion: Encryption-at-Rest Shared Policy Contracts

## Purpose

Story 11.1.2 baseline for Feature 11 / Epic 11.1: establish stable shared DTO/schema/contract boundaries for encryption-at-rest policy exchange.

## Canonical files

- `src/shared/contracts/security/EncryptionAtRestPolicyContracts.ts`
- `src/shared/contracts/security/tests/EncryptionAtRestPolicyContracts.test.ts`
- `src/shared/dto/security/EncryptionAtRestPolicyDtos.ts`
- `src/shared/dto/security/tests/EncryptionAtRestPolicyDtos.test.ts`
- `src/shared/schemas/security/EncryptionAtRestPolicySchemaContracts.ts`
- `src/shared/schemas/security/tests/EncryptionAtRestPolicySchemaContracts.test.ts`
- `docs/architecture/encryption-at-rest-policy-shared-contracts.md`

## Added contract concepts

- explicit workspace-scoped and storage-instance-scoped policy DTOs
- metadata-protection configuration contracts for `secret-metadata` + `sensitive-metadata`
- explicit decryption allowance contract for preview/worker toggles
- encrypted material descriptor contract with policy-scope linkage metadata
- request/response DTOs for future policy upsert/evaluation/descriptor-validation handlers

## Validation posture

Schema contracts enforce Story 11.1.1 invariants at boundary level:

- decryption + encryption mode compatibility
- metadata classes cannot weaken protection posture
- scope-id requirements by policy scope
- descriptor/workspace/storage identity linkage checks
- route/query ids must match embedded policy identifiers in DTO payloads

## Boundary guidance

Use shared contracts/schemas for:

- API payload validation and canonical error-path formatting
- persistence adapter record validation before mapping
- UI/application payload construction with type-safe policy shapes

Do not move into this layer:

- persistence repository behavior
- authorization/audit orchestration
- runtime decryption enforcement strategy
