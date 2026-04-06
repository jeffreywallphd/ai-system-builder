# AI Companion: Secret Creation and Metadata Retrieval Use Cases

## Purpose

Quick baseline for Story 8.1.4 (Feature 8 / Epic 8.1): implement create-secret and metadata-read application workflows without plaintext exposure.

## Canonical files

- `src/application/security/use-cases/CreateSecretUseCase.ts`
- `src/application/security/use-cases/GetSecretMetadataUseCase.ts`
- `src/application/security/tests/SecretCreateAndMetadataUseCases.test.ts`
- `docs/architecture/secrets-creation-and-metadata-use-cases.md`

## Behavior summary

- Create flow validates required fields, scope owner invariants, timestamp shape, and allowed `SecretKinds`.
- Create flow checks uniqueness of secret key name within the requested scope owner.
- Plaintext is encrypted via `ISecretEncryptionPort` before persistence.
- Metadata retrieval uses `SecretReference` projection only; plaintext and encrypted-material internals never appear in response payloads.
- Both use cases use policy + audit ports to capture actor and timestamp on allow/deny decisions.

## Error posture

- validation failures: `secret-invalid-request`
- duplicate key in scope: `secret-conflict`
- authorization denial: `secret-access-denied`
- missing record (metadata read): `secret-not-found`
- unexpected processing faults: `secret-internal`

## Test posture

The story test file verifies:

- create success path and encrypted version persistence
- duplicate key rejection
- invalid scope validation rejection
- metadata redaction and actor/timestamp audit evidence
- metadata access-denied behavior
- invalid timestamp validation on both use cases
