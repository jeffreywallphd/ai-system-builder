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

