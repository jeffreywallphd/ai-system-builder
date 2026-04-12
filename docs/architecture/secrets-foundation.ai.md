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

## Story 3.1.2 Security Material Classification

- Adds typed security material classification contracts in `src/application/security/contracts/SecurityMaterialClassificationContract.ts`.
- Models security material by:
  - category
  - scope (`server`/`workspace`/`user`/`storage-instance`)
  - durability (`durable` vs `ephemeral`)
  - startup requirement (`fail-fast-required` vs `optional`)
  - fallback policy
  - rotation posture
  - usage context
  - lifecycle-stage policy override (`production`/`development`/`test`)
- Wires the classification contracts into a real startup path in `src/infrastructure/security/secrets/SystemSecretBootstrapService.ts` so bootstrap diagnostics and startup validity are policy-derived instead of generic string handling.
- Distinguishes fail-fast required runtime material from optional development-ephemeral material:
  - provider credentials remain fail-fast required.
  - identity-session signing material stays fail-fast in production and is optional/ephemeral in development policy.

## Story 3.1.3 Startup Security Material Validation Pipeline

- Adds reusable startup validation pipeline contracts in:
  - `src/application/security/services/SecurityMaterialStartupValidationPipeline.ts`
- Adds authoritative-server security material catalog + host-profile lifecycle mapping in:
  - `src/infrastructure/security/startup/AuthoritativeServerSecurityMaterialValidationPipeline.ts`
- Integrates validation into early authoritative security stage:
  - `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- Startup behavior changes:
  - production-capable startup now fails fast when required durable material resolves from missing/non-durable/disallowed sources.
  - development/test startup can continue with structured warning diagnostics for policy-allowed optional material.
- Stage output now exposes structured `startupSecurityMaterialValidation` diagnostics for testability and readiness telemetry integration.
