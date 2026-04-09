# AI Companion: Run Submission Contributor Guide

## Purpose
Quick extension workflow for contributors adding new run-submission backends/policies without bypassing authoritative lifecycle boundaries.

## Human doc
- `docs/run-submission-contributor-guide.md`
- `docs/architecture/image-run-feature-4-final-baseline.md`
- `docs/architecture/image-manipulation-feature-8-cross-feature-operational-guidance.md`

## Required workflow
- Update shared run transport contracts/schemas first.
- Extend validation and canonical command behavior in run application use cases (`ValidateRunSubmissionUseCase`, `ImageRunSubmissionReadinessValidationService`, `SubmitImageRunUseCase`).
- Keep authoritative creation/persistence in `CreateAuthoritativeRunUseCase` + mapper + persistence ports.
- Wire infrastructure adapters and route-family composition only after inner-layer behavior is correct.

## Extension seams
- Backend availability/eligibility: `IRunSubmissionTargetResolverPort` and infrastructure resolver adapters.
- Policy additions: `ValidateRunSubmissionUseCase` and policy/evaluator ports.
- Submission-readiness checks: `ImageRunSubmissionReadinessValidationService` (workflow/system validity, asset-slot completeness, parameter validity, policy denials, backend dependencies).
- Submission orchestration for image runs: `SubmitImageRunUseCase` (validation + readiness + authoritative creation response shaping).
- Run kind mapping changes: `RunCreationPersistenceMapper`.
- Dispatch/scheduling follow-up: application orchestration services over ports after authoritative acceptance.

## Prohibited patterns
- Bypassing authoritative run creation is prohibited.
- Embedding orchestration business rules directly inside UI or transport handlers is prohibited.
- Direct run persistence writes from transport/UI layers are prohibited.
- Ad-hoc run payload parsing outside shared schema contracts is prohibited.
- Route-local degraded/outage fallback classification that bypasses shared resilience/recovery contracts is prohibited.
