# Secrets Redaction and Logging Safeguards

This note captures Story 8.1.6 (Feature 8 / Epic 8.1): prevent secret plaintext/decrypted values from leaking through logs, errors, DTO serialization, or diagnostics.

## Canonical artifacts

- `src/shared/security/SecretRedaction.ts`
- `src/shared/dto/security/SecretServiceDtos.ts`
- `src/application/security/ports/SecretObservabilityPorts.ts`
- `src/infrastructure/security/SecretObservabilityReporter.ts`
- `src/application/security/use-cases/CreateSecretUseCase.ts`
- `src/application/security/use-cases/GetSecretMetadataUseCase.ts`
- `src/application/security/tests/SecretCreateAndMetadataUseCases.test.ts`
- `src/shared/security/tests/SecretRedaction.test.ts`
- `src/infrastructure/security/tests/SecretObservabilityReporter.test.ts`

## Safeguard posture

- Secret diagnostics use DTO projection helpers that never include a plaintext field by default.
- Secret operational logs flow through a sanitization step that redacts sensitive key names recursively (`plaintext`, `token`, `password`, `secret`, `api_key`, etc.).
- Secret use cases emit only:
  - logical identifiers (`secretId`, actor id),
  - scope metadata (`scope`, `workspaceId`, `userIdentityId`),
  - safe operational outcomes (`succeeded`, `denied`, `rejected`, `failed`, `conflict`, `missing`).
- Internal secret use-case failures return fixed safe messages instead of forwarding raw thrown error text.

## Error and audit boundaries

- Secret access audit payloads remain metadata-only (no plaintext body fields).
- Internal error shaping in secret create/metadata workflows is fail-closed and non-verbose.
- Environment parsing errors for key lists no longer echo raw encoded key material in exception text.

## Required contributor practices

- Do not log secret request objects directly.
- When adding secret diagnostics or operational logs, pass data through `redactSecretMaterial(...)` or `sanitizeSecretOperationalEvent(...)`.
- Use secret diagnostic DTO helpers for create/metadata request snapshots.
- Never include plaintext/decrypted values in error messages, audit details, or transport responses.
