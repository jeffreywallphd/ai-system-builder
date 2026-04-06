# AI Companion: Encryption-at-Rest Policy Application Evaluation Ports

## Purpose

Story 11.1.3 baseline for Feature 11 / Epic 11.1: centralize application-level encryption policy interpretation behind reusable service contracts before persistence and crypto adapters are wired.

## Canonical files

- `src/application/security/ports/EncryptionAtRestPolicyEvaluationPorts.ts`
- `src/application/security/use-cases/EncryptionPolicyEvaluationServiceContracts.ts`
- `src/application/security/use-cases/EncryptionPolicyEvaluationService.ts`
- `src/application/security/tests/EncryptionPolicyEvaluationService.test.ts`
- `src/application/security/tests/EncryptionPolicyEvaluationServiceContracts.test.ts`
- `docs/architecture/encryption-at-rest-policy-application-evaluation-ports.md`

## Added application seams

- policy-context resolver port:
  - `IEncryptionAtRestPolicyContextResolverPort`
- evaluation service contract:
  - `IEncryptionPolicyEvaluationService`
- focused decision responses for:
  - content encryption requirement (+ key scope)
  - preview decryption allowance
  - worker decryption allowance

## Boundary guidance

Keep in this application slice:

- request/response models that express business decisions for storage/assets/secrets/previews/workers
- orchestration-level error semantics (`invalidRequest`, `resolutionFailed`, `policyViolation`)
- calls into canonical domain policy evaluator

Keep out of this slice:

- repository implementations for policy context loading
- cryptographic key/material handling
- transport/API handler wiring
