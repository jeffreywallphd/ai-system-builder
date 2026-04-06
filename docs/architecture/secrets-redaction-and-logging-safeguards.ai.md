# AI Companion: Secrets Redaction and Logging Safeguards

## Purpose

Quick baseline for Story 8.1.6 (Feature 8 / Epic 8.1): ensure secret plaintext/decrypted values are not exposed through logs, errors, DTO serialization, or diagnostics.

## Canonical files

- `src/shared/security/SecretRedaction.ts`
- `src/shared/dto/security/SecretServiceDtos.ts`
- `src/application/security/ports/SecretObservabilityPorts.ts`
- `src/infrastructure/security/SecretObservabilityReporter.ts`
- `src/application/security/use-cases/CreateSecretUseCase.ts`
- `src/application/security/use-cases/GetSecretMetadataUseCase.ts`
- `docs/architecture/secrets-redaction-and-logging-safeguards.md`

## Behavior summary

- Secret create/metadata diagnostics use DTO projections that exclude plaintext fields by default.
- Secret operational events are sanitized before logging with recursive key-based redaction.
- Secret use-case observability emits only safe identifiers, scope metadata, and outcome status.
- Internal secret use-case errors return safe fixed messages rather than raw thrown error messages.
- Key-list parsing errors avoid echoing encoded key material.

## Contributor guardrails

- Never log secret request/response objects directly.
- Route secret log details through `redactSecretMaterial(...)` or `sanitizeSecretOperationalEvent(...)`.
- Keep audit and error payloads metadata-only; plaintext and decrypted values are forbidden.
