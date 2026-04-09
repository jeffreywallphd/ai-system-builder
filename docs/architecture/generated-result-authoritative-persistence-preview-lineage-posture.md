# Generated Result Authoritative Persistence, Preview, and Lineage Posture

## Story scope

Story 6.1.5 documents the authoritative posture for turning image-manipulation execution outputs into first-class AI Loom assets instead of backend-local files or UI-local artifacts.

This note is the seam contract for follow-on gallery/history, sharing, export, and admin work.

## Canonical implementation seams in this slice

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/GeneratedResultAssetDerivativeDomain.ts`
- `src/shared/contracts/assets/GeneratedResultTransportContracts.ts`
- `src/shared/schemas/assets/GeneratedResultTransportSchemaContracts.ts`
- `src/shared/dto/assets/GeneratedResultPersistenceDtos.ts`

## Authoritative resource posture

Generated outputs are authoritative only after they are represented as a `GeneratedResultAsset` with:

- canonical logical result identity (`resultAssetId`)
- workspace/ownership and visibility posture
- durable lineage pointers back to run/system/workflow/execution-node and input assets
- storage instance linkage (`storageInstanceId`, optional logical `storageBindingReference`)
- lifecycle status progression from collection -> persistence -> preview readiness

Backend output discovery handles from execution adapters are operational handoff metadata, not authoritative asset identity.

## Preview-safe retrieval posture

Preview access is modeled as derivative descriptors bound to `resultAssetId` (and optional result logical asset version), not as separate ad-hoc assets.

Preview retrieval contracts must:

- expose protected logical handles (`protectedResourceId`, `accessHandle`)
- avoid leaking filesystem paths or storage topology
- keep pending/failed preview states explicit without access handles
- preserve preview kinds (`thumbnail`, `display-safe`, `history-safe`) for gallery/history-safe rendering

Original-result retrieval remains a separate protected-access flow with explicit purpose and expiry metadata.

## Lineage posture

Lineage is explicit and queryable without duplicating canonical records from other domains:

- source pointers: `runId`, `systemId`, `workflowId`, optional `workflowTemplateId`, optional `executionNodeId`, `outputSlot`
- immutable provenance references: workflow-template version, system snapshot/version tag, parameter snapshot, selected node, adapter/backend family
- upstream source assets: `lineage.inputAssetIds`

Lineage records relationships and snapshot references needed for audit/history/reuse, while run/workflow/system domains remain authoritative for full state.

## Layer responsibilities and boundaries

`Domain + shared contract layers` own:

- generated-result aggregate and derivative invariants
- lifecycle legality and lineage integrity rules
- external API DTO/schema contracts
- persistence DTO shape for adapter-facing records

`Application layer` (follow-on stories) should own:

- authoritative orchestration of result collection/finalization
- policy-checked preview/original access mediation
- read/query use cases for list/get/by-run and lineage endpoints

`Infrastructure + host composition` (follow-on stories) should own:

- repository/storage adapter implementations
- protected-access handle minting/opening
- preview generation/materialization pipelines
- wiring generated-result services into server host composition

## Non-goals in this story

- no generated-result repository implementation
- no generated-result backend API handler implementation
- no preview generation worker implementation
- no UI gallery/history integration

## Dependencies and references (Features 1-5)

- Feature 1 image asset authority and protected retrieval: `docs/architecture/image-asset-feature-1-final-baseline.md`
- Feature 2 workflow/system authority and persistence: `docs/architecture/image-workflow-system-persistence-and-repositories.md`
- Feature 3 execution adapter output-discovery boundaries: `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- Feature 4 authoritative run lifecycle and output-handoff posture: `docs/architecture/image-run-feature-4-final-baseline.md`
- Feature 5 execution-node routing/readiness context: `docs/architecture/image-manipulation-node-based-execution-posture.md`
- Feature 6 domain/contracts foundations: `docs/architecture/generated-result-asset-domain-foundation.md`, `docs/architecture/generated-result-api-contracts.md`

## Follow-on implementation checklist

- Keep generated-result identity and lineage logical-id based across transport/storage boundaries.
- Keep preview access authorization-centered and storage-path-opaque.
- Keep storage adapters and preview pipelines replaceable behind typed ports.
- Keep run/workflow/system/input lineage pointers immutable once a result becomes durable.

## Story 6.2.1 handoff baseline (implemented)

Result-collection handoff from terminal run finalization into authoritative persistence is now explicit in the run application layer:

- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts` parses `ImageManipulationCollectedExecutionResult` handoff metadata from run execution diagnostics and invokes a dedicated persistence port.
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts` defines `IRunCollectedResultPersistencePort` and typed request/result contracts for run-scoped result persistence orchestration.
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts` wires the handoff dependency into terminal finalization flow so completed/cancelled/failed updates can trigger persistence.

Failure posture in this story is explicit and safe:

- persistence-port exceptions do not roll back run terminalization
- finalization output availability/quality degrade explicitly when persistence fails
- persistence diagnostics are captured under run metadata (`executionTelemetry.finalizationInternal.resultPersistenceDiagnostics`) for audit and follow-on recovery logic

This story intentionally leaves concrete adapter/storage-copy implementation behind the new port seam so Feature 6 follow-ons can add provider-specific materialization without changing run orchestration contracts.

## Story 6.2.2 concrete persistence baseline (implemented)

Generated result persistence is now concretely implemented in authoritative SQLite infrastructure with durable result, preview, and lineage records:

- `src/infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceMigrations.ts`
- `src/infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceAdapter.ts`
- `src/infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter.ts`
- `src/application/generated-results/ports/IGeneratedResultPersistenceRepository.ts`

### Persistence structure

- `generated_result_records`: authoritative result asset metadata (run/system/workflow/node linkage, status lifecycle, storage linkage, visibility posture, timestamps, revision/schema metadata).
- `generated_result_lineage_inputs`: normalized upstream input asset/linkage pointers per result asset.
- `generated_result_previews`: preview descriptor persistence bound to `result_asset_id` with availability and protected-access metadata.
- `generated_result_mutation_replays` + `generated_result_preview_mutation_replays`: idempotent mutation replay safety using operation keys.

### Migration impact

- New migration domain id: `generated-results`.
- New migration table: `generated_result_repository_migrations`.
- Migration registration is wired through `createAuthoritativePersistenceMigrationHooks` and `createAuthoritativePersistentPlatformServices`, so startup applies generated-result schema alongside existing authoritative domains.

### Runtime wiring impact

- `SqliteRunCollectedResultPersistenceAdapter` now backs `IRunCollectedResultPersistencePort` in server host composition for:
  - run execution terminal ingestion (`IngestRunExecutionUpdateUseCase`)
  - run cancellation terminal finalization (`RequestAuthoritativeRunCancellationUseCase`)
  - startup recovery finalization paths (`RecoverRunOrchestrationStartupStateUseCase`)

This establishes durable, queryable generated-result asset + lineage records as the authoritative source of truth for follow-on history, reuse, preview, and audit experiences.

## Story 8.2.4 resilience hardening baseline (implemented)

Result collection and preview provisioning are now hardened so degraded storage or derivative failures produce explicit, durable states instead of ambiguous terminal outcomes.

### Collection + preview failure handling posture

- `SqliteRunCollectedResultPersistenceAdapter` now persists records per output with isolated failure handling, so a single storage write failure does not terminate persistence for other outputs.
- Storage write failures are normalized through the shared image-manipulation failure taxonomy + retry/recovery contracts, and the adapter attempts a durable fallback `failed-collection` result record.
- Successful result persistence now seeds a pending preview descriptor (`generated_result_previews`, `availability_status=pending`) so delayed preview generation is explicit and queryable.
- Preview persistence failures are normalized through taxonomy/recovery contracts and persisted as explicit failed preview descriptors when possible (`availability_status=failed` + failure code/message).
- Adapter diagnostics now include per-record failure classification/recovery metadata and counters for preview pending/failed/unavailable and temporary storage unavailability.

### Authoritative state coherence guarantees

- Result lifecycle authority remains in result records (`generated_result_records`) even when preview provisioning fails.
- Preview derivative failure does not silently erase result availability: authoritative result records stay available while derivative state reflects pending/failed conditions.
- Fallback `failed-collection` records preserve lineage pointers and source linkage posture when operational failures prevent full persistence.
- Terminal orchestration hints (`outputAvailabilityHint`, `terminalQualityHint`) now degrade explicitly when persistence or preview provisioning is partial/degraded.

### Recovery and diagnosability posture

- Retryability for storage/preview write failures is captured from taxonomy-derived recovery contracts in internal diagnostics.
- Temporary availability issues are counted separately from terminal failures to support operational triage and delayed-recovery flows.
- Result persistence remains non-blocking for run terminalization while preserving explicit recovery signals for follow-on reprocessing.

## Story 6.2.3 protected original retrieval baseline (implemented)

Protected original-content retrieval for generated-result assets is now implemented as a server-mediated authoritative flow:

- `src/application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase.ts` enforces request validation, workspace membership checks, workspace-scoped existence checks, private-visibility ownership rules, retrievable lifecycle checks, and media-type presence before opening any stream.
- Storage access is resolved through `IStorageLogicalAccessResolutionService` + `IStorageObjectPort` using logical references (`storageBindingReference` / `logicalAssetVersionId`) and never exposing raw backend-local paths.
- `src/infrastructure/api/generated-results/GeneratedResultManagementBackendApi.ts` maps use-case outcomes into stable API error semantics (`invalid-request`, `forbidden`, `not-found`, `invalid-state`, `internal`).
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` adds `GET /api/v1/generated-results/:resultAssetId/original` under authenticated workspace session mediation, streaming bytes with controlled headers:
  - `content-type`
  - `content-length`
  - `content-disposition` (`attachment`)
  - `x-content-type-options: nosniff`
  - `cache-control: private, no-store`

