# AI Companion: Secrets Authorization Policies

## Purpose

Story 8.2.1 + Story 8.2.2 + Story 8.2.3 baseline for Feature 8 / Epic 8.2: enforce explicit authorization, runtime retrieval governance, and comprehensive secret-sensitive audit recording with scope-aware and actor-aware controls.

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
- `docs/architecture/secrets-authorization-policies.md`

## Behavior summary

- Every secret operation path now calls `ISecretAccessPolicyPort`.
- Scope checks remain explicit across `server`, `workspace`, and `user` owners.
- Plaintext retrieval policy is stricter than metadata visibility.
- Runtime and human access modes are policy-distinguished.
- Unauthorized sensitive operations (`retrieve`, `rotate`, `disable`, `delete`) fail with non-leaky `secret-not-found`.
- Runtime retrieval now requires auditable context (`operationKey`, service identity, scope reference, justification).

## Policy posture

`SecretAuthorizationPolicyEvaluator` composes:

1. domain access decision (`evaluateSecretAccessDecision`)
2. actor-mode guardrails:
   - runtime-only plaintext retrieval
   - runtime actors cannot perform secret administrative mutations
   - unknown actor types denied

## Runtime retrieval contract posture (Story 8.2.2)

- `RetrieveSecretPlaintextRequest` now requires:
  - `operationKey`
  - `runtimeContext.serviceIdentity`
  - `runtimeContext.scope`
  - `runtimeContext.justification`
- `RetrieveSecretPlaintextForRuntimeUseCase` validates this context before decryption.
- Runtime callers must be trusted runtime actor types (`server-runtime`, `workspace-service`).
- Scope reference must match resolved secret owner; mismatch is denied with non-leaky `secret-not-found`.
- Retrieval result is narrowed for runtime use only (`secretId`, `currentVersionId`, `scope`, `plaintext`) and no longer returns a general `SecretReference` projection.
- Runtime retrieval audits now include operation/service/justification context for governance traceability.

## Audit model additions (Story 8.2.3)

- `ISecretAccessAuditPort` now records structured secret audit events via two event kinds:
  - `secret.access-decision`
  - `secret.operation`
- Both event kinds use consistent queryable identity/context fields:
  - `actor` (`actorId`, optional `actorType`, optional workspace/user ids)
  - `target` (secret id and scope context where available)
- Secret-sensitive use cases emit `secret.operation` events for:
  - create
  - read-metadata
  - retrieve-plaintext
  - rotate
  - disable
  - delete
- Operation events include stable governance fields:
  - `operation`, `status`, `reasonCode`, `occurredAt`
  - optional `operationKey` and `serviceIdentity` for runtime/governance context

## Audit safety posture

- No plaintext/decrypted secret value is serialized in audit events.
- Secret metadata payloads are not copied into operation audit records.
- Permission-sensitive denials are encoded as safe reason codes (for example `scope-mismatch`, `runtime-access-required`) without exposing secret values.

## Test posture

Coverage verifies role/scope boundaries and governance semantics:

- metadata allowed while plaintext denied for human actors
- runtime plaintext retrieval allowed for matching workspace service actors
- runtime retrieval scope-reference mismatch denied via non-leaky not-found
- runtime retrieval rejects missing justification context
- unauthorized rotate/delete return non-leaky not-found responses
- list/disable behavior honors workspace and user ownership boundaries
