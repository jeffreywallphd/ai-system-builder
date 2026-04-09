# AI Companion: Generated Result API DTO and Schema Contracts

## Story scope
Story 6.1.4 defines shared DTO and schema contracts for authoritative generated-result APIs so desktop and thin clients can browse results, request preview-safe content, retrieve protected originals, and inspect lineage without backend/storage leakage.

## Canonical files
- `src/shared/contracts/assets/GeneratedResultTransportContracts.ts`
- `src/shared/dto/assets/GeneratedResultTransportDtos.ts`
- `src/shared/dto/assets/GeneratedResultPersistenceDtos.ts`
- `src/shared/schemas/assets/GeneratedResultTransportSchemaContracts.ts`
- `src/shared/contracts/assets/tests/GeneratedResultTransportContracts.test.ts`
- `src/shared/dto/assets/tests/GeneratedResultTransportDtos.test.ts`
- `src/shared/dto/assets/tests/GeneratedResultPersistenceDtos.test.ts`
- `src/shared/schemas/assets/tests/GeneratedResultTransportSchemaContracts.test.ts`
- `docs/architecture/generated-result-api-contracts.md`

## Related posture note
- Story 6.1.5 authoritative persistence/preview/lineage posture: `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`

## External API coverage
- Result list/get:
  - `listResults`
  - `getResult`
  - `listResultsByRun`
- Preview request/response metadata:
  - preview descriptor availability/state
  - protected preview handle metadata (no storage paths)
- Protected original retrieval metadata:
  - purpose-scoped access metadata
  - protected-resource/access-handle responses with expiry
- Lineage responses:
  - summary for gallery/history context
  - detail for deeper run/workflow/system/node/input inspection

## Safety and normalization posture
- External contracts carry logical ids and protected handles only.
- Raw backend payload keys and filesystem-like references are schema-rejected.
- `storage-instance://` internals are kept out of preview/original access handles.
- Result lifecycle and preview availability metadata are represented as normalized status contracts, not backend-specific adapter state.

## Story 8.2.4 hardening additions (implemented)

Transport contracts now encode explicit preview/retrieval degraded states so API and UI consumers can reliably distinguish delayed derivatives, failed preview generation, and retrieval outages.

### Added state enums

- `GeneratedResultPreviewStates`
  - `preview-pending`
  - `preview-available`
  - `preview-failed`
  - `preview-unavailable`
- `GeneratedResultRetrievalStates`
  - `retrieval-available`
  - `retrieval-temporarily-unavailable`
  - `retrieval-unavailable`
  - `result-unavailable`

### DTO contract changes

- `GeneratedResultSummaryDto.preview.state` is now required.
- `GeneratedResultSummaryDto.retrieval` is now required with `state` and optional `reasonCode`/`retryable`.
- `RequestGeneratedResultPreviewResponseDto.preview.state` is required.
- `RequestGeneratedResultOriginalAccessResponseDto.original.state` is required with optional recovery hints (`reasonCode`, `retryable`).

### Schema-level invariants

- `preview-available` must align with available preview presence.
- `preview-pending`/`preview-failed` cannot indicate available derivative status.
- unavailable retrieval states require `reasonCode`.
- schema parsing keeps strict-shape enforcement and emits `GeneratedResultTransportSchemaValidationError` for diagnosable client/server contract failures.

## Boundary posture
- External transport contracts are separated from persistence records (`GeneratedResultPersistenceDtos`).
- DTO adapters project immutable response envelopes for API-facing payloads.
- Schema parsers enforce strict shape and invariants for converged client/server usage.

## Story 6.2.3 retrieval handler baseline (implemented)

Protected generated-result original retrieval now has concrete backend + HTTP transport seams consistent with this contract posture:

- backend API contract: `src/infrastructure/api/generated-results/sdk/PublicGeneratedResultManagementApiContract.ts`
  - `OpenGeneratedResultOriginalContentStreamApiRequest`
  - `OpenGeneratedResultOriginalContentStreamApiResponse`
  - stable public errors: `invalid-request`, `forbidden`, `not-found`, `invalid-state`, `internal`
- backend implementation: `src/infrastructure/api/generated-results/GeneratedResultManagementBackendApi.ts`
  - maps use-case retrieval failures into stable API error semantics
- identity route: `GET /api/v1/generated-results/:resultAssetId/original`
  - authenticated workspace-session mediation
  - stream mediation without storage/backend path leakage
  - hardened response headers (`attachment`, `nosniff`, `private, no-store`)

## Story 6.2.4 query/list use-case baseline (implemented)

Authoritative generated-result discovery now has concrete application use cases for result-by-id and gallery/history list retrieval:

- `src/application/generated-results/use-cases/GetGeneratedResultMetadataUseCase.ts`
- `src/application/generated-results/use-cases/ListGeneratedResultMetadataUseCase.ts`

List filters cover workspace/owner/source lineage axes (`runId/systemId/workflowId/workflowTemplateId/executionNodeId`), status/visibility/media-type windows, recent activity windows, and preview availability state filters (`previewStates`, `hasPreview`).

Projected responses now include DTO-ready preview/retrieval availability hints and lineage-summary/run linkage metadata derived from authoritative persisted records + preview/lineage repositories.