This keeps retrieval policy-gated, storage-abstracted, and non-guessable while preserving compatibility with future protected-handle export/share policy flows.

## Story 6.2.4 result query and listing baseline (implemented)

Generated-result discovery now has authoritative metadata query/list use cases for gallery and run-history surfaces:

- `src/application/generated-results/use-cases/GetGeneratedResultMetadataUseCase.ts`
- `src/application/generated-results/use-cases/ListGeneratedResultMetadataUseCase.ts`
- `src/application/generated-results/use-cases/GeneratedResultMetadataReadUseCaseContracts.ts`

### Query/list behavior

- `get` returns a single generated result by `resultAssetId` and `workspaceId` from persisted authoritative metadata.
- `list` returns paged generated-result summaries from the same authoritative persistence records.
- Supported filter dimensions in use-case contracts:
  - workspace + actor scope
  - owner (`ownerUserIds`)
  - source linkage (`runId`, `systemId`, `workflowId`, `workflowTemplateId`, `executionNodeId`)
  - lifecycle/visibility (`statuses`, `visibilities`, `includeArchived`)
  - recent activity windows (`createdAfter/Before`, `updatedAfter/Before`)
  - preview availability (`previewStates`, `hasPreview`)

### Authorization posture

- Both use cases require active workspace membership.
- Private results are owner/admin constrained with safe not-found behavior for non-authorized users.
- Listing applies visibility checks per record before projecting paged response items.

### DTO-ready metadata posture

- Responses include preview availability hints (`preview.state`, `hasPreview`, optional primary preview metadata).
- Responses include retrieval availability hints (`retrieval.state` + optional reason/retryability).
- Responses include lineage summary hints and run linkage (`runId/systemId/workflowId/outputSlot`, plus snapshot/version presence booleans).
- Detail response adds persisted lifecycle metadata, preview descriptors, and lineage detail pointers (input assets + snapshot/execution refs).

## Story 6.2.5 result availability and collection-failure state handling (implemented)

Run finalization now persists an explicit result-availability state so API/UI consumers can distinguish no-result-yet, preview-delayed, partial-persistence, and collection-failure outcomes without inferring from ambiguous hints.

### Finalization state contract

- `RunResultSummary`/`RunResultRegistrationInput` now include `resultAvailabilityState`.
- Canonical states:
  - `pending-result`
  - `partially-collected`
  - `available`
  - `preview-pending`
  - `failed-collection`

### Finalization orchestration behavior

- `FinalizeRunExecutionOutcomeUseCase` derives `resultAvailabilityState` from `IRunCollectedResultPersistencePort` outcomes and diagnostics:
  - persistence `failed` -> `failed-collection`
  - persistence `partially-persisted` -> `partially-collected`
  - persistence `persisted` + pending preview diagnostics -> `preview-pending`
  - persistence `persisted` + persisted outputs -> `available`
  - no persisted outputs yet -> `pending-result`
- Derived state is written into durable finalization metadata alongside existing output availability/terminal quality hints.

### API/query clarity posture

- Run detail/status projections now carry durable finalization `resultAvailabilityState` through transport contracts and schema validation.
- Consumers can explicitly differentiate:
  - no result yet (`pending-result`)
  - result exists but preview pending (`preview-pending`)
  - result collection failed (`failed-collection`)

### Retry/recovery assumptions

- Run terminalization remains non-blocking even when collection/persistence fails.
- Recovery is modeled as follow-on retry/recovery over explicit durable states, not implicit retries hidden inside terminal finalization.
- Partial states are intentionally retained for operator triage and future reprocessing orchestration.

## Story 6.3.1 preview-generation pipeline baseline (implemented)

Generated-result preview generation now has a concrete platform-service pipeline that materializes protected preview derivatives from authoritative result assets.

- Application use case: `src/application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCase.ts`
- Preview generation ports: `src/application/generated-results/ports/GeneratedResultPreviewGenerationPorts.ts`
- Logical storage-reference resolver reused by retrieval + generation:
  - `src/application/generated-results/use-cases/GeneratedResultStorageObjectReference.ts`
  - `src/application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase.ts`
- Infrastructure media adapters:
  - `src/infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor.ts`
  - `src/infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort.ts`

### Generation flow posture

