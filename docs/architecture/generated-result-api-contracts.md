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
