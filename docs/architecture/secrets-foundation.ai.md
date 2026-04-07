# AI Companion: Secret and Key Management Foundation

## What this slice does

- Adds canonical secret domain contracts in `src/domain/security/SecretDomain.ts`.
- Establishes server/workspace/user ownership scope rules.
- Defines secret invariants for naming, metadata redaction safety, lifecycle state, and version lineage.
- Defines key-encryption-context contracts aligned with scope ownership.
- Adds access decision contracts for permission-checked and auditable secret retrieval flows.
- Adds application security ports and service contracts for create/read/retrieve/rotate/disable/delete/list operations.

## Main files

- `src/domain/security/SecretDomain.ts`
- `src/domain/security/tests/SecretDomain.test.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/application/security/tests/SecretServiceContracts.test.ts`
- `docs/architecture/secrets-foundation.md`

## Important invariants

- Scope combinations:
  - `server`: no workspace/user identifiers.
  - `workspace`: requires workspace id and no user id.
  - `user`: requires user id (workspace id optional).
- Secret names are normalized/lowercase and pattern-validated.
- Metadata labels are redaction-safe by contract (sensitive key names and PEM-like values rejected).
- Secret record state is explicit (`active`, `disabled`, `archived`, `soft-deleted`).
- Secret version lineage is explicit and validated (`previousVersionId`, supersession, single active version).
- Key-encryption context scope and owner identifiers must match the secret owner scope.

## Application boundaries

Ports:

- `ISecretRecordPersistenceRepository`
- `ISecretEncryptionPort`
- `ISecretAccessPolicyPort`
- `ISecretAccessAuditPort`

Service contract:

- `ISecretManagementService` for create/read metadata/retrieve plaintext/rotate/disable/delete/list.

The slice is contracts-only and keeps src/infrastructure/UI concerns out of src/domain/application boundaries.
