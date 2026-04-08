# Image Run API and Event Contracts

This note documents Story 4.1.2 (Feature 4 / Epic 4.1): shared DTO and schema contracts for authoritative image-run APIs and run event flows.

## Purpose

Define one stable, transport-safe contract surface for image run submission, lifecycle reads, history listing, progress/failure visibility, cancellation, readiness checks, and event subscription/replay so desktop and thin clients converge on the same authoritative model.

## Canonical implementation seams

- `src/shared/contracts/image-workflows/ImageRunApiContracts.ts`
- `src/shared/schemas/image-workflows/ImageRunApiSchemaContracts.ts`
- `src/shared/dto/image-workflows/ImageRunApiDtos.ts`
- `src/shared/contracts/image-workflows/tests/ImageRunApiContracts.test.ts`
- `src/shared/schemas/image-workflows/tests/ImageRunApiSchemaContracts.test.ts`
- `src/shared/dto/image-workflows/tests/ImageRunApiDtos.test.ts`

## Contract coverage

- Run submission:
  - system-scoped submit request with logical input asset references and optional parameter overrides.
- Run reads:
  - get run detail, get run status snapshot, list run history with state/source filters.
- Run mutation:
  - cancel request/response with idempotency support.
- Execution readiness:
  - backend readiness summary with capability flags and normalized readiness issues.
- Failure/result summaries:
  - normalized failure category/code/retryability/user-safe messaging,
  - result summary with logical output references only (asset ids/metadata).
- Event flow:
  - canonical event envelope for lifecycle, progress, failure, result, and cancellation updates,
  - deterministic replay cursor format (`image-run-event:<sequence>`).

## Boundary and normalization rules

- External contracts are transport-facing and authoritative for UI/API consumers.
- Internal persistence entities remain separate and are not exposed from shared API contracts.
- Raw backend payloads and transport internals are excluded from external DTOs.
- Filesystem path-like references are rejected in logical asset-id fields.
- Progress and failure payloads are structured for user-facing consistency across desktop and thin clients.

## Validation posture

- Schema parsing is strict and rejects unknown/forbidden internal keys (`rawGraph`, backend transport payload keys, filesystem-path keys).
- Cursor semantics are validated against sequence (`image-run-event:<sequence>` must match envelope sequence).
- Logical references are enforced in submission/result asset fields.

## Related architecture notes

- `docs/architecture/image-workflow-system-api-contracts.md`
- `docs/architecture/run-orchestration-transport-contracts.md`
- `docs/architecture/run-orchestration-realtime-event-publication.md`
- `docs/architecture/image-manipulation-execution-status-contracts.md`

