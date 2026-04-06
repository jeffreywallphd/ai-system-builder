# AI Companion: Secret-Backed Feature Extension Guidance

## Purpose

Story 8.3.7 baseline for Feature 8 / Epic 8.3: provide a contributor-safe extension pattern so new modules use formal secret-service flows instead of plaintext config shortcuts.

## Canonical files

- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`
- `src/application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase.ts`
- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/use-cases/SecretScopeResolver.ts`
- `src/application/security/use-cases/SecretAuthorizationPolicyEvaluator.ts`
- `src/shared/security/SecretRedaction.ts`
- `src/shared/dto/security/SecretTransportDtos.ts`
- `src/infrastructure/security/secrets/ServerPlatformSecretConsumers.ts`
- `docs/architecture/secrets-feature-extension-guidance.md`

## Core contributor rules

- Choose secret scope by owner (`server`, `workspace`, `user`) and keep scope-owner invariants explicit.
- Runtime secret reads must go through use cases/adapters (`ISecretRuntimeConsumptionAdapters` or `ServerPlatformSecretConsumers`).
- Keep command DTOs and query DTOs separated; never add plaintext fields to metadata/list/detail responses.
- Route all secret operational logging/diagnostics through redaction helpers; never log plaintext/decrypted values.
- Keep authorization/audit paths intact by supplying operation governance context (`operationKey`, `serviceIdentity`, justification).
- Treat rotation as active-version replacement with lineage preservation; handle `secret-conflict` by metadata refresh + controlled retry.

## Anti-patterns to reject

- runtime credentials loaded directly from env/config when a formal secret id exists;
- direct feature-service access to secret repositories or encryption ports;
- plaintext/ciphertext exposure in API responses, logs, or audit details;
- scope broadening (for example using user secrets as workspace shared credentials).

## Related docs

- `docs/secret-backed-feature-contributor-guide.md`
- `docs/architecture/secrets-service-consumption-adapters.md`
- `docs/architecture/secrets-redaction-and-logging-safeguards.md`
- `docs/architecture/secrets-rotation-and-version-activation-workflows.md`
