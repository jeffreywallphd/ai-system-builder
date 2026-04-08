# AI Companion: Image Run API and Event Contracts

## Story scope
Story 4.1.2 and Story 4.1.4 define shared DTO/schema contracts for authoritative image-run APIs, event publication/replay semantics, and submission-readiness outcomes.

## Canonical files
- `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
- `src/shared/schemas/image-workflows/ImageRunApiSchemaContracts.ts`
- `src/shared/dto/image-workflows/ImageRunApiDtos.ts`
- `src/shared/contracts/image-workflows/tests/ImageRunApiContracts.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageRunApiSchemaContracts.test.ts`
- `src/shared/dto/image-workflows/tests/ImageRunApiDtos.test.ts`
- `docs/architecture/image-run-api-event-contracts.md`

## Coverage summary
- Submit/get/list/cancel contracts for image runs.
- Run status and progress snapshots with normalized structure.
- Readiness contracts for execution capability posture.
- Submission-readiness contracts with blocking/advisory outcomes and typed policy/asset/definition/backend/compatibility findings.
- Failure/result summaries with user-safe semantics and logical output references.
- Event envelope contracts for lifecycle/progress/failure/result/cancellation updates.
- Cursor semantics for replay-safe event consumption (`image-run-event:<sequence>`).

## Boundary posture
- Desktop and thin clients consume the same authoritative contracts.
- External contracts are separated from persistence/internal models.
- Schemas reject leaked backend internals and filesystem-like reference leakage.
- Failure semantics remain normalized and backend-neutral for user-facing surfaces.

