# Encryption-at-Rest Policy Application Evaluation Ports

This note captures Story 11.1.3 for Feature 11 / Epic 11.1.

## Scope

Implemented in this slice:

- application-level encryption policy evaluation seams for server/workspace/storage scoped decisions
- reusable request/response contracts for content-encryption requirement, key-scope resolution, preview decryption allowance, and worker decryption allowance
- persistence-agnostic policy-context resolver port for loading effective platform/workspace/storage policy sets
- default application evaluator wired directly to Story 11.1.1 domain invariants without cryptography or repository coupling
- contract and behavior tests showing use by storage, asset, secret, and preview callers

Out of scope in this slice:

- repository-backed policy loading implementation
- cryptography adapter integration and encrypted material persistence
- runtime worker/preview enforcement plumbing

## Canonical files

- `src/application/security/ports/EncryptionAtRestPolicyEvaluationPorts.ts`
- `src/application/security/ports/EncryptionEnforcementObservabilityPorts.ts`
- `src/application/security/use-cases/EncryptionPolicyEvaluationServiceContracts.ts`
- `src/application/security/use-cases/EncryptionPolicyEvaluationService.ts`
- `src/application/security/tests/EncryptionPolicyEvaluationService.test.ts`
- `src/application/security/tests/EncryptionPolicyEvaluationServiceContracts.test.ts`
- `src/application/security/tests/EncryptionEnforcementObservabilityPorts.test.ts`

## Contract summary

The application layer now exposes:

- `IEncryptionAtRestPolicyContextResolverPort` for obtaining platform/workspace/storage policy context
- `IEncryptionPolicyEvaluationService` for effective policy evaluation and focused decision queries
- explicit decision contracts:
  - `ContentEncryptionRequirementDecision`
  - `PreviewDecryptionAllowanceDecision`
  - `WorkerDecryptionAllowanceDecision`

These contracts intentionally use business semantics (`contentEncryptionRequired`, `keyScope`, `allowPreviewDecryption`, `allowWorkerDecryption`) so storage/asset/secret/preview orchestration can consume one evaluation path.

## Domain-wiring behavior

`EncryptionPolicyEvaluationService` delegates policy interpretation to `evaluateEncryptionAtRestPolicy(...)` in the domain layer. This keeps:

- mode-strength inheritance and override safeguards
- secret/metadata invariants
- decryption-allowance constraints

in one canonical location while returning application-friendly contracts for caller workflows.

## Developer guidance

When consuming encryption policy decisions in application services:

1. Resolve policy through `IEncryptionPolicyEvaluationService` rather than reading policy records directly.
2. Use `evaluateContentEncryptionRequirement(...)` for storage/object-write planning where only scoped-content requirement and key scope are needed.
3. Use `evaluatePreviewDecryptionAllowance(...)` and `evaluateWorkerDecryptionAllowance(...)` for preview pipeline and worker execution gating.
4. Treat non-`ok` outcomes as fail-closed security decisions; do not attempt permissive fallback behavior.

## Story 11.3.4 observability and audit posture

- `EncryptionPolicyEvaluationService` now emits best-effort structured enforcement diagnostics for:
  - successful effective-policy evaluations
  - rejected invalid requests
  - denied policy-violation outcomes
  - failed context-resolution/internal outcomes
- Emission flows through `IEncryptionEnforcementObservabilityPort` so application use cases remain infrastructure-agnostic.
- Diagnostic payloads are sanitized before publication:
  - key identifiers/references, payload/body/content fields, raw cryptographic metadata, and path-like values are redacted;
  - policy-level outcomes (`resolvedFrom`, `keyScope`, decryption allowances, reason codes) remain visible for operations.
