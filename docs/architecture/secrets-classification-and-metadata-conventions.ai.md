# AI Companion: Secret Classification and Metadata Conventions

## Purpose

Quick baseline for Story 8.1.8 (Feature 8 / Epic 8.1): seed authoritative secret classifications and enforce stable naming/metadata conventions for create flows.

## Canonical files

- `src/shared/contracts/security/SecretClassificationContracts.ts`
- `src/shared/contracts/security/tests/SecretClassificationContracts.test.ts`
- `src/shared/schemas/security/SecretClassificationSchemaContracts.ts`
- `src/shared/schemas/security/tests/SecretClassificationSchemaContracts.test.ts`
- `src/application/security/use-cases/CreateSecretUseCase.ts`
- `src/application/security/tests/SecretCreateAndMetadataUseCases.test.ts`
- `docs/architecture/secrets-classification-and-metadata-conventions.md`

## Classification registry

Seeded baseline classification IDs:

- `provider-credential`
- `personal-api-key`
- `storage-credential`
- `signing-material`
- `integration-token`

Each entry includes:

- canonical name prefix (`provider.`, `personal.`, `storage.`, `signing.`, `integration.`)
- allowed secret kinds
- allowed scopes
- entry mode (`user-entered`, `system-generated`, `either`)
- required/optional metadata label fields

## Validation posture

Create-secret validation now enforces classification conventions:

- name prefix must resolve to a supported classification
- requested kind must be allowed by classification
- scope owner must be allowed by classification
- required metadata label keys must be present

Rejections map to `secret-invalid-request`.

## Stability posture

- Deterministic registry snapshot/serialization helpers are provided for downstream contracts.
- Shared schema validators enforce classification payload shape and duplicate-ID/duplicate-metadata-field safety.
- Tests cover seeded IDs, constraint enforcement, and snapshot serialization round-trip stability.
