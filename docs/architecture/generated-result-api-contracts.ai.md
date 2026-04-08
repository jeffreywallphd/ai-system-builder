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

## Boundary posture
- External transport contracts are separated from persistence records (`GeneratedResultPersistenceDtos`).
- DTO adapters project immutable response envelopes for API-facing payloads.
- Schema parsers enforce strict shape and invariants for converged client/server usage.
