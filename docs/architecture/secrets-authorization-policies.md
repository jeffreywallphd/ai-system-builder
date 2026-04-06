# Secrets Authorization Policies

This note documents Story 8.2.1, Story 8.2.2, and Story 8.2.3 (Feature 8 / Epic 8.2): policy-aware authorization, runtime retrieval governance, and comprehensive audit recording for secret-sensitive operations.

## Canonical files

- `src/application/security/use-cases/SecretAuthorizationPolicyEvaluator.ts`
- `src/application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase.ts`
- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/use-cases/DisableSecretUseCase.ts`
- `src/application/security/use-cases/DeleteSecretUseCase.ts`
- `src/application/security/use-cases/ListSecretsUseCase.ts`
- `src/application/security/use-cases/SecretManagementServiceContracts.ts`
- `src/application/security/ports/SecretServicePorts.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `src/application/security/tests/SecretAuthorizationPolicyAndGovernanceUseCases.test.ts`
- `src/application/security/tests/SecretCreateAndMetadataUseCases.test.ts`

## Permission model

Secret operations are explicitly policy-checked through `ISecretAccessPolicyPort` for:

- `create`
- `read-metadata`
- `retrieve-plaintext`
- `rotate`
- `disable`
- `delete`
- `list`

Scope ownership is authoritative and validated against server/workspace/user boundaries before operations succeed.

### Runtime vs human access posture

`SecretAuthorizationPolicyEvaluator` wraps domain access decisions and enforces actor-mode semantics:

- plaintext retrieval is stricter than metadata visibility:
  - allowed for runtime actors only (`server-runtime`, `workspace-service`)
  - denied for human actors even with metadata visibility
- administrative mutations (`create`, `rotate`, `disable`, `delete`) are denied for runtime actors
- unknown actor types fail closed

## Runtime retrieval contract governance (Story 8.2.2)

`RetrieveSecretPlaintextForRuntimeUseCase` now requires explicit runtime retrieval context on every request:

- `operationKey` (auditable protected-operation reference)
- `runtimeContext.serviceIdentity` (trusted runtime service identity)
- `runtimeContext.scope` (explicit `server`/`workspace`/`user` scope owner reference)
- `runtimeContext.justification` (caller-provided reason for plaintext retrieval)

Runtime plaintext retrieval fails request validation when any of the above context is missing/invalid.

Additional safeguards:

- runtime-only caller enforcement at use-case boundary (human actor types are denied via non-leaky `secret-not-found`)
- scope-reference mismatch handling:
  - if `runtimeContext.scope` does not match the resolved secret owner, retrieval is denied via non-leaky `secret-not-found`
  - denial is still audit-recorded with scope mismatch reason
- retrieval response is narrowed to runtime-only payload:
  - `secretId`
  - `currentVersionId`
  - `scope`
  - decrypted `plaintext`
  - no `SecretReference` metadata projection in plaintext result payload

## Safe failure behavior

To reduce secret existence leakage beyond metadata rules:

- `retrieve-plaintext`, `rotate`, `disable`, and `delete` return `secret-not-found` when authorization denies a known secret id.
- metadata and list operations remain explicit authorization outcomes (`secret-access-denied`) because those surfaces are the approved visibility surfaces.

All decisions still emit audit events with action, scope, actor attribution, allow/deny result, and reason code.
Runtime retrieval audit events now additionally capture `operationKey`, `serviceIdentity`, and `justification` context.

## Secret operation audit model (Story 8.2.3)

Secret audit emissions now include two structured event families through `ISecretAccessAuditPort`:

- `secret.access-decision`
- `secret.operation`

Both families share normalized actor and target structures so events remain queryable across operations:

- `actor`: `actorId`, optional `actorType`, optional `workspaceId`, optional `userIdentityId`
- `target`: optional `secretId`, optional `scope`, optional `workspaceId`, optional `userIdentityId`

`secret.operation` events are emitted for secret-sensitive use cases:

- `create`
- `read-metadata`
- `retrieve-plaintext`
- `rotate`
- `disable`
- `delete`

Each operation event includes:

- `operation`
- `status` (`succeeded`, `denied`, `rejected`, `failed`, `conflict`, `missing`)
- `reasonCode`
- `occurredAt`
- optional governance context (`operationKey`, `serviceIdentity`) where relevant

### Safety posture for audit payloads

- Secret plaintext is never included in `secret.access-decision` or `secret.operation` payloads.
- Secret metadata labels/tags are not copied into operation audit records.
- Permission-sensitive failures (for example `scope-mismatch`, `runtime-access-required`, and other deny reasons) are emitted as stable reason codes without secret value material.

## Composition and boundaries

- Secret policy evaluation remains an application-layer seam via `ISecretAccessPolicyPort`.
- Server composition now wires all secret operations through formal use cases and the secret authorization evaluator.
- Domain/application boundaries are preserved: no transport or persistence policy logic is embedded in use-cases.

## Tests

`SecretAuthorizationPolicyAndGovernanceUseCases.test.ts` verifies:

- plaintext retrieval stricter than metadata for human actors
- runtime retrieval allowed only in matching scope
- runtime retrieval requires justification/context fields suitable for audit
- runtime retrieval denies scope-reference mismatch with non-leaky `not-found`
- unauthorized rotate/delete return non-leaky `not-found`
- workspace and user boundary behavior for list and disable operations
