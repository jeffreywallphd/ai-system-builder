# Generated Result API DTO and Schema Contracts

## Story scope
Story 6.1.4 defines shared DTO and schema contracts for authoritative generated-result APIs so desktop and thin clients can browse results, request preview-safe content, retrieve protected originals, and inspect lineage without backend or storage leakage.

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

Generated-result transport contracts now expose explicit preview and retrieval availability states for degraded and recovery-aware behavior.

### New explicit state contracts

- `GeneratedResultPreviewStates`:
  - `preview-pending`
  - `preview-available`
  - `preview-failed`
  - `preview-unavailable`
- `GeneratedResultRetrievalStates`:
  - `retrieval-available`
  - `retrieval-temporarily-unavailable`
  - `retrieval-unavailable`
  - `result-unavailable`

### DTO surface updates

- `GeneratedResultSummaryDto.preview` now requires `state` in addition to `hasPreview`.
- `GeneratedResultSummaryDto` now requires a `retrieval` object with explicit state and optional recovery hints (`reasonCode`, `retryable`).
- `RequestGeneratedResultPreviewResponseDto.preview` now requires `state`.
- `RequestGeneratedResultOriginalAccessResponseDto.original` now requires `state`, with optional `reasonCode` and `retryable`.

### Schema hardening invariants

- `preview-available` requires preview availability (`hasPreview=true` or `available=true` as applicable).
- `preview-pending` and `preview-failed` cannot advertise available derivative status.
- Retrieval states `retrieval-temporarily-unavailable`, `retrieval-unavailable`, and `result-unavailable` require `reasonCode`.
- Validation failures continue to throw `GeneratedResultTransportSchemaValidationError` with path-specific issues to improve diagnostics.

## Boundary posture
- External transport contracts are separated from persistence records (`GeneratedResultPersistenceDtos`).
- DTO adapters project immutable response envelopes for API-facing payloads.
- Schema parsers enforce strict shape and invariants for converged client/server usage.

## Story 6.2.3 retrieval handler baseline (implemented)

Protected generated-result original retrieval now has a concrete API/transport implementation aligned to this contract posture:

- Backend API contract: `src/infrastructure/api/generated-results/sdk/PublicGeneratedResultManagementApiContract.ts`
  - `OpenGeneratedResultOriginalContentStreamApiRequest`
  - `OpenGeneratedResultOriginalContentStreamApiResponse`
  - stable API error envelope (`invalid-request`, `forbidden`, `not-found`, `invalid-state`, `internal`)
- Backend handler: `src/infrastructure/api/generated-results/GeneratedResultManagementBackendApi.ts`
  - maps application-layer original-content retrieval outcomes into stable API error semantics
- Identity HTTP transport route: `GET /api/v1/generated-results/:resultAssetId/original`
  - authenticated workspace session mediation
  - protected stream forwarding without raw storage/backend path exposure
  - retrieval-safe headers (`content-disposition` attachment, `x-content-type-options: nosniff`, `cache-control: private, no-store`)

## Story 6.2.4 query/list use-case baseline (implemented)

Application query/list use cases now project authoritative generated-result metadata suitable for gallery and run-history APIs:

- `GetGeneratedResultMetadataUseCase` for result-by-id metadata retrieval.
- `ListGeneratedResultMetadataUseCase` for paged metadata discovery.

Supported listing filters include workspace/owner/source linkage (`runId/systemId/workflowId/workflowTemplateId/executionNodeId`), lifecycle + visibility, created/updated activity windows, and preview availability (`previewStates`, `hasPreview`).

Response projection includes DTO-ready preview state hints, retrieval state hints, and lineage summary/run linkage metadata sourced from persisted generated-result records and lineage/previews repositories.

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

Generated-result lineage summary/detail retrieval now has concrete backend API and identity transport handlers aligned to existing shared lineage DTO/schema contracts.

- Backend API contract additions in `PublicGeneratedResultManagementApiContract.ts`:
  - `GetGeneratedResultLineageSummaryApiRequest/Response`
  - `GetGeneratedResultLineageDetailApiRequest/Response`
- Backend API implementation (`GeneratedResultManagementBackendApi.ts`) now maps lineage read use-case outcomes into stable public errors:
  - `invalid-request`
  - `forbidden`
  - `not-found`
  - `internal`
- Identity transport now serves:
  - `GET /api/v1/generated-results/:resultAssetId/lineage/summary`
  - `GET /api/v1/generated-results/:resultAssetId/lineage`

Contract posture:

- Summary responses provide lightweight provenance for gallery/history cards.
- Detail responses provide run/workflow/system/node/source snapshot context plus upstream inputs and deterministic lineage graph projection for inspection UIs.
- Lineage response payloads remain logical-id based and avoid backend/storage internals.

## Story 6.3.4 result reuse metadata and source-selection seams (implemented)

Generated-result list/detail contracts now include explicit reuse compatibility metadata so prior outputs can be selected as authoritative workflow inputs without introducing a parallel asset model.

### Reuse metadata added to result summary/detail contracts

- `reuse.reusableAsWorkflowInput`
- `reuse.logicalAssetReference`
- `reuse.supportedInputPurposes`
- `reuse.assetClasses`
- `reuse.mediaClasses`
- `reuse.sourceContext` (`runId`, `workflowId`, `systemId`, optional `executionNodeId`, `outputSlot`, `inputAssetCount`)

This keeps reuse selection aligned with existing workflow binding compatibility dimensions (purpose, asset class, media class) while preserving lineage-aware context in list/detail flows.

### Reuse-oriented list query seams

List query contracts now include optional filters for reuse/source selection:

- `lineageInputAssetIds`
- `requiredInputPurposes`
- `requiredAssetClasses`
- `requiredMediaClasses`
- `reuseReadyOnly`

These filters are generic and workflow-binding compatible, so clients can request candidates for different image workflow slots without hardcoding one workflow template.