- Source lookup uses logical result references (`storageBindingReference` / `logicalAssetVersionId`) and validates storage-instance alignment.
- Source reads and derivative writes are mediated through `IStorageLogicalAccessResolutionService` + `IStorageObjectPort` intents (`openObjectReadStream`, `createObjectKey`, `writeObject`).
- The default derivative profile for this image slice is `display-safe` (`image/webp`) with bounded dimensions/quality, while preview-kind profiles remain explicit and extensible (`thumbnail`, `display-safe`, `history-safe`).
- Preview descriptor persistence writes protected-access metadata (`protectedResourceId`, `accessHandle`) and never emits raw storage paths outside infrastructure.
- Successful generation upgrades result lifecycle from `available` to `preview-ready` when appropriate.
- Generation failures persist explicit failed preview descriptors (`availabilityStatus=failed`) for diagnosable retry/recovery state.

### Run finalization integration posture

- `SqliteRunCollectedResultPersistenceAdapter` now accepts an optional preview-generation use case dependency.
- Authoritative server host composition wires this dependency so persisted run outputs can generate protected previews during result finalization when possible.
- If no generator dependency is provided, existing pending-preview fallback behavior remains unchanged.

### Extension seams

- Preview dimensions/media profile mapping is centralized in the generation use case for future derivative expansion.
- Access-handle minting is ported (`IGeneratedResultPreviewAccessPort`) so future policy-aware, expiring, or revocation-capable handle systems can replace tokenization without changing use-case contracts.
- Image transformation remains ported (`IGeneratedResultPreviewImageProcessorPort`) so alternate media processors/backends can be introduced without altering orchestration logic.

## Story 6.3.2 protected preview retrieval APIs and services (implemented)

Generated-result previews now have authenticated request/open retrieval flows consistent with the protected-preview posture.

- New application use cases:
  - `RequestGeneratedResultPreviewContentUseCase`
  - `OpenGeneratedResultPreviewContentUseCase`
  - `GetGeneratedResultPreviewContentUseCaseContracts`
- New generated-result backend API handlers:
  - `requestGeneratedResultPreview`
  - `openGeneratedResultPreviewContentStream`
- New identity HTTP routes:
  - `GET /api/v1/generated-results/:resultAssetId/preview`
  - `GET /api/v1/generated-results/:resultAssetId/preview/content`

### Retrieval behavior

- Preview request flow enforces active workspace membership and private-visibility owner/admin checks before exposing preview access metadata.
- Preview-open flow requires a tokenized preview handle and revalidates workspace/result linkage before opening storage reads.
- Preview reads are streamed through authoritative server mediation with `inline` disposition, `nosniff`, and `private, no-store` headers.

### Preview availability states

- Request responses now surface explicit preview states for client safety and UX clarity:
  - `preview-available`
  - `preview-pending`
  - `preview-failed`
  - `preview-unavailable`
- Pending/missing/failed conditions are returned as structured responses without leaking raw storage object layout.
- Stale/invalid preview tokens return explicit invalid-state failures requiring a new preview request.

## Story 6.3.3 lineage retrieval and inspection use cases (implemented)

Generated-result lineage retrieval is now implemented as dedicated application use cases and authenticated API routes so result provenance can be inspected without backend-internal coupling.

- Application use cases:
  - `GetGeneratedResultLineageSummaryUseCase`
  - `GetGeneratedResultLineageDetailUseCase`
  - `GeneratedResultLineageReadUseCaseContracts`
- Projection helper:
  - `GeneratedResultLineageProjection`
- Backend and transport wiring:
  - `GeneratedResultManagementBackendApi` lineage handlers
  - `GET /api/v1/generated-results/:resultAssetId/lineage/summary`
  - `GET /api/v1/generated-results/:resultAssetId/lineage`

### Retrieval posture

- Authorization mirrors existing generated-result visibility rules: active workspace membership is required and private results are owner/admin-gated with safe not-found behavior.
- Lineage responses are assembled from authoritative generated-result persistence records (`generated_result_records` + lineage pointers), not backend execution adapter internals.
- When dedicated lineage records are absent, lineage projection safely falls back to canonical persisted result metadata fields.

### Inspection output shape

- Summary output exposes run/workflow/system/node linkage plus explainability booleans (`hasWorkflowTemplateVersion`, `hasSystemSnapshot`, `hasParameterSnapshot`, `hasSelectedNode`) and `inputAssetCount`.
- Detail output adds:
  - immutable source snapshot references (workflow template version/tag, system snapshot/version tag, parameter snapshot),
  - execution provenance (selected node, adapter kind, backend family),
  - upstream input asset ids,
  - deterministic lineage graph nodes/edges connecting result, run, workflow, system, optional execution node, and input assets.

This establishes a stable lineage-inspection contract for future result detail panes, reuse flows, debugging tooling, and governance/admin review surfaces.

