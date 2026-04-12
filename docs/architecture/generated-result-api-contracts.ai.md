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

## Story 6.3.2 protected preview retrieval contract integration (implemented)

Generated-result preview retrieval now has explicit backend API + HTTP transport contracts aligned with the shared generated-result preview-state model.

- Backend API contract additions in `PublicGeneratedResultManagementApiContract.ts`:
  - `RequestGeneratedResultPreviewApiRequest/Response`
  - `OpenGeneratedResultPreviewContentStreamApiRequest/Response`
- Backend API implementation updates in `GeneratedResultManagementBackendApi.ts` map preview request/open use-case outcomes into stable public API errors.
- Identity transport now serves:
  - `GET /api/v1/generated-results/:resultAssetId/preview`
  - `GET /api/v1/generated-results/:resultAssetId/preview/content`

Contract posture:

- Preview request responses expose stateful availability (`preview-available`, `preview-pending`, `preview-failed`, `preview-unavailable`) with tokenized access metadata only.
- Preview content open requires a preview token and never exposes raw derivative object paths or storage-instance internals.
- Pending/missing/failed preview outcomes remain structured and explicit for gallery/history/detail clients.

## Story 6.3.3 lineage inspection contract integration (implemented)

Generated-result lineage summary/detail retrieval now has concrete backend API + authenticated HTTP transport behavior wired to shared lineage DTO/schema contracts.

- Added backend API request/response shapes in `PublicGeneratedResultManagementApiContract.ts`:
  - `GetGeneratedResultLineageSummaryApiRequest/Response`
  - `GetGeneratedResultLineageDetailApiRequest/Response`
- `GeneratedResultManagementBackendApi` now maps lineage-read use-case failures to stable public errors (`invalid-request`, `forbidden`, `not-found`, `internal`).
- Identity HTTP routes now include:
  - `GET /api/v1/generated-results/:resultAssetId/lineage/summary`
  - `GET /api/v1/generated-results/:resultAssetId/lineage`

Output posture:

- Summary responses stay compact for list/history contexts.
- Detail responses expose source snapshot/version references, execution provenance, upstream input assets, and deterministic graph topology for inspection experiences.
- Contracts remain storage-path-opaque and backend-internal-payload-opaque.

## Story 6.3.4 result reuse metadata and source-selection seams (implemented)

Generated-result list/detail contracts now expose explicit reuse compatibility metadata so prior outputs can participate in future workflow input selection flows as authoritative assets.

### Added reuse metadata on summary/detail contracts

- `reuse.reusableAsWorkflowInput`
- `reuse.logicalAssetReference`
- `reuse.supportedInputPurposes`
- `reuse.assetClasses`
- `reuse.mediaClasses`
- `reuse.sourceContext` (`runId`, `workflowId`, `systemId`, optional `executionNodeId`, `outputSlot`, `inputAssetCount`)

This shape aligns generated-result reuse with the existing workflow binding compatibility dimensions (input purpose, allowed asset classes, allowed media classes) while keeping lineage context inspectable.

### Added reuse/source selection query filters

List contracts now include optional reusable-candidate query seams:

- `lineageInputAssetIds`
- `requiredInputPurposes`
- `requiredAssetClasses`
- `requiredMediaClasses`
- `reuseReadyOnly`

These are intentionally generic and avoid workflow-template hardcoding so future UI/source selectors can expand without asset-model redesign.

## Story 6.4.1 authoritative gallery/history API integration (implemented)

Generated-result management APIs now include authoritative list/get/by-run retrieval for studio gallery and run-history surfaces.

- Added backend API contract request/response shapes:
  - `ListGeneratedResultsApiRequest/Response`
  - `GetGeneratedResultApiRequest/Response`
  - `ListGeneratedResultsByRunApiRequest/Response`
- `GeneratedResultManagementBackendApi` now maps metadata list/get use-case failures to stable public API errors (`invalid-request`, `forbidden`, `not-found`, `internal`).
- Identity transport now serves:
  - `GET /api/v1/generated-results`
  - `GET /api/v1/generated-results/:resultAssetId`
  - `GET /api/v1/image-runs/:runId/generated-results`

This completes authoritative API coverage for production-backed result gallery/history clients while keeping storage/backend internals opaque.
