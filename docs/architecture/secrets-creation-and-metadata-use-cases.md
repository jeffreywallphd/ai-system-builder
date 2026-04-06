# Secret Creation and Metadata Retrieval Use Cases

This note documents Story 8.1.4 (Feature 8 / Epic 8.1): application use cases for secret creation and metadata-only retrieval.

## Canonical artifacts

- `src/application/security/use-cases/CreateSecretUseCase.ts`
- `src/application/security/use-cases/GetSecretMetadataUseCase.ts`
- `src/application/security/tests/SecretCreateAndMetadataUseCases.test.ts`

## Scope and intent

- Provide a production-safe create workflow that validates request shape, scope ownership, actor attribution, and allowed secret kinds.
- Enforce unique secret key (`name`) per ownership scope before persistence.
- Encrypt incoming plaintext through `ISecretEncryptionPort` and persist only encrypted material references/digests in version metadata.
- Provide metadata retrieval that returns `SecretReference` only and never plaintext or encrypted payload internals.
- Record actor + timestamp access decisions through `ISecretAccessAuditPort` for create and metadata-read actions.

## Validation behavior

Create use case validates and rejects with `secret-invalid-request` when:

- `actor.actorId`, `operationKey`, `secretId`, `name`, or `plaintext` is missing.
- `createdAt` is provided but not a valid timestamp.
- `owner` violates scope rules (server/workspace/user ownership contract).
- `kind` is not one of the domain-supported `SecretKinds`.

Create use case rejects duplicate key-per-scope with `secret-conflict` when a record already exists for the same normalized name + scope owner.

Metadata use case validates and rejects with `secret-invalid-request` when:

- `actor.actorId` or `secretId` is missing.
- `occurredAt` is provided but not a valid timestamp.

## Redaction and response posture

- `CreateSecretUseCase` returns `CreateSecretResult` with `SecretReference` only.
- `GetSecretMetadataUseCase` returns `SecretReference` only.
- Responses intentionally exclude plaintext secret values and version encrypted-material fields (`encryptedPayloadRef`, payload digests, byte lengths, key-encryption-context details).

## Audit posture

- Both use cases call `ISecretAccessPolicyPort` for authorization decisions.
- Both use cases emit `ISecretAccessAuditPort.recordSecretAccessDecision(...)` with actor identity and `occurredAt` timestamp from validated/normalized request context.
- Denied decisions are returned as `secret-access-denied` with reason-specific messages.

## Test coverage

`SecretCreateAndMetadataUseCases.test.ts` covers:

- successful create flow with encrypted material persistence
- duplicate-key conflict in same scope
- invalid scope-owner validation failure
- metadata retrieval success and response redaction behavior
- metadata access denied behavior
- invalid timestamp validation on create and metadata requests
