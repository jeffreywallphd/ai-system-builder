# AI Companion: Run Submission Readiness and Blocking Validation Service

## Story scope
Story 4.2.2 adds a reusable application-layer readiness service that evaluates queue-admission preconditions for image runs and blocks invalid submissions before authoritative queue admission.

## Canonical files
- `src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts`
- `src/application/image-workflows/ImageRunSubmissionReadinessContracts.ts`
- `src/application/runs/use-cases/SubmitImageRunUseCase.ts`
- `src/application/image-workflows/ports/ImageRunOrchestrationPorts.ts`
- `src/hosts/server/IdentityServerHost.ts`
- `src/application/image-workflows/tests/ImageRunSubmissionReadinessValidationService.test.ts`
- `docs/architecture/run-submission-readiness-blocking-validation.md`

## Coverage summary
- Validates system/workflow existence, runnable/active posture, completeness, and binding compatibility.
- Validates required asset-slot completeness plus referenced-asset existence, lifecycle, workspace scope, and policy-denial posture.
- Validates submission parameter values against workflow parameter contracts (unknown/missing/invalid checks).
- Integrates backend execution-readiness checks and maps capability/dependency failures into blocking or advisory readiness issues.
- Produces structured readiness sections and normalized issue taxonomy for both API and studio consumption.

## Queue-admission posture
- `SubmitImageRunUseCase` now consumes readiness findings before authoritative run creation.
- Blocking readiness findings deny submission (`policy-ineligible`) and prevent queue entry.
- Advisory findings remain non-blocking and are returned as submission warnings.

## Boundary guardrails
- Readiness logic is centralized in application layer; no duplicate readiness policy in transport/UI.
- Service remains adapter-neutral and reusable through orchestration ports.
- Validation output is durable and machine-readable for future scheduling/node-assignment policy integration.
