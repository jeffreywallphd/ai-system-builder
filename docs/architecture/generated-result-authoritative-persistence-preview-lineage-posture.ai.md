# AI Companion: Generated Result Authoritative Persistence, Preview, and Lineage Posture

## Story scope

Story 6.1.5 captures the authoritative architecture posture for generated image results in the image-manipulation slice: execution outputs must become first-class AI Loom resources rather than backend-local files or UI-local artifacts.

## Canonical seams in this slice

- `src/domain/image-assets/GeneratedResultAssetDomain.ts`
- `src/domain/image-assets/GeneratedResultAssetDerivativeDomain.ts`
- `src/shared/contracts/assets/GeneratedResultTransportContracts.ts`
- `src/shared/schemas/assets/GeneratedResultTransportSchemaContracts.ts`
- `src/shared/dto/assets/GeneratedResultPersistenceDtos.ts`
- `docs/architecture/generated-result-authoritative-persistence-preview-lineage-posture.md`

## Authoritative result posture

A generated output is authoritative only when represented as `GeneratedResultAsset` domain state with:

- canonical logical result identity (`resultAssetId`)
- workspace/owner visibility posture
- lineage pointers to run/system/workflow/output-slot and upstream input assets
- storage-instance linkage (`storageInstanceId`, optional logical `storageBindingReference`)
- lifecycle progression (`pending-collection`, `available`, `preview-ready`, `failed-collection`, `archived`)

Provider/backend output references from execution adapters are transitional handoff metadata, not canonical persisted identity.

## Preview-safe posture

Previews are modeled as derivative descriptors mapped to the result asset:

- preview descriptors stay bound to `resultAssetId` (and optional `resultLogicalAssetVersionId`)
- access metadata is protected-resource based (`protectedResourceId`, `accessHandle`)
- filesystem and `storage-instance://` leakage in access handles is rejected
- pending/failed preview availability cannot expose access descriptors
- available/stale preview availability must include protected access descriptors

Original-content retrieval remains a separate protected access flow with purpose-scoped and expiry metadata.

## Lineage posture

Lineage contracts capture immutable provenance pointers without duplicating full canonical run/system/workflow payloads:

- source pointers: `runId`, `systemId`, `workflowId`, optional `workflowTemplateId`, optional `executionNodeId`, `outputSlot`
- snapshot/version pointers: workflow-template version id/tag, system snapshot/version tag, parameter snapshot
- execution context pointers: selected node, adapter kind, backend family
- upstream logical assets: `lineage.inputAssetIds`

This keeps provenance explainable for history/reuse/audit while preserving source-of-truth ownership in run/workflow/system domains.

## Layer boundaries

`Domain + shared contracts` own:

- generated-result aggregate and derivative invariants
- lifecycle and lineage integrity rules
- API DTO/schema boundaries
- persistence DTO record shape

`Application layer` (follow-on implementation) owns:

- authoritative output-collection finalization orchestration
- policy-aware preview/original access mediation
- result list/get/by-run and lineage query use cases

`Infrastructure + host composition` (follow-on implementation) own:

- repository/storage adapter execution
- protected access-handle mint/open behavior
- preview derivation/materialization pipelines
- generated-result service composition in authoritative server host

## Explicit non-goals for this story

- no generated-result repository/adapters
- no generated-result server API handlers
- no preview generation workers
- no gallery/history UI integration

## Dependency references (Features 1-5)

- Feature 1 image-asset authoritative ingestion + protected retrieval baseline: `docs/architecture/image-asset-feature-1-final-baseline.md`
- Feature 2 workflow/system persistence baseline: `docs/architecture/image-workflow-system-persistence-and-repositories.md`
- Feature 3 output-discovery and adapter boundary baseline: `docs/architecture/image-manipulation-feature-3-final-baseline.md`
- Feature 4 authoritative run orchestration and terminal output handoff baseline: `docs/architecture/image-run-feature-4-final-baseline.md`
- Feature 5 node-based readiness/routing baseline: `docs/architecture/image-manipulation-node-based-execution-posture.md`
- Feature 6 contract foundations: `docs/architecture/generated-result-asset-domain-foundation.md`, `docs/architecture/generated-result-api-contracts.md`

## Implementation checklist for follow-on stories

- Keep generated-result IDs and lineage pointers canonical/logical across layers.
- Keep preview and original content retrieval protected-resource mediated.
- Keep storage/preview internals behind ports and host composition.
- Keep lineage immutable for durable result history/reuse/audit semantics.

## Story 6.2.1 handoff baseline (implemented)

Run finalization now includes an explicit result-persistence handoff seam instead of adapter-local or UI-local persistence:

