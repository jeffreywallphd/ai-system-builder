# Secrets Authorization Policies

This note documents Story 8.2.1 (Feature 8 / Epic 8.2): policy-aware authorization for all secret operations.

## Canonical files

- `src/application/security/use-cases/SecretAuthorizationPolicyEvaluator.ts`
- `src/application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase.ts`
- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/use-cases/DisableSecretUseCase.ts`
- `src/application/security/use-cases/DeleteSecretUseCase.ts`
- `src/application/security/use-cases/ListSecretsUseCase.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `src/application/security/tests/SecretAuthorizationPolicyAndGovernanceUseCases.test.ts`

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
  - allowed for runtime actors (`server-runtime`, `workspace-service`) and `server-admin`
  - denied for human non-admin actors even with metadata visibility
- administrative mutations (`create`, `rotate`, `disable`, `delete`) are denied for runtime actors
- unknown actor types fail closed

## Safe failure behavior

To reduce secret existence leakage beyond metadata rules:

- `retrieve-plaintext`, `rotate`, `disable`, and `delete` return `secret-not-found` when authorization denies a known secret id.
- metadata and list operations remain explicit authorization outcomes (`secret-access-denied`) because those surfaces are the approved visibility surfaces.

All decisions still emit audit events with action, scope, actor attribution, allow/deny result, and reason code.

## Composition and boundaries

- Secret policy evaluation remains an application-layer seam via `ISecretAccessPolicyPort`.
- Server composition now wires all secret operations through formal use cases and the secret authorization evaluator.
- Domain/application boundaries are preserved: no transport or persistence policy logic is embedded in use-cases.

## Tests

`SecretAuthorizationPolicyAndGovernanceUseCases.test.ts` verifies:

- plaintext retrieval stricter than metadata for human actors
- runtime retrieval allowed only in matching scope
- unauthorized rotate/delete return non-leaky `not-found`
- workspace and user boundary behavior for list and disable operations
