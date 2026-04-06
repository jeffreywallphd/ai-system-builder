# Secret Classification and Metadata Conventions

This note documents Story 8.1.8 (Feature 8 / Epic 8.1): baseline secret classifications, naming conventions, and metadata-field rules for AI Loom secret storage.

## Canonical artifacts

- `src/shared/contracts/security/SecretClassificationContracts.ts`
- `src/shared/contracts/security/tests/SecretClassificationContracts.test.ts`
- `src/shared/schemas/security/SecretClassificationSchemaContracts.ts`
- `src/shared/schemas/security/tests/SecretClassificationSchemaContracts.test.ts`
- `src/application/security/use-cases/CreateSecretUseCase.ts`
- `src/application/security/tests/SecretCreateAndMetadataUseCases.test.ts`

## Baseline classifications

The seeded registry defines five baseline classifications:

- `provider-credential`
- `personal-api-key`
- `storage-credential`
- `signing-material`
- `integration-token`

Each classification encodes:

- canonical `namePrefix` for machine key naming (`provider.`, `personal.`, `storage.`, `signing.`, `integration.`)
- allowed `SecretKind` values
- allowed ownership scopes (`server`, `workspace`, `user`)
- entry mode (`user-entered`, `system-generated`, or `either`)
- required/optional metadata label fields

## Metadata-label conventions

Classification metadata rules are defined as normalized `metadata.labels` keys and require non-secret values only.

Required field examples by classification:

- provider credentials: `provider`, `usage`
- personal API keys: `provider`, `owner`
- storage credentials: `provider`, `resource`
- signing materials: `algorithm`, `usage`
- integration tokens: `integration`, `pairing`

Optional fields include context markers such as `environment`, `rotation`, and `usage` (classification-specific).

## Validation behavior

`CreateSecretUseCase` now validates classification conventions before persistence:

- secret key name must map to a supported classification prefix
- request `kind` must be allowed for that classification
- requested owner scope must be allowed for that classification
- required metadata-label fields must be present

Violations are rejected as `secret-invalid-request`.

## Serialization and schema stability

- Contract module exposes deterministic snapshot + serialization helpers for the classification registry.
- Shared schema contracts validate classification payload shape and reject malformed/duplicate entries.
- Tests assert seeded registry IDs, convention constraints, and serialization round-trip stability.
