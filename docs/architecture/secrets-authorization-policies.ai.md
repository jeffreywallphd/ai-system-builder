# AI Companion: Secrets Authorization Policies

## Purpose

Story 8.2.1 baseline for Feature 8 / Epic 8.2: enforce explicit authorization for all secret operations with scope-aware and actor-aware governance.

## Canonical files

- `src/application/security/use-cases/SecretAuthorizationPolicyEvaluator.ts`
- `src/application/security/use-cases/RetrieveSecretPlaintextForRuntimeUseCase.ts`
- `src/application/security/use-cases/RotateSecretUseCase.ts`
- `src/application/security/use-cases/DisableSecretUseCase.ts`
- `src/application/security/use-cases/DeleteSecretUseCase.ts`
- `src/application/security/use-cases/ListSecretsUseCase.ts`
- `src/infrastructure/security/secrets/SecretServiceComposition.ts`
- `src/application/security/tests/SecretAuthorizationPolicyAndGovernanceUseCases.test.ts`
- `docs/architecture/secrets-authorization-policies.md`

## Behavior summary

- Every secret operation path now calls `ISecretAccessPolicyPort`.
- Scope checks remain explicit across `server`, `workspace`, and `user` owners.
- Plaintext retrieval policy is stricter than metadata visibility.
- Runtime access and human administrative access are policy-distinguished.
- Unauthorized sensitive operations (`retrieve`, `rotate`, `disable`, `delete`) fail with non-leaky `secret-not-found`.

## Policy posture

`SecretAuthorizationPolicyEvaluator` composes:

1. domain access decision (`evaluateSecretAccessDecision`)
2. actor-mode guardrails:
   - runtime-only plaintext retrieval (plus server-admin)
   - runtime actors cannot perform secret administrative mutations
   - unknown actor types denied

## Test posture

Coverage verifies role/scope boundaries and governance semantics:

- metadata allowed while plaintext denied for non-admin human actors
- runtime plaintext retrieval allowed for matching workspace service actors
- unauthorized rotate/delete return non-leaky not-found responses
- list/disable behavior honors workspace and user ownership boundaries