- `src/application/runs/use-cases/FinalizeRunExecutionOutcomeUseCase.ts` extracts `ImageManipulationCollectedExecutionResult` payloads from execution diagnostics and calls a typed persistence port.
- `src/application/runs/ports/RunOrchestrationPersistencePorts.ts` defines `IRunCollectedResultPersistencePort` plus typed request/result envelopes for persistence orchestration.
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts` passes the dependency into terminal finalization so completion/cancel/failure updates can trigger authoritative persistence handoff.

Failure behavior is explicit:

- persistence errors do not block authoritative terminal lifecycle finalization
- finalization hints downgrade (`outputAvailability`/`terminalQuality`) when persistence fails or partially persists
- persistence diagnostics are written to `executionTelemetry.finalizationInternal.resultPersistenceDiagnostics`

Concrete backend-to-managed-storage copying remains behind `IRunCollectedResultPersistencePort` for follow-on infrastructure stories.

## Story 6.2.2 concrete persistence baseline (implemented)

Generated-result persistence is now concrete in authoritative SQLite infrastructure:

- `src/infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceMigrations.ts`
- `src/infrastructure/persistence/generated-results/SqliteGeneratedResultPersistenceAdapter.ts`
- `src/infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter.ts`
- `src/application/generated-results/ports/IGeneratedResultPersistenceRepository.ts`

### Persisted structures

- `generated_result_records`: durable result-asset metadata with normalized lifecycle status, run/system/workflow/template/node linkage, storage linkage, visibility/sharing posture, and audit timestamps.
- `generated_result_lineage_inputs`: explicit upstream input asset lineage pointers per result asset.
- `generated_result_previews`: preview descriptor persistence tied to `result_asset_id` for availability/protected-access metadata.
- replay tables (`generated_result_mutation_replays`, `generated_result_preview_mutation_replays`) for idempotent operation-key mutation safety.

### Migration + composition impact

- new migration source domain: `generated-results`
- migration table: `generated_result_repository_migrations`
- migration hook registration added in authoritative persistence composition so generated-result schema bootstraps with existing domains.
- persistent service composition now includes `generatedResultRepository`.

### Run orchestration integration impact

- `SqliteRunCollectedResultPersistenceAdapter` is now wired as the concrete `IRunCollectedResultPersistencePort` in server host composition for terminal finalization flows:
  - `IngestRunExecutionUpdateUseCase`
  - `RequestAuthoritativeRunCancellationUseCase`
  - `RecoverRunOrchestrationStartupStateUseCase`

### Boundary posture

- repository + sqlite rows remain infrastructure concerns
- application/use-case layers consume typed repository/port contracts
- persistence DTOs remain isolated from UI/domain presentation models

## Story 8.2.4 resilience hardening baseline (implemented)

Result collection and preview provisioning now handle degraded and partial-failure conditions explicitly, with durable state rather than ambiguous terminal outcomes.

### Collection and preview failure posture

- `SqliteRunCollectedResultPersistenceAdapter` persists per output record with isolated try/catch boundaries so one failing output cannot abort all result persistence.
- Storage write faults are classified via shared image-manipulation taxonomy/recovery contracts; when possible, a fallback `failed-collection` result record is durably written.
- Successful result persistence now proactively seeds pending preview descriptors (`availabilityStatus=pending`) so delayed derivative readiness is explicit.
- Preview write/provisioning failures are normalized via taxonomy/recovery contracts and persisted as failed preview descriptors (`availabilityStatus=failed`, failure code/message) when storage allows.
- Internal diagnostics now include per-record classification/recovery details plus counters for preview pending/failed/provisioning-unavailable and storage-unavailable conditions.

### Authoritative coherence posture

- Result authority remains in generated-result records even when preview generation/persistence fails.
- Preview failures no longer collapse result availability into "completed but nothing there"; result lifecycle and derivative lifecycle remain distinct and explicit.
- Fallback failed-collection records preserve run/workflow/system/input lineage references for audit/recovery integrity.
- Run terminalization hints degrade explicitly when persistence/preview operations are partial or degraded.

### Recovery and diagnosability posture

- Retryability semantics for operational faults are surfaced through taxonomy-derived recovery contracts in diagnostics.
- Temporary storage unavailability is tracked distinctly from terminal failure to support explicit retry and recovery paths.
- Terminal run lifecycle finalization remains non-blocking while preserving durable evidence for follow-on reprocessing or operator investigation.

## Story 6.2.3 protected original retrieval baseline (implemented)

Generated-result original-content retrieval is now implemented as an authenticated, server-mediated, storage-abstracted flow.

- `GetGeneratedResultOriginalContentUseCase` validates request shape, verifies active workspace membership, enforces workspace-scoped existence and private-visibility policy, and requires retrievable lifecycle state + media type before streaming.
- Storage resolution is mediated through `IStorageLogicalAccessResolutionService` and `IStorageObjectPort` using logical storage references only; backend-local/raw filesystem exposure is avoided.
- `GeneratedResultManagementBackendApi` maps use-case outcomes into stable API errors (`invalid-request`, `forbidden`, `not-found`, `invalid-state`, `internal`).
- `IdentityHttpServer` now serves `GET /api/v1/generated-results/:resultAssetId/original` behind authenticated workspace session mediation, with hardened response headers (`x-content-type-options: nosniff`, `cache-control: private, no-store`, attachment disposition).

Posture impact: original generated outputs are retrieved only through authoritative APIs without exposing storage topology or guessable direct-storage URLs.

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

Run finalization now records an explicit, durable result-availability state so downstream APIs/UI can separate no-result-yet, preview-delayed, partial-persistence, and failed-collection outcomes without ambiguous interpretation.

### Finalization state contract additions

- `RunResultSummary` and `RunResultRegistrationInput` now include `resultAvailabilityState`.
- Canonical values:
  - `pending-result`
  - `partially-collected`
  - `available`
  - `preview-pending`
  - `failed-collection`

### Orchestration derivation behavior

- `FinalizeRunExecutionOutcomeUseCase` derives `resultAvailabilityState` from persistence outcomes + diagnostics:
  - `failed` persistence -> `failed-collection`
  - `partially-persisted` persistence -> `partially-collected`
  - `persisted` + preview pending diagnostics -> `preview-pending`
  - `persisted` + persisted outputs -> `available`
  - no persisted outputs yet -> `pending-result`
- Derived state is persisted in finalization metadata alongside existing terminal output/quality hints.

### API clarity posture

- Run detail/status transport contracts + schema validation now carry finalization `resultAvailabilityState`.
- Consumers can explicitly distinguish:
  - `pending-result` (no result yet)
  - `preview-pending` (result exists; derivative not ready)
  - `failed-collection` (collection/persistence failure)

### Retry/recovery assumptions

- Terminal run finalization remains non-blocking for persistence/collection faults.
- Retry/recovery is an explicit follow-on workflow over durable states, not hidden in-band retry behavior.
- Partial/degraded states are intentionally retained for operator diagnostics and future reprocessing.

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

Generated-result lineage retrieval now has explicit application and transport seams so provenance is explainable for result detail/reuse/debug/governance flows without coupling to backend execution internals.

- new application use cases:
  - `GetGeneratedResultLineageSummaryUseCase`
  - `GetGeneratedResultLineageDetailUseCase`
  - `GeneratedResultLineageReadUseCaseContracts`
- new projection helper:
  - `GeneratedResultLineageProjection`
- new authenticated routes:
  - `GET /api/v1/generated-results/:resultAssetId/lineage/summary`
  - `GET /api/v1/generated-results/:resultAssetId/lineage`

### Retrieval posture

- Requires active workspace membership and enforces private-result owner/admin visibility with safe not-found responses.
- Builds lineage from authoritative generated-result persistence records and lineage pointers, not adapter-local/runtime payload introspection.
- Falls back to persisted generated-result fields when separate lineage row projection is unavailable.

### Output shape posture

- Summary output provides run/workflow/system/execution-node linkage, output slot, input-asset count, and explainability booleans (`hasWorkflowTemplateVersion`, `hasSystemSnapshot`, `hasParameterSnapshot`, `hasSelectedNode`).
- Detail output includes:
  - immutable snapshot/version provenance refs (workflow template, system snapshot/version, parameter snapshot),
  - execution provenance (`selectedNodeId`, `executionAdapterKind`, `executionBackendFamily`),
  - upstream input assets,
  - deterministic lineage graph nodes/edges connecting result, run, workflow, system, optional execution node, and inputs.

## Story 6.3.4 result reuse metadata and source-selection seams (implemented)

Generated-result metadata/read seams now explicitly prepare result assets for future workflow input reuse flows rather than terminal-only history display.

### Reuse metadata projection posture

Generated-result summary/detail metadata now includes:

- `reuse.reusableAsWorkflowInput`
- `reuse.logicalAssetReference`
- `reuse.supportedInputPurposes`
- `reuse.assetClasses`
- `reuse.mediaClasses`
- `reuse.sourceContext` (run/workflow/system/execution-node/output/input-count lineage summary)

This keeps generated results inside the same logical asset + binding compatibility model used by workflow/system contracts.

### Reuse/source-selection query posture

List query seams now support reuse-aware and lineage-aware candidate selection:

- `lineageInputAssetIds`
- `requiredInputPurposes`
- `requiredAssetClasses`
- `requiredMediaClasses`
- `reuseReadyOnly`

Repository/persistence filtering now supports lineage-input constraints so source-selection flows can request compatible reusable outputs without introducing result-model forks.

## Story 6.3.5 integration coverage for result, preview, and lineage service flows (implemented)

Authoritative integration coverage now validates end-to-end generated-result service behavior over durable persistence seams rather than adapter-local transient output payloads.

- Added integration suite:
  - `src/application/generated-results/tests/GeneratedResultServiceFlows.integration.test.ts`

### Covered service flows

- collected output persistence through `SqliteRunCollectedResultPersistenceAdapter` writing authoritative generated-result records into `SqliteGeneratedResultPersistenceAdapter` (including partial/failure outcomes),
- generated-result listing via `ListGeneratedResultMetadataUseCase` projected from authoritative persisted records,
- protected original retrieval via `GetGeneratedResultOriginalContentUseCase` using storage logical-access resolution and object-port mediation,
- protected preview retrieval request/open via:
  - `RequestGeneratedResultPreviewContentUseCase`
  - `OpenGeneratedResultPreviewContentUseCase`
- lineage summary/detail retrieval via:
  - `GetGeneratedResultLineageSummaryUseCase`
  - `GetGeneratedResultLineageDetailUseCase`

### State and regression posture covered

- preview state coverage:
  - `preview-pending`
  - `preview-unavailable` (missing descriptor)
  - `preview-failed`
  - `preview-available` + protected token open path
- persistence outcome coverage:
  - partially persisted run outputs with explicit failed-collection records
- leakage/regression safeguards:
  - verifies result/lineage/list projections come from authoritative generated-result records
  - asserts backend-local temporary file references are not surfaced through authoritative records or lineage outputs

## Story 6.4.2 result-detail and lineage inspection UX flows (implemented)

Image manipulation studio result review now includes a dedicated result-detail + lineage inspector surface that uses authoritative generated-result APIs and presents provenance in layered form.

### UI integration seam

- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx`
- `src/ui/components/studio-shell/tests/ImageManipulationRuntimeEditorPanel.test.tsx`

### Behavior posture

- Detail/lineage retrieval remains API-backed (`getGeneratedResult`, `getGeneratedResultLineageDetail`) keyed by canonical `resultAssetId`.
- Default review copy is plain-language and task-oriented (`Result details`) so non-technical users can quickly understand origin context.
- Advanced provenance remains collapsed by default (`Advanced provenance`) and exposes bounded run/workflow/system/input/execution-node context for debugging and trust.
- Result review can reopen corresponding run context from history (`Open run context`), keeping detail inspection aligned with gallery/history continuation flows.

### Safety and boundary posture

- UI avoids exposing storage topology, filesystem paths, or protected access internals in provenance views.
- Provenance summaries rely on normalized generated-result DTOs and lineage summaries instead of re-deriving backend execution details in the UI.
- Advanced detail focuses on stable lineage pointers (run/system/workflow/input assets, snapshot/version references, execution context hints) to support future admin/debug expansion without changing default user messaging.

## Story 6.4.3 audit integration for generated-result persistence and protected access (implemented)

Generated-result persistence and protected retrieval flows now participate in authoritative platform audit capture through reusable audit ports/services.

### Canonical seams

- `src/application/generated-results/ports/GeneratedResultAuditPort.ts`
- `src/infrastructure/audit/AuthoritativeGeneratedResultAuditSink.ts`
- `src/infrastructure/persistence/generated-results/SqliteRunCollectedResultPersistenceAdapter.ts`
- `src/application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCase.ts`
- `src/application/generated-results/use-cases/GetGeneratedResultOriginalContentUseCase.ts`
- `src/application/generated-results/use-cases/RequestGeneratedResultPreviewContentUseCase.ts`
- `src/application/generated-results/use-cases/OpenGeneratedResultPreviewContentUseCase.ts`
- `src/hosts/server/IdentityServerHost.ts`

### Audited event coverage

- result persistence emission: `generated-result-persisted`
- preview-generation/provisioning outcomes: `generated-result-preview-generation-recorded`
- protected original-result access: `generated-result-original-content-accessed`
- protected preview request/open access: `generated-result-preview-access-requested`, `generated-result-preview-content-opened`

### Governance posture

- persistence/preview-generation events map to `run.result.*` actions through authoritative run-category recording.
- protected retrieval events map to `asset.protected.generated-result.*` actions through authoritative protected-data recording.
- emitted payloads include actor/workspace/result ids and lineage-sensitive linkage (`runId`, `workflowId`, `systemId`, optional `executionNodeId`) when present.

### Redaction posture

- generated-result audit payload details are sanitized in the generated-result audit port before sink dispatch.
- sensitive keys/values (credentials/tokens, raw content payloads/bytes, filesystem or storage paths/object keys, backend handles) are redacted.
- only bounded reason/status/linkage summaries are emitted; raw backend/storage internals are excluded.

