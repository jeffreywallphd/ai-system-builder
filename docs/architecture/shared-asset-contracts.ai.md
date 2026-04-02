# AI Companion: Shared Asset Contracts (Foundation Slice)

## Why this exists
- Shared taxonomy already answers **what an asset is**.
- Shared contracts now answer **how that asset is used**.
- Specialized composite semantics are explicit in shared contract projections: workflow = orchestrator, agent = decision unit, context-bundle = input preparer.

## Core distinction
- Taxonomy = classification (`structuralKind`, `semanticRole`, `behaviorKind`).
- Contract = interaction surface (input/output/config parameters + optional execution metadata).

## Where to look
- Contract model: `domain/contracts/AssetContract.ts`
- Contract projection seam: `application/contracts/CompositionAssetContractResolver.ts`
- Canonical integration seam: `application/assets-system/CanonicalEntityReadResolver.ts`

## Current grounded coverage
- Workflow, agent, tool capability, context package, and context recipe contract projections are supported.
- Taxonomy-driven bounded contract projections now cover all planned Direction 5 composite roles with truthful baselines (`workflow`, `workflow-template`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`) plus system roles (`app-template`, `system`) for recursive system composition foundations, while preserving existing atomic role coverage.
- Projection remains combination-aware (structural/semantic/behavior). Unsupported taxonomy combinations intentionally return no projection rather than fabricating speculative contracts.
- Canonical operational reads expose optional `contract` where resolver-backed projection is available (workflow-definition, installed-model, base-model, and execution-artifact when backing adapters are available).
- Agent Studio output/memory reference UX reuses canonical asset-management read seams (asset detail + version chain lineage) instead of adding agent-only output contract surfaces.
- Direction 5 atomic studios now reuse this seam directly for publish-time enforcement and default metadata in the shared shell:
  - Model Studio + Dataset Studio use `atomic/*/none` contract projections.
  - Tool Studio uses `atomic/tool/(conditional|deterministic)` projections.
- Shared Studio Shell publish-time enforcement now uses the same resolver seam for composite consistency checks (taxonomy shape + derivable/compatible contract), rather than introducing a separate composite enforcement path.
- System Studio contract projection now extends the same shared resolver seam with bounded recursive projection (`resolveSystemContract`) so system contracts truthfully reflect explicit system I/O/parameters, child bindings, and nested-system topology without creating a parallel contract model.
- System Studio now has first-class interface/config authoring operations (`updateSystemInterfaces`, `updateSystemParameters`) so explicit system inputs/outputs/parameters/default values persist through the real draft/update/validate/publish/reload path and are consumed directly by recursive contract projection.
- System Studio now also includes bounded execution metadata authoring (`updateSystemExecutionMetadata`) for runtime/environment hints, orchestration posture, publish/export metadata, execution profile metadata, and operational ownership metadata; this remains metadata-only and does not introduce a parallel runtime/deployment stack.
- Registry/system detail lineage surfaces now make system version lineage explicit with bounded nested-system/child-version reference alignment (`includedInUpstream`) so recursive system-of-systems derivation remains deterministic and grounded in canonical version/upstream truth.
- System publish enforcement now extends the same shared studio-shell enforcement seam with bounded recursive checks for system child references/contracts, binding endpoint compatibility, and recursion cycle/depth safety before publish.
- Tool Chain Studio now reuses this same composite publish-consistency seam (`tool-chain`/`deterministic`) and the shared taxonomy-driven contract projection (`executionOrdering=sequential`) for draft authoring and publish gating.
- Workflow Template assets now include explicit composition-mapping contracts (workflow interface refs, template input/output bindings, parameter mappings, optional system-context mappings) plus parameter-definition contracts with safe default/override validation, keeping template orchestration asset-first and runtime-agnostic.
- Workflow Template deep compatibility checks are now concretely wireable through a canonical workflow-contract resolver adapter (asset-id to workflow contract), and parameter contracts now support formal cross-parameter dependency rules (`requires-when-set` / `requires-when-equals`) validated during parameter application.
- Cross-studio end-to-end consistency tests now verify contract coherence through create/update/validate/publish/reload over real service/bridge/backend/application/SQLite seams.

## Architectural intent
- Keep changes incremental, inner-layer-first, and adapter-driven.
- No parallel agent contract architecture.
- No system-composer UI in this slice.
- Direction 5 atomic studio slices now consume taxonomy-driven atomic contract projection for Prompt Template, Embedding Index, and Config Profile (`atomic/prompt-template/none`, `atomic/embedding-index/none`, `atomic/config-profile/none`) through shared shell metadata + publish-enforcement seams.

## Implementation status snapshot (Direction 5 through stories 5.24)
- Fully implemented now: shared taxonomy-driven contract projection for implemented atomic/composite studios, shared composite publish-consistency enforcement, and composite-to-atomic interop validation through shared dependency + taxonomy/contract seams.
- Fully implemented now: bounded System Studio authoring/publish orchestration uses recursive system contract projection through shared Studio Shell seams, and registry detail/lineage projections surface system child/nested-version lineage alignment (`includedInUpstream`) for published system versions.
- Partially implemented / bounded: projections are baseline authoring/publish-gating contracts, not a full runtime behavior-contract system.

## Direction 5 update: Runtime execution contract + dependency resolution foundation (stories 6.3–6.4)

- Runtime now has an explicit execution-contract mapping seam in `application/system-runtime/RuntimeExecutionContractMapping.ts`.
- Mapping remains derived from shared contract truth (`resolveSystemContract`) and system definitions; it does not introduce a second contract model.
- Runtime-facing execution mapping now includes:
  - system runtime inputs/outputs
  - system/runtime parameters (system-authored + derived contract parameters)
  - runtime-visible child component interface references (atomic/composite/system)
  - bounded recursive traversal status for nested system-of-systems references.
- Runtime now has an explicit dependency-resolution seam in `application/system-runtime/RuntimeDependencyResolution.ts`.
- Resolution reuses existing system dependency truth (`collectSystemDirectDependencies`, nested-system traversal) and preserves version-aware asset references in runtime-oriented results.
- Recursive dependency resolution is bounded and cycle-safe, and yields deterministic outputs for later execution-plan construction (resolved components, dependency sets, ordering hints) without implementing an orchestrator in this slice.


## Direction 5 update: Runtime environment abstraction + execution plan builder (stories 6.5–6.6)

- Runtime now includes a bounded environment abstraction in `domain/system-runtime/RuntimeEnvironmentDomain.ts` and `application/system-runtime/RuntimeEnvironmentSelector.ts`:
  - typed environment kinds (`local`, `mcp`, `remote`)
  - capability contracts for supported structural kinds, nested-system support, and MCP-mediated execution posture
  - deterministic resolution results (`resolved` vs `unsupported`) for plan-time environment targeting without infrastructure launch coupling.
- Runtime plan-building now has an explicit seam in `application/system-runtime/ExecutionPlanBuilder.ts`:
  - deterministic `ExecutionPlan`/node/edge model derived from existing system structure + bindings + runtime contract/dependency outputs
  - environment assignment through the selector seam (no hardcoded single-host execution)
  - cycle-safe invalidation for binding/dependency cycles and truthful unsupported-environment surfacing
  - no orchestrator/runtime engine state machine added in this slice.

## Direction 5 update: Runtime orchestration + step execution seams (stories 6.7–6.8)

- Runtime now has a bounded orchestration seam in `application/system-runtime/ExecutionOrchestrationService.ts` that composes runtime-contract mapping, dependency resolution, environment selection, and plan progression into runtime execution lifecycle state.
- Orchestration remains application-layer and delegates all per-node work to the step engine seam; it does not embed infrastructure-specific execution paths.
- Runtime now has a bounded step engine seam in `application/system-runtime/StepExecutionEngine.ts` that executes plan nodes for atomic/composite/system components using runtime-domain status/output semantics.
- Bounded behavior handling is explicit:
  - deterministic steps execute fixed-pass
  - conditional/iterative/autonomous steps expose only truthful bounded markers/diagnostics currently supported
  - no full retry/distributed/autonomous-loop runtime stack is introduced in this slice.

## Direction 5 update: Runtime trace + bounded recovery semantics (stories 6.11–6.12)

- Runtime execution state now carries typed trace/log artifacts (`ExecutionTrace`, `ExecutionTraceEvent`, `ExecutionLogEntry`) in `domain/system-runtime/SystemRuntimeDomain.ts`.
- Trace events are emitted from authoritative seams in `application/system-runtime/ExecutionOrchestrationService.ts` for:
  - execution lifecycle transitions
  - node attach/start/complete state transitions
  - bounded loop/planner progression (`iterate`, `replan`)
  - nested system entry/exit progression
  - structured error + recovery decisions.
- Runtime failure handling now uses typed bounded contracts (`RuntimeExecutionError`, `RuntimeExecutionErrorKind`, `RecoveryDecision`, `RecoveryActionKind`) with explicit fail-fast propagation and bounded retry where truthfully supported.
- Recovery behavior remains intentionally narrow:
  - unsupported/unrecoverable conditions fail the execution immediately
  - transient step failures can retry in a bounded single-attempt window
  - propagated failures are recorded in runtime state + trace for later API/UI inspection.

## Direction 5 update: Runtime performance + stability safeguards (story 6.23)

- Orchestration now enforces bounded runtime-state retention in hot paths (trace events/logs, runtime errors, progression history) to keep iterative/autonomous execution memory-bounded.
- Pathological runtime bounds now fail as deterministic `invalid-request` errors (depth, iteration/planning cycles, and runtime-state retention limits) instead of degrading into runaway loops.
- Runtime execution persistence now has bounded retention in both store implementations:
  - in-memory store prunes oldest records on capacity overflow
  - SQLite store prunes oldest persisted records on capacity overflow.
- This is bounded hardening of the existing runtime stack, not a new distributed scheduling/observability architecture.

## Direction 5 update: Runtime documentation alignment (story 6.24)

- Runtime docs now reflect implemented seams through stories 6.1–6.23 and explicitly separate:
  - fully implemented capabilities,
  - bounded/partial behavior,
  - future runtime work not yet implemented.

## Direction 5 update: Runtime input validation + output serialization (stories 7.5–7.6)

- External runtime start now validates payloads through a centralized application seam (`RuntimeInputValidationService`) before plan/orchestration work begins.
- Validation is contract-derived (resolved system contract + runtime execution contract mapping), deterministic, and bounded to current expressiveness:
  - required-input checks,
  - unsupported-key checks where meaningful,
  - bounded parameter/config object + declared-type checks.
- Validation denials are structured runtime issues (`RuntimeValidationError`) surfaced as `invalid-request` API errors with machine-readable details.
- Runtime result reads now pass through `RuntimeOutputSerializer` in the API layer for deterministic external envelopes covering:
  - execution/version identity,
  - summary,
  - contract-labeled outputs,
  - bounded nested-system summaries,
  - bounded diagnostics counts + entries.
- The serializer is intentionally thin over runtime read-model truth and does not duplicate orchestration logic.

## Direction 5 extension update: Core transformation assets foundation (stories 16.1-16.6)

- Dataset Studio now has a dedicated transformation-asset seam in `application/dataset-studio/core/data/transformation/*` with explicit contracts:
  - `ITransformationAsset`
  - `ITransformationInput`
  - `ITransformationOutput`
  - `ITransformationConfig`
- Transformation assets are zod-validated end-to-end (input/config/output) and run through a shared base class (`BaseTransformationAsset`) with:
  - config/input/output validation,
  - async execution handling,
  - preview sampling support over canonical records/table shapes,
  - bounded execution error wrapping.
- A dedicated transformation registry seam (`TransformationAssetRegistry` + `registerTransformationAssets`) now provides deterministic registration/lookup/listing for pipeline composition.
- Initial transformation implementation now includes `SchemaInferenceAsset`:
  - sample-based inference over canonical records/table inputs,
  - strict/permissive mixed-type resolution,
  - inferred field type + nullability + lightweight stats,
  - categorical vs free-text heuristic for string fields,
  - preview outputs that include inferred schema plus sampled rows.
- Transformation coverage now also includes:
  - `DataProfilingAsset` with bounded per-field profiling over canonical records/table inputs (row/null/distinct counts, inferred type reference, min/max, optional numeric summary stats, and short field samples),
  - `FieldMappingAsset` with deterministic one-to-one field mapping/rename behavior (preserve/drop unmapped controls and optional empty-target dropping),
  - `TypeNormalizationAsset` with deterministic type normalization and coercion controls (field-targeted string/number/boolean/date conversion, string trimming, optional empty-string-to-null handling, inspectable conversion outcomes/failure posture),
  - `MissingValueHandlingAsset` with deterministic missing-value strategy controls (leave, fill-default, fill-per-field, drop-row with any/all modes, and explicit empty/whitespace missing semantics),
  - `DeduplicationAsset` with deterministic duplicate grouping/retention across exact-all, exact-fields, and fuzzy-fields modes (field-scoped matching controls, keep-first/last/best behavior, duplicate-group metadata, and preview row/group summaries),
  - `DataValidationAsset` with deterministic row/field validation over required/type/enum/length/range/pattern rules plus configurable invalid-row handling (annotate-and-keep, drop-invalid, split-valid-invalid) and inspectable row-level issues,
  - `DataClassificationAsset` with rule-based field/record tagging for semantic type guesses, practical PII likelihood tags (`pii.email/phone/name/address/identifier`), sensitivity tags (`sensitivity.low/medium/high`), and inspectable reason/confidence signals,
  - `FilteringAsset` with deterministic record-level condition filtering across equality/set/range/string/null-empty operators with AND/OR grouping, include/exclude modes, and inspectable per-condition match counts,
  - `AggregationAsset` with deterministic grouped aggregation over canonical records/table rows (`count`, `sum`, `avg`, `min`, `max`, `distinctCount`, `first`, `last`) using explicit group-by + operation config, null-handling posture, skipped-operation diagnostics, and preview-ready grouped row summaries,
  - framework-aligned preview outputs for transformation assets (summary + representative sampled rows/groups/issues) suitable for Wizard/Canvas inspection surfaces.
- Core transformation orchestration now has a dedicated pipeline contract/execution seam in `TransformationPipeline` with:
  - zod-validated serializable pipeline definitions (pipeline id, ordered step descriptors, asset reference, config, optional metadata, deterministic failure mode),
  - execution over registered assets by id/version or direct instances without coupling to concrete asset classes,
  - per-step config validation before execution, per-step status/summary/error diagnostics, fail-fast `stop-on-error` behavior, and pipeline-level output/result metadata,
  - chain preview support with per-step summaries plus bounded sampled final preview output for Wizard summaries and future Canvas node inspection.
- Transformation stage mapping now resolves stage-to-asset references for these capabilities:
  - `profiling -> data-profiling`,
  - `classification -> data-classification`,
  - `normalization -> type-normalization`,
  - `cleaning -> missing-value-handling + deduplication + filtering`,
  - `transformation -> field-mapping + data-validation + filtering`,
  - `aggregation -> aggregation`.

## Direction 5 extension update: Transformation preview + config UX contracts (stories 16.13-16.14)

- Transformation preview now has one standardized contract seam for single assets and pipelines:
  - single-asset previews return normalized contracts with row-count/change summaries, sampled input/output rows, structured diff snippets, warning/error arrays, and bounded asset-specific diagnostic extensions,
  - pipeline previews now aggregate per-step normalized previews and expose concise top-level summaries plus deeper per-step inspection payloads for future Wizard/Canvas progressive disclosure.
- Preview shaping is centralized through shared internal helpers (`TransformationPreviewService`, `TransformationPreviewContracts`, `TransformationDiffUtils`) so preview logic is consistent and not scattered across individual assets.
- Transformation config UX contracts are now standardized and zod-aligned:
  - reusable descriptor contracts for fields/sections/options/defaults/constraints/simple-vs-advanced visibility,
  - descriptor generation is derived from executable zod config schemas with bounded UX overlays per asset, preserving runtime schema authority and preventing drift.
- Pipeline/orchestration authoring compatibility now includes:
  - pipeline step-level config UX descriptors tied to registered transformation assets,
  - stage-to-asset compatibility helpers for dataset stage mapping so Wizard/Canvas authoring can consume one inspectable config-contract surface.

## Direction 5 extension update: Dataset schema intent + media contract foundation (stories 1.1.1-1.1.2)

- Dataset asset registration now includes an explicit schema-intent seam with inspectable descriptors (`id`, `name`, `description`, `contractVersion`, supported shape kinds, and validation issues) on `DataAssetRegistry` entries.
- A reusable schema-intent registry now exists in `application/dataset-studio/DatasetSchemaIntentRegistry.ts` with default intents (`tabular`, `document`, `semantic`, `media`) and shape-kind-based intent resolution for compatibility with existing assets.
- Media is now a first-class schema intent through `MediaSchemaIntentAdapter`, with dataset-level validation hooks for image-oriented shapes and canonical media-contract checks where image-record fields are present.
- Canonical image records are now domain-first contracts in `domain/dataset-studio/contracts/ImageRecord.ts` with structured image asset references (`domain/dataset-studio/contracts/ImageAssetReference.ts`) and library-agnostic interfaces (`ImageRecord`, `IImageRecordValidator`).
- zod is now isolated behind adapter boundaries for this slice (`application/dataset-studio/adapters/validation/ImageRecordValidator.ts`), preserving domain/application contracts independent of validation library choice.

## Direction 5 extension update: media asset-reference + metadata extraction refinement (stories 1.1.3-1.1.4)

- Image asset references are now standardized through `ImageAssetReference` with explicit source kinds (`local-file`, `generated-output`, `external-uri`, canonical asset compatibility), stable identifiers, optional source context, and format/mime hints.
- `ImageRecord` normalization now canonicalizes legacy string/object references at the boundary into that structured contract, keeping persisted/runtime image-record semantics inspectable and version-safe.
- Image metadata extraction is now adapter-backed through internal interfaces in `domain/dataset-studio/interfaces/ImageMetadataExtraction.ts` (`IImageMetadataExtractor`, `IImageFormatDetector`, `IImageDimensionReader`, `IImageExifReader`).
- Library integrations are confined to media adapter modules (`application/dataset-studio/adapters/media/*`) using `file-type`, `image-size`, and `exifr`; domain contracts remain library-independent.
- `ImageIngestorAsset` now composes extraction + normalization + image-record validation before producing canonical image metadata outputs, so ingestion reliably populates image-record fields (`assetRef`, dimensions, format, mime/exif hints) while degrading gracefully when EXIF data is absent.

## Direction 5 UI extension update: system/page asset contract + unified UI asset registration (stories 1.1.3-1.1.4)

- Studio UI contracts now include a first-class `system-page` kind (`ui/studio-shell/studio-assets/StudioAssetContracts.ts`) so page/layout/navigation assets are explicit rather than overloaded as generic composed assets.
- `SystemPageAssetContract` adds reusable page-level contract seams for:
  - page/layout structure (`layoutKind`, `regions`, `defaultRegionId`),
  - layout responsibilities and panel references,
  - navigation/runtime-relevant settings (`route`, deep-link posture, nav grouping),
  - renderer/persistence compatibility through shared studio-asset base fields.
- `system-studio` now declares that `system-page` contract shape in `StudioSurfaceAssetDefinitions`, including explicit region definitions (`navigation`, `workspace`, `inspector`) and bounded nested-page composition metadata.
- A shared registration/discovery seam now exists in `ui/studio-shell/studio-assets/StudioAssetRegistry.ts` and reuses existing studio asset definitions/contracts:
  - atomic UI primitives,
  - composed studio surfaces,
  - system/page surfaces.
- Registry entries expose deterministic lookup/discovery fields (`id`, `kind`, `category`, metadata, renderer info, props/persistence hooks, and composition metadata) and can resolve rendering definitions by id.

## Direction 5 UI extension update: shared UI asset metadata + runtime renderer resolution (stories 1.1.5-1.1.6)

- UI assets now project one normalized metadata seam across atomic, composed, and system/page registrations (`StudioAssetContracts`, `StudioAssetRegistry`), rather than carrying divergent per-asset metadata payloads.
- Shared metadata now consistently includes:
  - identity hooks (`metadata.id`, `metadata.assetType`)
  - display text (`title`, `summary`, `displayName`, `description`)
  - grouping/classification (`kind`, registration `category`, metadata `group`, `contractCategory`)
  - discovery hooks (`iconToken`, `tags`, `keywords`)
  - optional capability flags (`capabilityFlags`) for future inspector/library workflows.
- Registry normalization validates and freezes these fields for deterministic discovery output and persistence-friendly read behavior.
- Runtime renderer resolution is now a first-class registry seam with structured outcomes:
  - `resolveRendererById`
  - `resolveRenderersByKind`
  - `resolveRenderersByCategory`
  - resolution status: `resolved`, `missing`, `invalid`
- This keeps renderer lookup generic across future UI asset families while allowing graceful runtime fallback when definitions are missing or registration/contract renderer metadata drifts.

## Direction 5 extension update: derived attributes + media schema validation layer (stories 1.1.5-1.1.6)

- Canonical image records now include a typed derived-attributes seam (`ImageDerivedAttributes`) with bounded inspectable fields (`aspectRatio`, `orientation`, `isAnimated`, `pixelCount`, `megapixels`) while remaining canonical-record-compatible.
- Derived computation is now explicit via `IImageDerivedAttributeCalculator` with a default adapter-backed implementation (`DefaultImageDerivedAttributeCalculator`), keeping the compute boundary separate from extraction and validation.
- `ImageIngestorAsset` now computes derived attributes from canonical fields (dimensions + format) and emits them as canonical media metadata for downstream preview/runtime use.
- Media validation now has explicit domain-level contracts (`IMediaRecordValidator`, `IMediaDatasetValidator`) and normalized pass/fail issue diagnostics, with zod isolated in adapter implementations.
- `MediaSchemaIntentAdapter` now consumes the shared media dataset validator seam for schema-aware validation (assetRef structure, dimensions, format allow-list, metadata/tags compatibility, derived attribute shape), avoiding parallel validation paths.
- Runtime canonical shape checks for `image-metadata-records` now reuse this same media validator seam for consistent, inspectable ingestion/runtime behavior.

## Direction 5 extension update: media dataset compatibility + image preview support (stories 1.1.7-1.1.8)

- Media datasets remain first-class dataset assets under the existing registration/loading/inspection/versioning seams (`CanonicalDataAsset`, `DataAssetRegistry`); no media-specific asset subsystem was added.
- Dataset inspectability now inherits schema-intent preview hints into shared descriptor preview modes when callers do not provide explicit preview modes, preserving discoverability through one contract path.
- Image preview shaping is now centralized in `application/data-studio/ImageDatasetPreviewBuilder.ts` and consumed by the shared `DataPreviewEngine`, rather than embedding image parsing in UI components.
- `image-metadata-records` preview contracts now expose schema-aware fields per preview item: image reference/id, width, height, format, selected metadata summary, tags, and derived attributes.
- Preview mapping is resilient to partial/malformed media records and emits bounded warning diagnostics instead of throwing/failing preview generation.
- Data Studio preview rendering now supports bounded thumbnail-oriented image rows with graceful fallbacks for missing thumbnails, missing metadata, and broken references.

## Direction 5 extension update: media tagging/annotations + schema-aware image ingestion (stories 1.1.9-1.1.10)

- Canonical image-record contracts now include first-class lightweight annotations (`ImageAnnotations`) integrated into `ImageRecord` creation/normalization with existing normalized tags.
- Annotation scope is intentionally bounded and reusable across dataset/workflow/system seams:
  - optional caption/description/note
  - optional bounded labels
  - optional simple region reference (x/y/width/height with pixel coordinate-space support).
- Validation remains adapter-backed at the boundary:
  - `ZodImageRecordValidator` validates and normalizes tags + annotations for canonical records
  - `ZodMediaDatasetValidator` maps and validates annotations from canonical `image-metadata-records`.
- Unified ingestion now supports schema-aware media routing without introducing a parallel pipeline:
  - ingestion request/batch metadata can carry `schemaIntentId`
  - `schemaIntentId=media` can force canonical image metadata output targeting
  - advanced unified ingestion config supports image tag/annotation passthrough (`imageTags`, `imageAnnotations`)
  - routed image ingestion passes those values into `ImageIngestorAsset`.
- `ImageIngestorAsset` now accepts tags/annotations in config/request and emits them in normalized metadata and preview attributes while preserving existing canonical image-record validation flow.
- Image ingestion detection is more robust for media intent:
  - probe-confirmed images can proceed even when extension/content-type are ambiguous
  - unsupported formats still fail with explicit diagnostics
  - partial metadata continues to degrade gracefully when canonical record construction remains valid.
- Shared preview compatibility is preserved and extended:
  - `ImageDatasetPreviewBuilder` + Data Studio preview rendering now expose annotations for image rows
  - records without annotations remain valid/backward-compatible.

## Direction 5 extension update: media versioning + workflow compatibility contracts (stories 1.1.11-1.1.12)

- Media datasets now expose inspectable versioning metadata through the same shared dataset seams (`DataAssetBase.inspect` + `DataAssetRegistryDescriptor`) instead of a media-only version path:
  - dataset version id,
  - schema version,
  - contract version,
  - revision,
  - published version id,
  - schema-intent contract version.
- Canonical image-record version compatibility is now explicit and bounded in `domain/dataset-studio/contracts/ImageRecordVersioning.ts`, reusing existing dataset-version parsing/comparison rules (no parallel media versioning subsystem).
- Media record validation now enforces schema-version compatibility denials for incompatible/invalid record versions while preserving backward-safe defaults for legacy records that omit schemaVersion.
- Workflow consumption of dataset assets now uses one shared compatibility-contract extension seam (`application/workflow-studio/WorkflowDatasetCompatibilityContracts.ts`) on the existing dataset-input binding/context path:
  - generic dataset-reference compatibility for all dataset inputs,
  - media image-record compatibility for media-intent selections,
  - stable workflow-facing media fields: `assetRef`, `width`, `height`, `format`, `metadata`, `tags`, `derived`, `annotations`,
  - optional selected-field subset projection for bounded media-record subset compatibility.

## Direction 5 extension update: media adapter containment hardening (story 1.1.13)

## Direction 5 extension update: Data Studio ↔ System dataset compatibility (story 1.3.13)

- Data Studio preview selection references and System runtime preview record references now reuse one shared contract seam in `domain/dataset-studio/contracts/StudioDatasetCompatibility.ts`.
- Shared references now explicitly model:
  - dataset asset refs (`assetId` + optional `versionId`),
  - dataset instance refs (`systemId` + `instanceId` + dataset asset ref),
  - record/selection refs (`recordId` + `selectionId` + dataset + optional instance).
- Data Studio selection snapshots and System runtime image-preview payloads now carry this same reference contract (no studio-private remapping of core dataset identifiers).
- Bounded application-layer orchestration for handoff/selection continuity now lives in `application/system-runtime/StudioDatasetCompatibilityService.ts`:
  - validates selection-to-instance dataset compatibility,
  - projects runtime previews into shared references,
  - resolves selected record ids through existing runtime query/read seams.

## Direction 5 extension update: image dataset mutation and generation events (stories 1.4.5-1.4.6)

- Runtime image dataset instance mutations now emit canonical dataset events through the existing application publisher seam (`DatasetEventPublisher`) after successful persistence only:
  - add/create flows emit `image_added`,
  - update flows emit `image_updated`,
  - generated-output persistence flows emit `image_generated`.
- Event payloads remain contract-first and domain-bounded:
  - include dataset + instance + record references through shared compatibility contracts,
  - include bounded derived metadata when present,
  - include mutation-level field summaries for updates (`updatedFields`).
- Workflow/runtime lineage context is projected into bounded event metadata when available (`workflowId`, `workflowRunId`, lineage map fields such as `instanceId`/`studioId` and source refs), without coupling the dataset event model to any specific execution adapter/runtime object.

## Direction 5 extension update: runtime-operational dataset contracts + schema validation engine (stories 1.3.1-1.3.2)

- Dataset assets now expose a bounded runtime-operational contract in the canonical dataset domain (`DataAssetBase`) so runtime usage is explicit and inspectable instead of ad hoc flags:
  - runtime usability posture (`authoring-only`, `runtime-readable`, `runtime-operational`),
  - system/asset instance ownership + runtime state scope,
  - mutability + operational write behavior,
  - declared runtime access patterns (`scan-read`, `point-lookup`, `random-read`, `append-write`, `upsert-write`, `overwrite-write`).
- Runtime-operational metadata is projected through shared registration/inspection seams (`DataAssetRegistryDescriptor.runtime`, `capabilities.runtimeUsable`) so Data/Workflow/System studios can consume one platform contract.
- Dataset schema validation now has a dedicated internal engine seam (`IDatasetSchemaValidationEngine`, `DatasetSchemaValidationEngine`) that executes schema-intent validation through domain contracts and returns inspectable summaries (`errorCount`, `warningCount`) with normalized issues.
- Media/image schema validation remains adapter-bounded and schema-intent-driven:
  - canonical image record requirements (asset reference, dimensions, format, metadata/tags/derived shape) are validated through the media intent adapter,
  - zod-backed implementations remain behind internal validation contracts (`IMediaRecordValidator`, `IMediaDatasetValidator`) to avoid library sprawl.

- Media library mechanics are now explicitly adapter-owned:
  - `file-type` stays inside `application/dataset-studio/adapters/media/ImageFormatDetectorAdapter.ts`,
  - `image-size` stays inside `application/dataset-studio/adapters/media/ImageDimensionReaderAdapter.ts`,
  - `exifr` stays inside `application/dataset-studio/adapters/media/ImageMetadataExtractorAdapter.ts`,
  - `sharp` stays inside `application/dataset-studio/adapters/media/SharpImageTransformerAdapter.ts`.
- Image/media orchestration now resolves defaults through adapter composition (`MediaAdapterFactory`) instead of scattering concrete media-library adapter construction across ingestion and pipeline services.
- Media validation defaults now resolve through validation composition (`MediaValidationFactory`), keeping validation contracts (`IMediaRecordValidator`, `IMediaDatasetValidator`) stable while zod-backed implementations remain behind adapter boundaries.
- Mid-level image transformation services now depend on internal contracts (`IImageTransformer`) and consume normalized adapter outputs instead of calling `sharp` directly.

## Direction 5 extension update: dataset runtime instances + input image store foundation (stories 1.2.3-1.2.4)

- Dataset runtime state now has an explicit system-runtime instance seam (`domain/system-runtime/DatasetInstanceDomain.ts`, `application/system-runtime/DatasetInstanceRepository.ts`) separate from dataset asset-definition metadata.
- Persistence now includes a dedicated SQLite adapter (`infrastructure/filesystem/system-runtime/SqliteDatasetInstanceRepository.ts`) with versioned migrations and round-trip rehydration through canonical dataset-instance normalization.
- Dataset instance creation/ensure flows now validate:
  - system ownership (through an ownership validator seam),
  - dataset asset linkage (through a dataset-asset catalog seam),
  - role/purpose compatibility and conflict-safe idempotency for system-role stores.
- Input image store now exists as a role-driven dataset-instance configuration (`role=input-store`, `purpose=incoming-images`) via `SystemDatasetInstanceService.ensureInputImageStoreInstance(...)`, not as a separate bespoke model.
- Incoming image payload compatibility is enforced through the dataset asset/instance boundary (`validateIncomingShapeForInstance`) using linked dataset schema intent/shape requirements plus shared media dataset validation contracts.

## Direction 5 extension update: output + intermediate dataset stores (stories 1.2.5-1.2.6)

- Output image store provisioning now uses the same dataset-instance service path as other runtime stores through `SystemDatasetInstanceService.ensureOutputImageStoreInstance(...)` (`role=output-store`, `purpose=workflow-output-images`), preserving system ownership + dataset-asset linkage checks.
- Intermediate stores are now first-class role-driven dataset instances via `SystemDatasetInstanceService.ensureIntermediateStoreInstance(...)` (`role=intermediate-store`) with optional per-purpose usage and existing idempotent role lookup semantics.
- Dataset instance lifecycle contracts now include optional lifecycle metadata (`retentionPolicy`, `maxAgeDays`, `cleanupAfter`, `cleanupStatus`) for bounded retention/cleanup intent without introducing a second intermediate-storage subsystem.
- Runtime domain normalization now rejects unsupported role/status values and invalid lifecycle metadata combinations, and persistence rehydrates these fields through the same canonical dataset-instance model.

## Direction 5 extension update: system-owned binding + instance-level schema enforcement (stories 1.2.7-1.2.8)

- System dataset ownership now has an explicit binding projection contract in `domain/system-runtime/SystemDatasetBindingDomain.ts`:
  - stable system binding roles (`input`, `output`, `intermediate`) mapped from runtime dataset-instance roles,
  - explicit binding shape (`systemId`, `instanceId`, dataset asset linkage, role, purpose),
  - no duplication of ownership truth: bindings are projected from owned `DatasetInstance` entities.
- `SystemDatasetInstanceService` now exposes role-oriented binding APIs for runtime composition:
  - `bindDatasetInstanceByRole(...)` for explicit binding assertions on existing system-owned instances,
  - `getSystemDatasetBindingByRole(...)`, `getBoundDatasetInstanceByRole(...)`, and `listSystemDatasetBindings(...)` for reusable role-based lookup.
- Binding validation remains ownership-first and conflict-safe:
  - rejects cross-system binding attempts,
  - rejects binding-role mismatches against dataset-instance runtime role,
  - preserves role+purpose uniqueness semantics per system through existing repository contracts.
- Instance-level schema enforcement is now centralized in `application/system-runtime/DatasetInstanceSchemaEnforcementService.ts` and consumed by `SystemDatasetInstanceService`:
  - shape validation (`validateShapeForInstance`) and record-admission validation (`validateRecordForInstance`, `validateRecordsForInstance`) share one enforcement path,
  - admission gates (`admitRecordForInstance`, `admitRecordsForInstance`) reject invalid payloads with deterministic `invalid-request` errors,
  - enforcement resolves the linked dataset asset/schema intent from the instance boundary instead of relying on caller-local checks.
- For the image slice, media-intent records are validated through shared media contracts (`IMediaDatasetValidator` + `IMediaRecordValidator`), covering canonical image fields such as `assetRef`, `width`/`height`, `format`, `metadata`, `tags`, and `derived` attributes.
- The enforcement seam remains generic for additional schema intents: non-media intents continue through the same boundary contract without introducing UI-local or adapter-local validation duplication.

## Direction 5 extension update: image instance ingestion + query retrieval APIs (stories 1.2.9-1.2.10)

- Dataset-instance runtime records now include an explicit image-record contract in `domain/system-runtime/DatasetInstanceRecordDomain.ts`:
  - system-owned/runtime-scoped identity (`recordId`, `instanceId`, `systemId`, dataset asset linkage),
  - admitted canonical image payload (`ImageRecord`),
  - optional storage reference metadata (`reference`, `provider`),
  - bounded query criteria helpers (format/tag/dimension/asset-ref/metadata filters).
- Dataset-instance persistence now supports image record durability alongside instance state through `application/system-runtime/DatasetInstanceRepository.ts` + `infrastructure/filesystem/system-runtime/SqliteDatasetInstanceRepository.ts`:
  - save/get/list/query image records by instance boundary,
  - SQLite schema migration adds `system_dataset_instance_image_records` with indexed instance/query fields,
  - rehydration uses canonical domain normalization (no raw cast-only payload reads).
- `SystemDatasetInstanceService` now exposes bounded ingestion/retrieval APIs for image instance records:
  - `ingestImageRecordIntoInstance(...)` and `ingestImageRecordsIntoInstance(...)`,
  - `listImageRecordsForInstance(...)` and `getImageRecordFromInstance(...)`.
- Ingestion remains instance-boundary-first and system-ownership-safe:
  - requires an existing target dataset instance,
  - enforces system ownership checks before admit/read operations,
  - routes admission through existing schema enforcement (`DatasetInstanceSchemaEnforcementService`) tied to the linked dataset asset.
- Image ingestion metadata handling is now adapter-backed and reusable:
  - optional metadata extraction via existing image metadata extractor seams (`IImageMetadataExtractor`),
  - extraction can populate missing dimensions/format and merge metadata/exif into candidate records,
  - storage reference handling remains an explicit runtime concern (request-provided or derived from `assetRef`).
- Query/retrieval remains intentionally bounded for this slice:
  - deterministic list/get by instance,
  - optional simple filtering (format, tag, dimensions, asset stable id, top-level metadata equality),
  - no parallel search subsystem or UI-specific query coupling introduced.

## AI Loom Image System vertical-slice update: output materialization + generated image records (stories 2.3.1-2.3.2)

- Workflow output persistence now has a canonical system-owned materialization contract in `application/system-runtime/WorkflowOutputMaterializationContract.ts`:
  - workflow run reference (`runId`, `workflowAssetId`, optional `workflowAssetVersionId`),
  - source image reference (optional),
  - produced asset references (one-or-more), per-asset generation role (`primary` / `variant` / `intermediate`), tags, and metadata,
  - parameter snapshot,
  - timestamps (`requestedAt`, optional `startedAt`/`completedAt`, `updatedAt`),
  - lifecycle status (`pending` / `materialized` / `failed` / `partial`) and optional structured error envelope.
- The materialization contract is system-centric and execution-adapter agnostic: no ComfyUI DTO/result shape leaks into this contract.
- Dataset-instance image records now model generated outputs as first-class entry schema in `domain/system-runtime/DatasetInstanceRecordDomain.ts` via `generation` metadata:
  - output asset reference,
  - optional source image linkage,
  - workflow asset/version,
  - run identifier,
  - generation role,
  - generation metadata + tags.
- Record patch contracts now support controlled generation metadata/tag updates (`generationPatch`) while preserving canonical image payload compatibility and preview/read behavior.


## AI Loom Image System vertical-slice update: materialization service + execution-result adapter (stories 2.3.3-2.3.4)

- Output persistence now has an explicit application orchestration seam in `application/system-runtime/WorkflowOutputMaterializationService.ts`:
  - validates canonical `WorkflowOutputMaterializationPayload` requests,
  - assembles normalized image-record admission payloads from produced assets,
  - maps per-asset generation metadata via `materializationAssetToDatasetGeneration(...)`,
  - writes generated records into the target **system-owned dataset instance** through `SystemDatasetInstanceService` (not executor-specific adapters).
- Executor-shape translation is now explicitly isolated in `infrastructure/comfyui/execution/mappers/ComfyExecutionResultMaterializationMapper.ts`:
  - maps `IComfyAdapterResult` payloads into the canonical materialization contract,
  - supports multi-image outputs (`primary` + `variant` role assignment),
  - normalizes optional/unknown metadata into canonical record values,
  - keeps ComfyUI-specific result semantics out of application/domain materialization contracts.
- Boundary direction remains clean for the image vertical slice:
  - backend-specific execution payloads are translated at infrastructure adapter boundaries,
  - application services consume only internal materialization contracts,
  - dataset-instance mutation continues through system-owned runtime dataset services.


## AI Loom Image System vertical-slice update: system-owned binary output storage + provenance persistence (stories 2.3.5-2.3.6)

- Workflow output materialization now supports explicit binary artifact persistence through an internal storage seam (`application/system-runtime/WorkflowOutputArtifactStorage.ts`) rather than executor-specific paths.
- The filesystem implementation (`infrastructure/filesystem/system-runtime/LocalSystemOutputArtifactStorage.ts`) now governs pathing/naming under a system-owned root with:
  - deterministic namespace segments (`systemId`/`datasetInstanceId`/`workflowRunId`/`materializationId`),
  - filename normalization independent of backend names,
  - collision-safe suffixing,
  - stable generated output refs and inspectable storage metadata (`fileName`, `relativePath`, `sha256`, `sizeBytes`, collision index).
- `WorkflowOutputMaterializationService` now optionally coordinates that artifact storage seam before dataset-instance ingestion and writes the resolved internal refs/metadata into the admitted image records.
- Output lineage/provenance now persists through a dedicated repository seam (`application/system-runtime/WorkflowOutputProvenanceRepository.ts`) with both in-memory and SQLite implementations (`SqliteWorkflowOutputProvenanceRepository`).
- Persisted provenance records capture output asset ref, source image refs, workflow asset/version, workflow run id, runtime parameter snapshot, execution capability/config snapshots, status, and timestamps so later history/inspection/comparison work can query without re-deriving from transient executor payloads.

## AI Loom Image System vertical-slice update: failure handling, partial success, idempotency, and end-to-end persistence tests (stories 2.3.9-2.3.10)

- Materialization status handling is now explicit for pre-output failures:
  - canonical payload validation permits `status=failed` with `producedAssets=[]` for executor failures that happen before any output can be materialized,
  - non-failed payloads still require at least one produced output.
- `WorkflowOutputMaterializationService` now applies deterministic per-output idempotency using internal record identity (`matrec:<materializationId>:<assetIndex>`) so duplicate delivery/reprocessing updates existing records instead of creating duplicates.
- Per-output persistence failure handling is now bounded and inspectable:
  - artifact-persistence and dataset-write failures are captured per output,
  - successful outputs still materialize in the same request,
  - final status is derived from observed outcomes (`materialized` / `partial` / `failed`) rather than blindly echoing requested status.
- Retry behavior is now coherent across full and partial failures:
  - retries after partial success only materialize missing/failed outputs while preserving already-materialized outputs under the same deterministic ids,
  - retries after full failure can reuse the same materialization identifiers without duplicate record creation.
- End-to-end integration coverage now validates execution-result mapping through reusable persisted outputs:
  - Comfy execution result mapping -> canonical materialization payload,
  - artifact storage persistence,
  - dataset record create/update idempotency behavior,
  - provenance capture,
  - multi-output and failure/retry paths.

## Direction 5 extension update: instance mutation + lifecycle management (stories 1.2.11-1.2.12)

- Dataset-instance record mutation is now explicit and bounded through `SystemDatasetInstanceService.updateImageRecordInInstance(...)`:
  - record updates are patch-driven (image metadata/tags/derived/annotations, storage metadata, record metadata),
  - image payload mutation is normalized via canonical domain patch contracts (`patchDatasetInstanceImageRecord`),
  - all record updates are re-admitted through centralized instance schema enforcement (`DatasetInstanceSchemaEnforcementService`) before persistence.
- Dataset-instance aggregate mutation/lifecycle now has canonical domain helpers in `domain/system-runtime/DatasetInstanceDomain.ts`:
  - immutable patch updates (`patchDatasetInstance`),
  - explicit lifecycle transition guards (`isDatasetInstanceLifecycleTransitionAllowed`, `transitionDatasetInstanceLifecycle`).
- Lifecycle operations are now explicit in `SystemDatasetInstanceService` and remain role-agnostic across input/output/intermediate instances:
  - `create` (existing),
  - `load` (`loadDatasetInstance`),
  - `reset/clear runtime state` (`resetDatasetInstanceState` clears instance records and resets runtime posture without breaking asset linkage),
  - `archive/deactivate` (`archiveDatasetInstance`, `deactivateDatasetInstance`),
  - `delete/remove` (`deleteDatasetInstance`) with archive-first gating unless force is explicitly requested.
- Repository seams now support lifecycle persistence and cleanup operations directly (`DatasetInstanceRepository` + SQLite adapter):
  - delete instance by id,
  - delete single image record,
  - clear all image records for an instance.
- Mutation/version-tracking friendliness is now built into record state without adding full history infrastructure:
  - dataset instance image records include `mutationVersion` and stable `admittedAt` while `updatedAt` advances on each accepted mutation.

## Direction 5 extension update: instance isolation + dataset-instance previews (stories 1.2.13-1.2.14)

- Dataset-instance ownership/namespacing is now enforced through repository and service seams, not only caller discipline:
  - repository contracts now include explicit system-scoped lookups for instance and image-record reads (`getBySystemAndId`, `getImageRecordBySystemAndId`, `list/queryImageRecordsBySystemId`),
  - `SystemDatasetInstanceService` retrieval/admission/validation paths now require system context for instance resolution and image-record access.
- SQLite persistence now hardens record-level isolation:
  - image record identity is now instance-scoped (`PRIMARY KEY(instance_id, record_id)`) instead of globally keyed by `record_id`,
  - migration updates preserve existing rows and prevent cross-instance overwrite on shared record ids,
  - foreign-key enforcement is enabled at repository initialization.
- Dataset-instance preview support is now available through a dedicated application seam (`application/system-runtime/DatasetInstancePreviewService.ts`):
  - preview listing is instance-boundary and ownership-aware,
  - preview payloads are lightweight and UI-oriented (preview/image reference, dimensions/format, tags, bounded metadata summary, mutation timestamps),
  - preview flow remains distinct from full retrieval while reusing existing validated instance/query contracts.

## Direction 5 extension update: storage adapter abstraction for dataset instances (story 1.2.15)

- Dataset-instance persistence now depends on a narrow internal storage contract (`application/system-runtime/DatasetInstanceStorageAdapter.ts`) instead of tying repository semantics directly to SQLite concerns.
- `StorageBackedDatasetInstanceRepository` now owns application-level repository behavior and delegates persistence concerns through that adapter seam.
- The existing SQLite implementation (`infrastructure/filesystem/system-runtime/SqliteDatasetInstanceRepository.ts`) now acts as a backend adapter, preserving current behavior while allowing alternate backends to be introduced without changing `SystemDatasetInstanceService` or preview/query flows.
- Image-record storage validation for system ownership is now centralized at the repository boundary, so adapter implementations can stay focused on backend persistence mechanics.

## Direction 5 extension update: dataset preview optimization + operational lineage hooks (stories 1.3.11-1.3.12)

- Dataset preview access now supports bounded windowed retrieval through internal runtime contracts (`queryImageRecordPageBySystemId`, `listImageRecordPageForInstance`) so large collections do not require eager full-list retrieval in preview flows.
- `DatasetInstancePreviewService` now keeps preview optimization behind the service boundary:
  - consumes repository-backed paged retrieval,
  - emits bounded payload-size inspectability (`payloadSizeBytes`),
  - uses an explicit bounded in-memory preview window cache for repeated access patterns (inspectable hit metadata, max-entry bound).
- Operational dataset lineage now has a dedicated internal hook contract (`DatasetOperationalLineageSink`) with bounded in-memory implementation for this slice.
- Runtime dataset operations now emit structured lineage events with optional workflow/system context linkage:
  - preview access,
  - record reads,
  - record queries/filtering,
  - record writes/mutations (create/update/delete).
- Lineage instrumentation remains service-layer bound (`SystemDatasetInstanceService`, `DatasetInstancePreviewService`) to avoid scattering cross-cutting instrumentation across UI or persistence adapters.

## AI Loom Image Manipulation vertical-slice update: high-level workflow asset contracts (stories 3.1.1-3.1.2)

- High-level image workflow asset contracts are now defined in `application/contracts/ImageWorkflowAssetContract.ts` and validated with zod (`ImageWorkflowAssetContractSchema`).
- The canonical contract keeps image workflows reusable/versioned/composable/inspectable without leaking backend node-level details:
  - identity/type (`workflow-asset` + `image-workflow` + intent type),
  - version envelope (`contractVersion`, optional `assetVersion`, `revision`),
  - bounded input/output field descriptors,
  - bounded config field surface,
  - preview/inspection metadata (`mode`, inspectable fields, output sample limit),
  - composition metadata with explicit adapter boundary + dependency references.
- Core intent contracts now ship for four categories:
  - `image-to-image`,
  - `restyle`,
  - `enhance-upscale`,
  - `batch-transform`.
- Shared-contract interoperability is preserved through `buildAssetContractForImageWorkflowIntent(...)`, which maps the high-level intent contract into the existing `AssetContractDescriptor` model used by Workflow/System Studio seams.

## AI Loom Image Manipulation vertical-slice update: internal composition + image-to-image asset (stories 3.1.3-3.1.4)

- High-level image workflows now have a first-class internal composition model in `application/contracts/ImageWorkflowComposition.ts`.
- The model is intentionally internal-facing and adapter-bounded:
  - reusable/versioned pipeline envelope (`compositionId`, `compositionVersion`, `revision`),
  - explicit stage/step structure (`bind-inputs`, `prepare-conditioning`, `transform`, `materialize-output`),
  - canonical high-level input/output bindings separated from low-level node execution details,
  - explicit adapter boundary metadata (`image-workflow-execution-adapter` + contract version),
  - inspectability metadata (preview mode + inspectable stage ids + tags).
- Composition steps are expressed through shared internal node kinds (`CommonImageNodeContracts`) rather than raw ComfyUI graph DTOs, preserving swappable low-level adapters.
- The first concrete high-level asset now exists in `application/contracts/ImageToImageWorkflowAsset.ts`:
  - bounded image-to-image config (`variationStrength`, `resultCount`, `preserveComposition`),
  - canonical source/prompt/output binding map (`sourceImage`, `instruction`, `images`),
  - composed internal stage pipeline using the composition model,
  - preview/inspection metadata for studio discoverability.
- Discovery/registration support is provided through `ImageWorkflowAssetRegistry`, exposing high-level asset entries without leaking low-level execution graph details.


## AI Loom Image Manipulation vertical-slice update: restyle + enhance/upscale assets (stories 3.1.5-3.1.6)

- Added reusable high-level image workflow assets backed by the established 3.1.1-3.1.4 contract/composition seams:
  - `application/contracts/RestyleWorkflowAsset.ts`
  - `application/contracts/EnhanceUpscaleWorkflowAsset.ts`
- Both assets preserve a small public contract surface while keeping execution internals adapter-bounded:
  - canonical input bindings (`sourceImage`, plus style input for restyle),
  - bounded configuration with zod validation,
  - canonical output bindings (`images` for restyle, `enhancedImage` for enhance/upscale),
  - preview/inspection metadata for studio discovery surfaces.
- Internal composition reuses `ImageWorkflowComposition` and shared `CommonImageNodeContracts` node kinds (for example `prompt-input`, `sampler-wrapper`, `resize-upscale`, `save-image`) instead of exposing raw ComfyUI graph details in asset contracts.
- `ImageWorkflowAssetRegistry` default discovery entries now include all three concrete assets (`image-to-image`, `restyle`, `enhance-upscale`) via the existing registry/discovery path.
- Added focused contract/composition tests for both assets and expanded registry coverage:
  - `application/contracts/tests/RestyleWorkflowAsset.test.ts`
  - `application/contracts/tests/EnhanceUpscaleWorkflowAsset.test.ts`
  - `application/contracts/tests/ImageToImageWorkflowAsset.test.ts`

## AI Loom Image Manipulation vertical-slice update: batch transform + inspectability coherence (stories 3.1.7-3.1.8)

- Added a reusable high-level batch transform workflow asset in `application/contracts/BatchTransformWorkflowAsset.ts` on top of the existing image workflow contract/composition seams:
  - uses the same `ImageWorkflowAssetContract` + `ImageWorkflowComposition` abstractions (no parallel model),
  - supports mixed batch items for direct image refs and dataset-backed image entries through one bounded `batchItems` input contract,
  - exposes bounded shared configuration (`concurrency`, `onItemFailure`, `groupOutputsBy`, `resultCountPerItem`),
  - preserves per-item output mapping metadata (`itemId`/`status`/`lineage`) for traceable downstream persistence/lineage usage.
- Preview/inspection support for image workflow assets is now standardized through `application/contracts/ImageWorkflowAssetPreview.ts`:
  - shared preview metadata now includes intent/workflow summary, input/output summaries, bounded configuration summary, and high-level composition summary,
  - avoids leaking low-level graph/runtime details while remaining useful for studio authoring/inspection.
- Existing image workflow assets (`image-to-image`, `restyle`, `enhance-upscale`) now consume that same preview builder, making preview/inspection metadata coherent across all high-level image workflow asset types.


## AI Loom Image Manipulation vertical-slice update: registry/authoring integration + boundary hardening (stories 3.1.9-3.1.10)

- High-level image workflow assets now register through a dedicated shared registry seam in `application/contracts/ImageWorkflowAssetRegistry.ts` rather than ad-hoc in a single asset file.
- Registry entries expose stable workflow-taxonomy and authoring metadata (workflow semantic role, deterministic behavior, preview summaries, inspectable fields, and bounded configuration surface descriptors) for consistent discovery/selection/inspection/configuration flows.
- Studio authoring selector compatibility is now explicit through `ui/studio-shell/asset-selector/ImageWorkflowAssetSelectorAdapter.ts` plus a dedicated usage-context capability mapping (`workflow-image-transform`) in `application/studio-entry/AssetSelectorCapabilityRegistry.ts`; this reuses the shared selector request/response contracts rather than introducing a parallel authoring contract model.
- Composition and boundary integrity hardening now validates the full 3.1 asset set through registry-centric tests:
  - registry inclusion/discoverability + metadata/config surface exposure (`application/contracts/tests/ImageWorkflowAssetRegistry.test.ts`),
  - authoring selector projection consistency (`ui/studio-shell/asset-selector/tests/ImageWorkflowAssetSelectorAdapter.test.ts`),
  - existing preview/contract tests continue to enforce no ComfyUI leakage in high-level contracts and inspectable composition summaries.
- `ImageWorkflowAssetRegistry` default discovery now includes `batch-transform` as a first-class inspectable asset entry.
- Added test coverage for:
  - batch-transform contract/composition/output mapping boundaries (`application/contracts/tests/BatchTransformWorkflowAsset.test.ts`),
  - preview/inspection stability across all high-level image workflow assets (`application/contracts/tests/ImageWorkflowAssetPreview.test.ts`),
  - contract descriptor alignment updates for batch input mapping (`application/contracts/tests/ImageWorkflowAssetContract.test.ts`).


## AI Loom Image Manipulation vertical-slice update: system-aware input binding contracts + resolution service (stories 3.2.1-3.2.2)

- Added a domain-first, versioned input-binding contract seam in `domain/workflow-studio/WorkflowInputBindingDomain.ts` with:
  - normalized binding descriptors (`bindingId`, `inputId`, required/value type, ordered source candidates),
  - source kinds for UI form values, runtime parameters, trigger payloads, selected-image context, dataset-instance references, and constant values,
  - structured resolution diagnostics and inspectable preview metadata per resolved input.
- Added an application-layer resolver in `application/workflow-studio/WorkflowInputBindingResolutionService.ts` that:
  - resolves bindings deterministically by source priority with default fallback support,
  - returns normalized resolved values plus per-input resolution records,
  - emits structured diagnostics for missing source values and unresolved required/optional inputs.
- `WorkflowExecutionContextAssemblyService` now consumes this resolver as an orchestration seam while preserving workflow-studio execution-context contracts.
- Added focused contract/resolution tests:
  - `domain/workflow-studio/tests/WorkflowInputBindingDomain.test.ts`
  - `application/workflow-studio/tests/WorkflowInputBindingResolutionService.test.ts`

## AI Loom Image Manipulation vertical-slice update: form-value + selected-image context binding hardening (stories 3.2.3-3.2.4)

- Extended the existing input-binding resolver seam (`application/workflow-studio/WorkflowInputBindingResolutionService.ts`) with richer diagnostics and typed-resolution safeguards:
  - explicit diagnostics for missing form-field references, invalid selected-image references, and resolved value type mismatches,
  - continued deterministic source-priority resolution with inspectable preview metadata.
- `WorkflowExecutionContextAssemblyService` now supports explicit, persistable system-aware input binding metadata on workflow inputs (`input.metadata.systemInputBinding`) and maps it through the same canonical binding resolver (no parallel subsystem).
- Assembly now also reads bounded System Studio form context (`metadata.systemFormValues` / `metadata.uiFormValues`) and selected-image context metadata, allowing image-context bindings to resolve asset refs and other selected-image paths through canonical contracts.
- Invalid authored binding metadata now returns deterministic pre-execution issues (`invalid-binding-configuration`) rather than silent fallback.
- Added focused tests for typed form binding, invalid binding configuration diagnostics, and selected-image binding resolution:
  - `application/workflow-studio/tests/WorkflowInputBindingResolutionService.test.ts`
  - `application/workflow-studio/tests/WorkflowExecutionContextAssemblyService.test.ts`


## AI Loom Image Manipulation vertical-slice update: dataset-instance binding + validation diagnostics (stories 3.2.5-3.2.6)

- Extended the canonical workflow input-binding contract seam (`domain/workflow-studio/WorkflowInputBindingDomain.ts`) for dataset-instance authoring with explicit dataset linkage and resolution shape metadata (`instance` / `record` / `collection`) plus bounded record-selection selectors.
- Added reusable binding-definition validation in the domain (`validateWorkflowInputBindingDefinitions`) so malformed/ambiguous binding definitions are surfaced as structured diagnostics before runtime.
- Extended runtime resolution (`application/workflow-studio/WorkflowInputBindingResolutionService.ts`) to:
  - resolve dataset-bound inputs from declared dataset instance references (including metadata-provided `datasetInstanceReferences`),
  - support record-level and collection-level dataset resolution for image-workflow scenarios,
  - emit structured dataset diagnostics (`dataset-instance-missing`, `dataset-record-missing`, `dataset-schema-incompatible`, `dataset-resolution-shape-unsupported`) alongside existing source/type diagnostics.
- Kept binding contracts inspectable/persistable and layer-safe: domain owns binding rules + diagnostics, application orchestrates resolution/assembly, and metadata adapters provide context payloads without leaking persistence internals.
- Added focused coverage for dataset binding resolution + diagnostics and reusable validation output:

## AI Loom Image Manipulation vertical-slice update: output binding contracts + target typing (stories 3.3.1-3.3.2)

- Added a domain-first, versioned output-binding contract seam in `domain/workflow-studio/WorkflowOutputBindingDomain.ts` with:
  - canonical output target typing (`output-dataset`, `history-dataset`, `comparison-dataset`),
  - explicit binding intents and write modes (`publish-current-result`/`append-run-history`/`append-comparison-group`, `upsert`/`append`/`replace`),
  - structured record payload envelopes, lineage references, and persistence metadata for system-context dataset writes,
  - inspectable and composable binding descriptors that remain independent from ComfyUI/runtime-specific DTOs.
- Added canonical system-runtime target definitions in `domain/system-runtime/WorkflowOutputTargetDomain.ts` with explicit semantics:
  - output dataset = current/published workflow results,
  - history dataset = append-oriented durable run history,
  - comparison dataset = grouped comparable outputs for inspection.
- `SystemDatasetInstanceService` now exposes `ensureWorkflowOutputTargetInstance(...)` to provision/resolve system-owned dataset instances from target-type semantics without duplicating role/purpose logic; existing `ensureOutputImageStoreInstance(...)` now reuses this seam.

## AI Loom Image Manipulation vertical-slice update: output binding resolution + record materialization (stories 3.3.3-3.3.4)

- Added a dedicated application-layer output target resolution seam in `application/workflow-studio/WorkflowOutputBindingResolutionService.ts`:
  - resolves declared workflow output bindings into concrete system-owned dataset instances through `SystemDatasetInstanceService` (existing runtime contract reuse, no parallel dataset model),
  - validates target availability, grouping requirements, and dataset asset/version compatibility before writes,
  - emits an inspectable resolved write plan (`ResolvedWorkflowOutputWritePlanItem`) with only downstream materialization/writer fields.
- Added canonical record materialization mapping in `application/workflow-studio/WorkflowOutputRecordMaterializationService.ts`:
  - transforms execution-produced images and resolved output plans into persistable dataset-image record envelopes,
  - includes run metadata, parameter context, target metadata, provenance, generation linkage, timestamps, and derived routing fields,
  - stays execution-adapter agnostic (no ComfyUI-specific DTO coupling).
- Added focused tests under `application/workflow-studio/tests/*` for:
  - successful binding resolution,
  - missing/incompatible target validation failures,
  - write-plan generation semantics,
  - canonical output-record materialization and metadata traceability.
- Added focused target/binding coverage in:
  - `domain/workflow-studio/tests/WorkflowOutputBindingDomain.test.ts`,
  - `domain/system-runtime/tests/WorkflowOutputTargetDomain.test.ts`,
  - `application/system-runtime/tests/SystemDatasetInstanceService.test.ts`.

## AI Loom Image Manipulation vertical-slice update: history/comparison dataset write behavior (stories 3.3.5-3.3.6)

- Extended the existing output-binding write-plan contract (`application/workflow-studio/WorkflowOutputBindingResolutionService.ts`) so resolved targets now carry explicit grouping + semantic hints (`target.groupBy`, `targetSemantics`) instead of relying on implicit writer behavior.
- Extended canonical output record materialization (`application/workflow-studio/WorkflowOutputRecordMaterializationService.ts`) to keep output/history/comparison semantics distinct while staying on the same binding-resolution/materialization pipeline:
  - output dataset: current-result semantics remain upsert-friendly,
  - history dataset: append-oriented record identity + history entry metadata (`historyEntryId`, `historyEntryType`) and run-scoped output grouping for durable per-run inspection,
  - comparison dataset: explicit comparison set/member association metadata (`comparisonSetId`, `comparisonMemberId`) and stable comparison-group routing (`groupBy`/lineage fallback).
- Materialized records now preserve richer traceability across source context/workflow asset version/run/parameter context/output artifacts through shared metadata and generation envelopes (no UI-specific assumptions).
- Added targeted tests for:
  - append-oriented history writes across multiple runs with non-colliding record ids and preserved metadata,
  - explicit comparison grouping + membership persistence for sibling outputs,
  - target-behavior distinction and compatibility with existing output-binding resolution/materialization seams.

## AI Loom Image Manipulation vertical-slice update: binding preview inspection + asset-definition integration (stories 3.2.7-3.2.8)

- Added reusable binding preview/inspection orchestration in `application/workflow-studio/WorkflowInputBindingPreviewService.ts` over the existing canonical resolver path:
  - inspectable declared source metadata per binding target (source id/kind/priority/required + declared-source summary),
  - selected-source projection + bounded resolved value summaries (shape + concise summary),
  - unresolved binding projection + structured validation/resolution diagnostics in one compact output model.
- Added reusable image-workflow binding configuration seam in `application/contracts/ImageWorkflowInputBindingConfiguration.ts` so high-level workflow assets can save/load, duplicate, serialize, and inspect binding descriptors using the existing domain binding contract (`WorkflowInputBindingDomain`).
- Integrated binding-aware input configuration into all high-level image workflow asset definitions (`image-to-image`, `restyle`, `enhance-upscale`, `batch-transform`) via shared `inputBindings` authoring surface:
  - no workflow-type-specific binding model was introduced,
  - defaults cover the supported 3.2.x source kinds (UI form values, selected-image context, dataset instances, constants/defaults).
- Extended registry projection (`application/contracts/ImageWorkflowAssetRegistry.ts`) to include serialized binding configuration in discovery/inspection outputs for cross-system reuse.
- Added targeted tests:
  - `application/workflow-studio/tests/WorkflowInputBindingPreviewService.test.ts`,
  - `application/contracts/tests/ImageWorkflowInputBindingConfiguration.test.ts`,
  - updated asset/registry tests under `application/contracts/tests/*` to assert binding-aware definition surfaces.


## AI Loom Image Manipulation vertical-slice update: runtime output-persistence integration + validation coverage (stories 3.3.9-3.3.10)

- Workflow runtime execution now integrates the same output-binding pipeline used in stories 3.3.1-3.3.8 through `application/workflow-studio/WorkflowRuntimeOutputPersistenceService.ts` (binding descriptors -> write-plan resolution -> record materialization -> dataset-instance persistence), instead of introducing a parallel runtime writer path.
- Runtime output persistence is configuration-driven (`executionMetadata.workflowOutputPersistence.configuration`) and supports output/history/comparison dataset target behavior consistently via one orchestration seam.
- Execution results now carry structured output-persistence summaries (`outputPersistence`) so downstream history/UI surfaces can inspect persisted-record counts, target counts, and bounded issues without infrastructure-specific DTO leakage.
- Persistence failures after successful execution are bounded/predictable: execution result status is promoted to failed with structured persistence issue metadata, and write-plan/materialization denials fail before any dataset writes.
- Added focused runtime unit/integration coverage for success + bounded failure paths, append-oriented history behavior, comparison grouping semantics, and lineage/traceability metadata propagation.

## AI Loom Image Manipulation vertical-slice update: output gallery data contract + output dataset retrieval (stories 4.4.1-4.4.2)

- Added a canonical internal output-gallery contract in `application/system-runtime/OutputGalleryDataContract.ts`:
  - image asset/storage reference fields,
  - system-owned dataset instance reference fields,
  - workflow/run linkage,
  - optional source-image linkage,
  - admitted/updated timestamps,
  - generation parameter summaries,
  - image metadata summaries,
  - tags + derived attributes for reusable filtering/inspection.
- Added a dataset-backed retrieval seam in `application/system-runtime/OutputGalleryDatasetIntegrationService.ts` that:
  - reads records from `SystemDatasetInstanceService` (existing system-owned dataset authority),
  - projects persisted dataset records into the gallery contract with paging and inspectable summaries,
  - keeps retrieval contract-first and storage-adapter agnostic.
- This keeps output-gallery state grounded in persisted dataset state (not renderer-local ad hoc output arrays) while remaining reusable for future non-image media/document gallery surfaces via the same contract shape.

## AI Loom Image Manipulation vertical-slice update: run history contract + linked retrieval (stories 4.4.3-4.4.4)

- Added a canonical image-run-history contract in `application/system-runtime/ImageRunHistoryDataContract.ts` aligned with output-gallery fields:
  - system/workflow/run references,
  - input/output image references,
  - output dataset-instance references,
  - parameter summary, execution status, timestamps, and bounded lineage metadata.
- Added repository/service seams in `application/system-runtime/ImageRunHistoryRepository.ts` and `application/system-runtime/ImageRunHistoryService.ts` so run history remains persisted/queryable system state rather than UI-local projections.
- Run-history detail retrieval now composes with the existing output-gallery dataset integration seam (`OutputGalleryDatasetIntegrationService`) to support durable history -> output linking and future lineage displays through shared contracts.

## AI Loom Image Manipulation vertical-slice update: output selection + history/output linkage contracts (stories 4.4.7-4.4.8)

- Run-history retrieval now includes a linked-output listing seam (`ImageRunHistoryService.listRunsWithLinkedOutputs`) that composes persisted run-history records with dataset-backed output-gallery records for each run id.
- UI-facing interaction assets consume this contract-first linkage to avoid renderer-local history/output joins and preserve identifier-based traceability (`runId` + persisted record ids).
- Output selection interaction contracts now explicitly carry bounded result-context semantics:
  - selected output id,
  - active result id (system-context candidate),
  - reusable-input preparation id for later flow binding.
- The slice remains image-focused, but seams are designed to stay storage/runtime agnostic and reusable for broader media/document result-history inspection patterns.

## AI Loom Image System vertical-slice update: system context contract + mapping seam (stories 4.3.1-4.3.2)

- System context now has a formal internal contract in `domain/system-studio/SystemContextContract.ts` with explicit, inspectable fields for:
  - selected image references,
  - parameter values,
  - dataset references,
  - runtime metadata,
  - and an extension bag for additive future context without breaking consumers.
- Workflow input translation now uses a dedicated adapter seam in `application/workflow-studio/SystemContextWorkflowInputMapper.ts` (`WorkflowSystemContextBindingAdapter`) that maps the system-context contract into workflow execution context/input-binding metadata.
- UI-trigger system-context gathering remains decoupled from workflow runtime internals via `application/workflow-studio/UiTriggerSystemContextMapper.ts`, which now produces the shared system-context contract before adapter-driven workflow binding translation.
- This keeps the architecture aligned with shared composition principles: internal contracts first, UI/runtime adapters second, and no direct leakage of component-library or execution-engine-specific state shapes.

## AI Loom Image System vertical-slice update: reusable context mapping configuration (story 4.3.9)

- Added reusable/versioned mapping configuration contracts in `domain/system-studio/SystemContextWorkflowMappingConfiguration.ts` for explicit source-path -> workflow-target mapping.
- System assets can persist/reuse these mapping definitions through `SystemExecutionMetadata.workflowContextMapping` in `domain/system-studio/SystemAssetDomain.ts`.

## Direction 5 extension update: reference image system template + system-owned dataset instance plan (stories 5.1.1-5.1.2)

- Added a first-class reference image manipulation **system template contract** (`application/system-studio/ReferenceImageSystemTemplate.ts`) that composes:
  - input image dataset asset boundary,
  - output image dataset asset boundary,
  - workflow-template boundary,
  - UI boundary placeholder.
- The template declares explicit system IO contracts (`sourceImage`, `editInstruction`, `editedImages`) and binding edges at the system layer, keeping orchestration concerns in workflow assets.
- Dataset instances are modeled as **runtime-owned system instances** (not global/static dataset assets) through inspectable binding descriptors with:
  - per-instance IDs,
  - dataset asset linkage,
  - role/purpose (`input-store`/`output-store`),
  - required media schema intent and canonical image metadata record shape (`image-metadata-records`).
- Runtime provisioning is represented through `buildReferenceImageDatasetInstanceRequests(systemId)` to produce bounded `EnsureRoleDatasetInstanceRequest` contracts for `SystemDatasetInstanceService` reuse.
- Build route exposure now includes a `/build` template card that links to System Studio for this reference-image system path, keeping vertical-slice discovery inside the existing Build UX entry surface.

## Direction 5 extension update: primary image workflow binding + system context mapping (stories 5.1.3-5.1.4)

- The reference image system template now binds a concrete primary workflow-template asset (`asset:workflow-template:image-to-image:starter`) instead of a placeholder workflow id, including explicit version pinning through the existing template catalog boundary.
- The system template now exposes inspectable primary-workflow binding metadata (`primaryWorkflowAsset`) that traces:
  - workflow component alias,
  - dataset-instance binding IDs (input/output) to workflow input/output IDs,
  - workflow parameter input IDs that can be populated from system context.
- System execution metadata now includes a reusable `workflowContextMapping` contract (`ReferenceImageSystemWorkflowContextMapping`) that maps:
  - selected image -> workflow `sourceImage`,
  - user-entered parameters (`editInstruction`, `variationStrength`, `resultCount`) -> workflow inputs,
  - resolved dataset references/handles -> workflow metadata.
- This keeps mapping contract-first and adapter-driven (`WorkflowSystemContextBindingAdapter`) without leaking execution-library details into system/domain contracts.

## Direction 5 extension update: upload ingestion + UI-triggered workflow start (stories 5.1.5-5.1.6)

- System Studio now includes a reference-image experience panel that keeps user language simple (`Upload image`, `Processing settings`, `Start`, `Results`) while reusing the existing image UI component boundaries.
- Uploads from that panel flow through a backend API seam (`StudioShellBackendApi.ingestReferenceImageUpload`) which:
  - provisions system-owned input/output dataset instances from the existing reference-template requests,
  - validates/admits records through `SystemDatasetInstanceService` schema enforcement,
  - extracts metadata with the existing image metadata extractor contract,
  - persists canonical dataset image records owned by the active reference-image system draft.

## Direction 5 extension update: output dataset persistence + results visualization (stories 5.1.7-5.1.8)
- Reference-image workflow runs now persist generated outputs into the system-owned output dataset instance via a bounded Studio Shell adapter path:
  - runtime output payload -> Comfy materialization mapper -> workflow output materialization service -> output dataset instance ingestion/update.
- Persisted output records keep traceability through existing generation/provenance contracts (source image ref, workflow template ref/version, parameter snapshot metadata, run id/materialization id, timestamps).
- Studio Shell now exposes reference-image-specific backend operations for:
  - persisting generated outputs from a completed execution payload, and
  - listing output gallery entries from the system-owned output dataset instance.
- The reference-image experience panel now reads from persisted output dataset records (not transient-only UI state) and provides:
  - a non-technical-user-friendly “Generated images” gallery,
  - selection/open behavior,
  - a focused single-image view, and
  - collapsed “Settings used” details for advanced inspection.
- Start actions now reuse the existing UI trigger + system-context mapping stack (`UiTriggerSystemContextMapper` -> `WorkflowSystemContextBindingAdapter` + `ReferenceImageSystemWorkflowContextMapping`) before invoking runtime start, so selected image refs, user settings, and dataset instance refs flow into execution context without adding a parallel mapping path.

## Direction 5 extension update: basic run history + end-to-end reference-image validation (stories 5.1.9-5.1.10)
- Reference-image run history is now recorded at output persistence time via `ImageRunHistoryService`, keyed by execution/run id and tied to the same system-owned output dataset records used by the generated-results gallery.
- Studio Shell now exposes a bounded read operation (`listReferenceImageRunHistory`) for recent activity retrieval so history is queryable through runtime/persistence layers instead of UI-only transient state.
- Desktop composition now uses `SqliteImageRunHistoryRepository` for durable run-history storage; browser fallback keeps the same API contract with in-memory persistence.
- The reference-image panel now includes approachable history UX (`Recent activity`, `Run details`, `Created`, `Source image`, `Open result`, `Settings`) and lets users jump from previous runs back to saved outputs.
- Added focused integration coverage for the end-to-end vertical slice (upload -> persist outputs -> output listing -> run history listing), including assertions that run-history entries remain associated with persisted output record ids.

## AI Loom Image System vertical-slice update: shared runtime context binding + cross-studio lineage carryover (stories 5.2.5-5.2.6)
- System Studio reference-image interactions now use `SystemContextContract` as the shared runtime source of truth (selected image, parameters, dataset refs, runtime metadata), and the panel persists that context into `systemSpec.referenceImageRuntimeContext` for save/reload reuse.
- Runtime start now consumes this shared context directly and forwards it in execution metadata, avoiding per-button ad hoc context assembly.
- Output persistence now receives the same runtime context and writes lineage-ready run-history records without studio-local reconstruction logic.
- Run-history lineage now carries compact cross-studio trace fields (source image, source dataset instance/asset, workflow asset/version, system asset/version, runtime session/trace, output dataset/records) plus explicit lineage `status` and `missing` diagnostics.

## Direction 5 extension update: system serialization + asset-reference resolution seams (stories 5.3.1-5.3.2)

- System draft/version content now has a canonical serialization contract in `domain/system-studio/SystemSerializationContract.ts` (`ai-loom.system-serialization`, `schemaVersion=1.0.0`) with explicit sections for:
  - version/compatibility metadata,
  - system definition fields (components, dependencies, interfaces, bindings, execution metadata),
  - asset reference projections (dataset/workflow refs),
  - runtime-owned references/state (dataset-instance refs + runtime binding envelope),
  - UI/presentation configuration payload.
- Parsing/validation is now centralized and zod-backed at this seam:
  - unsupported serialized versions are rejected via explicit `unsupported-system-serialization-version:*` errors,
  - legacy `systemSpec` payloads remain loadable through compatibility backfill into the canonical contract shape.
- System Studio draft save/update paths now serialize through the same contract seam so persisted content carries explicit serialization metadata without breaking legacy fields used by current UI/runtime flows.
- Runtime now has a reusable asset-reference resolution layer in `application/system-runtime/SerializedAssetReferenceResolutionService.ts` that resolves serialized refs (`kind`/`assetId`/`versionId`) against repository assets and returns structured outcomes:
  - `missing-asset`,
  - `incompatible-version`,
  - `invalid-reference`,
  - `unsupported-serialized-version`.
- Runtime system reconstruction now validates/uses this resolver when loading from versions (`SystemRuntimeApplicationService`) and surfaces graceful, typed `invalid-request:serialized-reference-*` failures for unresolved serialized references instead of opaque parse/load exceptions.
- Incomplete lineage paths are explicit (`partial`/`incomplete`) with bounded missing-field hints so history/inspection surfaces can fail safely.

## Direction 5 extension update: canonical system save/load operations (stories 5.3.3-5.3.4)

- System Studio now has explicit save/load orchestration over the existing canonical serialization contract (`SystemStudioApplicationService.saveSystemDefinition` / `loadSystemDefinition`) rather than a second persistence format.
- Save behavior is canonical and repository-boundary-safe:
  - parse + validate via `parseSystemSerializationDocument`,
  - canonical reserialization via `serializeSystemSerializationDocument`,
  - persistence through existing Studio Shell draft update flows.
- Saved definitions preserve the full vertical-slice payload needed for deterministic reload:
  - system definition + bindings,
  - dataset/workflow references,
  - runtime binding configuration and runtime-owned reference envelopes,
  - UI configuration.
- Load behavior now returns reconstructed system state plus structured issues:
  - rehydrates `SystemAsset` for application/runtime consumption,
  - resolves referenced dataset/workflow assets via `SerializedAssetReferenceResolutionService`,
  - returns warning/error issues for unresolved or incompatible references so callers can degrade gracefully.

## Direction 5 extension update: dataset-instance persistence + workflow version binding (stories 5.3.5-5.3.6)

- Canonical system serialization now carries runtime-owned dataset instance state snapshots (not just references) through `runtime.datasetInstances[].persistedState`:
  - persisted instance snapshot (identity, role, lifecycle/runtime status, ownership, metadata),
  - persisted image record snapshots for system-owned image stores (input/output/intermediate when present).
- Save orchestration (`SystemStudioApplicationService.saveSystemDefinition`) now captures dataset-instance runtime state via a bounded adapter seam (`SystemDatasetInstancePersistenceService`) and writes it into the existing canonical system serialization contract (no parallel persistence format).
- Load orchestration (`SystemStudioApplicationService.loadSystemDefinition`) can restore serialized dataset-instance state back into runtime storage through the same adapter seam and surfaces structured issues when persisted state is missing or invalid (`missing-dataset-instance-state`, `invalid-dataset-instance-state`).
- Workflow reuse/version pinning is now explicit in canonical runtime metadata:
  - `runtime.workflowBindings[]` tracks workflow asset bindings by binding id + component alias + workflow asset id + pinned workflow version id,
  - pin mode is explicit (`pinMode: "version"`) to keep behavior stable now and leave clear extension points for future upgrade policies.
- Serialized reference resolution/reload behavior now validates workflow bindings alongside existing dataset/workflow asset reference arrays:
  - unpinned workflow bindings are surfaced as typed issues (`unresolved-workflow-version`) in studio load flows,
  - runtime execution load rejects unresolved pinned workflow bindings via typed serialized-reference failures.

## Direction 5 extension update: dataset asset reuse vs dataset instance duplication (story 5.3.7)

- Runtime persistence now exposes an explicit duplication mode seam in `SystemDatasetInstancePersistenceService.duplicateSystemDatasetInstances(...)`:
  - `mode="reuse"` keeps existing runtime dataset-instance references as-is (intentional shared-instance posture),
  - `mode="duplicate"` creates isolated instance copies for a target system id (new instance id + remapped persisted state ownership).
- This makes the contract distinction explicit:
  - dataset assets (`assetReferences.datasets`) stay reusable across systems,
  - dataset instances (`runtime.datasetInstances`) are runtime-owned state and can now be explicitly reused vs duplicated.
- Duplicate-mode behavior is bounded and inspectable:
  - persisted instance + image-record ownership is remapped to the target system id,
  - missing/invalid persisted state yields structured issues (`missing-dataset-instance-state`, `invalid-dataset-instance-state`) so callers can report partial duplication outcomes safely.

## Direction 5 extension update: full system duplication (story 5.3.8)

- System Studio now has canonical deep-copy orchestration through `SystemStudioApplicationService.duplicateSystemDefinition(...)`:
  - creates a new draft/system identity,
  - duplicates serialized runtime dataset instances by default (`datasetInstanceMode="duplicate"`),
  - preserves reusable dataset/workflow asset references,
  - preserves workflow version bindings and UI configuration via the same canonical serialization/save/load contract.
- Duplication reuses existing serialization boundaries (`parseSystemSerializationDocument` + `serializeSystemSerializationDocument`) instead of introducing a one-off clone format.
- Duplicate load safety remains structured:
  - reference resolution + workflow pinning checks run on duplicated payloads,
  - runtime dataset-instance restore uses existing persistence adapters and returns typed issues for partial failures,
  - source and duplicate avoid mutable runtime aliasing when duplicate mode is used.

## Direction 5 extension update: partial system modification support (story 5.3.9)

- System Studio now supports canonical partial modifications on existing drafts through `SystemStudioApplicationService.modifySystemDefinition(...)`:
  - workflow binding replacements (binding id -> workflow asset/version pin),
  - dataset-instance binding replacements (instance id -> dataset asset/version),
  - bounded runtime-state patching and UI-configuration patching.
- Modifications are contract-preserving and non-mutating to source drafts:
  - the service re-parses the existing canonical serialization contract,
  - updates runtime/workflow/dataset references in one place,
  - reserializes through `serializeSystemSerializationDocument(...)`,
  - and persists through the existing Studio Shell draft update path.
- Integrity rules remain explicit and inspectable:
  - missing binding ids or dataset-instance ids are rejected as typed invalid requests,
  - workflow/dataset references are reprojected into canonical `assetReferences` and dependencies,
  - post-update reference issues still flow through the existing `SerializedAssetReferenceResolutionService`.

## Direction 5 extension update: save/load UI integration in System Studio (story 5.3.10)

- System Studio now exposes a user-friendly lifecycle panel (`SystemStudioWorkManagementPanel`) with non-technical language for:
  - save work,
  - open saved setup (as editable copy),
  - make a copy,
  - rename this work.
- The panel reuses canonical backend seams (no parallel UI save/load logic):
  - `saveSystemDefinition`,
  - `loadSystemDefinition`,
  - `duplicateSystemDefinition`,
  - `modifySystemDefinition`.
- Technical/system-level controls are still available, but only in a collapsed-by-default Advanced section near the bottom of the panel.
- Renderer/browser fallback and desktop bridge contracts now include matching system-definition IPC methods so behavior is consistent across host environments.

## Direction 5 extension update: end-to-end execution flow validation + dataset runtime schema enforcement (stories 5.4.1-5.4.2)

- Reference-image execution now runs through an explicit step-tracking service seam (`ui/runtime/ReferenceImageExecutionFlowService.ts`) that reports user-facing progress/failure states across:
  - run start,
  - runtime generation,
  - output saving,
  - result refresh.
- Step state semantics are normalized (`started`, `running`, `completed`, `failed`, `partially-completed`) and surfaced in plain language in System Studio (`Run started`, `Generating result`, `Saving result`, `Couldn’t finish this image`) while preserving technical diagnostics in collapsed advanced details.
- Runtime output persistence no longer silently defaults malformed image record fields in `WorkflowOutputMaterializationService`:
  - width/height/format are now required for produced runtime image records,
  - malformed records are rejected as structured invalid-request failures,
  - failed/partial save outcomes propagate through persistence status + run-history status instead of silently admitting corrupted records.
- This keeps dataset integrity/schema enforcement in internal contracts/services (materialization + dataset-instance admission) rather than UI or Comfy-specific transport layers, and ensures output gallery/preview only reflects validated persisted records.

## Direction 5 UI extension update: UI asset contract versioning + architecture documentation baseline (stories 1.1.9-1.1.10)

- UI asset contracts now include a first-class contract version marker (`contractVersion`) on the shared base contract in `ui/studio-shell/studio-assets/StudioAssetContracts.ts`.
- Versioning remains taxonomy-aligned and shared across all UI asset kinds:
  - atomic UI assets,
  - composed UI assets,
  - system/page assets.
- Registration/discovery in `StudioAssetRegistry` now carries normalized contract version identity (`StudioAssetRegistration.contractVersion`) rather than introducing a parallel version model.
- Metadata expectations remain shared and unchanged in shape (identity/display/classification/discovery/capability fields), with version identity carried separately for compatibility checks.
- Renderer resolution expectations remain registry-driven (`resolveRendererById`, `resolveRenderersByKind`, `resolveRenderersByCategory`) and version-agnostic at render time; version checks happen in composition validation/serialization seams.
- Composition validation (`StudioAssetComposition`) now includes version compatibility checks (`asset-version-mismatch`) when serialized node versions diverge from registered asset contract versions.
- Serialization/deserialization expectations are now explicitly version-aware:
  - composition documents have schema versions,
  - v1 payloads are migrated through a bounded migration seam into current shape,
  - nodes can carry `assetVersion` so persisted compositions preserve the authored contract version marker.
- Migration hooks are intentionally lightweight (single bounded migrator path) to keep future schema evolution simple without a full migration framework.
- Architectural direction remains explicit:
  - studios are embeddable assets in the same shared registry/discovery system,
  - recursive composition is supported (including nested system/page structures) through existing composition rules + validation boundaries.

## Direction 5 UI extension update: asset library browsing + insertion flow foundation (stories 1.2.1-1.2.2)

- A reusable Asset Library discovery projection now sits on top of the existing shared studio asset registry (`ui/studio-shell/studio-assets/StudioAssetLibrary.ts`) and preserves existing taxonomy/category groupings (`atomic-ui`, `composed-ui`, `system-page`) instead of introducing a parallel classification model.
- A reusable library panel UI now renders grouped registered UI assets with metadata-first labels (display name, optional description, grouping/category, optional icon token) and optional insert actions (`ui/components/studio-shell/studio-assets/StudioAssetLibraryPanel.tsx`).
- A generic insertion seam now creates instance nodes from registered definitions and inserts them into composition trees through existing slot/region contracts and validation rules (`ui/studio-shell/studio-assets/StudioAssetInsertion.ts`).
- Insertion outcomes are explicit and structured (`ok` success vs typed failure kinds for unknown asset/parent, invalid placement, and validation-denied insert), keeping the distinction between definition browsing and composition instantiation explicit.
- Composition validation enforcement is reused from the existing registry-backed composition validator (`StudioAssetRegistry.validateCompositionTree`), including placement rules, allowed child kinds/types/categories, and cardinality checks.

## Direction 5 UI extension update: asset inspector + schema-driven property contracts (stories 1.2.3-1.2.4)

- Studio UI asset contracts now expose an optional reusable property-schema contract (`StudioAssetPropertySchema`) directly on `propsSchema` so definition-level editor metadata and instance-level configuration stay aligned across the existing taxonomy (`atomic`, `composed`, `system-page`) instead of introducing a parallel inspector format.
- Property schema contracts support:
  - simple fields,
  - grouped sections,
  - labels/help text/placeholders,
  - default values,
  - editor kinds (`text`, `textarea`, `number`, `boolean`, `select`, `json`),
  - optional hidden/read-only and conditional visibility rules.
- Shared schema utilities (`ui/studio-shell/studio-assets/StudioAssetPropertySchema.ts`) provide default projection, visibility filtering, required-field validation, and nested field-path updates for instantiated asset config documents.
- A reusable Asset Inspector panel (`ui/components/studio-shell/studio-assets/StudioAssetInspectorPanel.tsx`) now renders selected instance metadata and schema-driven property editors with validation feedback/unsupported-property messaging, and is surfaced alongside the existing library panel through optional selected-instance props (`StudioAssetLibraryPanel`).
- Base property schemas are now registered for atomic UI primitives and current composed/system studio surfaces via existing definition registration seams (`StudioUiPrimitiveAssetContracts`, `StudioSurfaceAssetDefinitions`), preserving definition-vs-instance boundaries while enabling inspector-driven editing without hardcoded per-asset forms.


## Direction 5 UI extension update: selection-bound inspector editing + atomic preview rendering (stories 1.2.5-1.2.6)

- Asset Inspector binding now reuses the existing authoring-selection pattern (root document + selected instance id) through a shared selection utility (`ui/studio-shell/studio-assets/StudioAssetSelection.ts`) instead of introducing inspector-local selection state.
- Selection binding is definition/instance explicit:
  - registered asset definitions are still resolved from `StudioAssetRegistry`,
  - selected instantiated nodes are resolved from composition trees by node id,
  - inspector edits update selected instance config payloads while keeping registration metadata immutable.
- `StudioAssetInspectorPanel` now supports selection-context binding (`compositionRoot` + `selection`) and updates cleanly across no-selection/selection-change transitions, while preserving the previous direct selected-node prop for compatibility.
- Validation/error feedback remains schema-driven via existing property schema utilities; unsupported assets still render friendly empty/fallback messaging.
- Atomic preview rendering is now a reusable contract-level projection (`StudioAssetPreview`) with a lightweight React rendering surface (`StudioAssetPreviewCard`) that avoids full runtime/page orchestration.
- Preview behavior stays taxonomy-aligned:
  - atomic assets render control-level previews,
  - composed/system assets degrade to summary-mode preview cards,
  - unsupported preview hooks fail gracefully with explicit user-facing fallback text.
- The Asset Library and Inspector now consume the same preview projection path so preview behavior is reusable across current and future authoring surfaces without introducing a parallel preview architecture.


## Direction 5 UI extension update: default UI asset configuration + nested selection navigation (stories 1.2.7-1.2.8)

- UI asset insertion now resolves instance configuration through one shared default-config seam (`ui/studio-shell/studio-assets/StudioAssetDefaults.ts`) derived from existing property-schema defaults, so atomic, composed, and system/page assets receive consistent initial config without a parallel defaults framework.
- Insertion flows (`StudioAssetInsertion`) now apply those resolved defaults before composition validation/serialization, preserving existing composition-tree persistence, validation, and preview behavior while allowing caller-provided overrides.
- Selection binding now supports nested hierarchy context (`path`, `focusedNode`, stale-selection detection) in `StudioAssetSelection`, so authoring surfaces can distinguish selected child instances from parent drill-in context and navigate back up safely.
- Asset Inspector now renders breadcrumb-style hierarchy navigation and stale-selection guidance using the same shared selection model, keeping nested parent/child inspection behavior generic for current and future authoring surfaces.

## Direction 5 UI extension update: asset-library filter facets + replace-asset flow (stories 1.2.9-1.2.10)

- Asset Library search/filter behavior remains registry-first and taxonomy-aligned (`ui/studio-shell/studio-assets/StudioAssetLibrary.ts`):
  - query filtering now supports metadata facets (`group`, `contractCategory`, `tags`) in addition to existing keyword search and category scoping,
  - filter options are projected from currently registered assets (`listStudioAssetLibraryFilters`) so current and future studios share one metadata-driven filter model rather than UI-local hardcoded facets,
  - unsupported or missing metadata values are handled safely (empty facet options, no crashes) and the panel keeps non-technical primary labels (`Group`, `Asset type`, `Topic`).
- Asset Library panel UI (`ui/components/studio-shell/studio-assets/StudioAssetLibraryPanel.tsx`) now exposes reusable search + facet controls over the same library query seam, preserving existing grouped taxonomy sections and empty-result behavior.
- Replace-asset behavior is now implemented as a reusable composition utility (`ui/studio-shell/studio-assets/StudioAssetReplacement.ts`) rather than panel-local mutation logic:
  - candidate listing (`listCompatibleStudioAssetReplacements`) distinguishes compatible replacement definitions from incompatible entries with explicit compatibility reasons,
  - replacement execution (`replaceStudioAssetInCompositionTree`) swaps instantiated node asset identity/version while preserving node identity and reusing schema-default config projection,
  - safe config carry-forward keeps only overlapping schema field paths from the original instance, then re-validates through the existing registry composition validator.
- Replacement enforcement stays on existing validation/composition boundaries (parent placement rules, kind/type/category compatibility, cardinality, nesting, version checks) by validating the rewritten composition tree through `StudioAssetRegistry.validateCompositionTree`.
- Asset Inspector now surfaces a bounded replace flow (`StudioAssetInspectorPanel`) tied to selected instances/composition root and returns replacement outcomes through an optional root-update callback, keeping selection/inspector authoring behavior aligned with shared selection infrastructure.

## Direction 5 UI extension update: System Studio scope narrowing + page model foundation (stories 2.1.1-2.1.2)

- System Studio now treats page composition as its primary authoring unit through a normalized page model (`systemSpec.pages`) that carries:
  - stable page identity (`pageId`),
  - display title/description,
  - page metadata hooks,
  - layout structure hooks (`layoutKind`, region ids, default region),
  - optional runtime navigation hooks (`route`, deep-link posture, nav grouping/session requirements).
- The page model is integrated through existing system-studio draft parsing/serialization seams (not a parallel asset taxonomy) and keeps backward compatibility for legacy `heading` fields in persisted drafts.
- System Studio canvas/wizard language and affordances now emphasize high-level page structure/sections.
- Panel-internal authoring is explicitly de-emphasized in the System Studio surface and remains aligned to embedded panel studio flows.
- Shared embedded dataset/workflow draft persistence now remains in the existing `systemSpec.sharedDocument` seam rather than being mirrored into per-panel embedded content payloads.

## Direction 5 UI extension update: panel layout variants + header configuration in embedded panel studio (stories 2.2.7-2.2.8)

- `ui-composed:panel` now exposes schema-driven panel configuration for both layout and header behavior through the existing property schema + Asset Inspector flow (no panel-specific parallel editor contract):
  - layout mode (`vertical-stack`, `horizontal-split`, `grid`),
  - spacing (`layout.gap`) and bounded grid columns (`layout.columns`),
  - header visibility/title/subtitle and lightweight action placeholder hooks (`header.showActions`, `header.primaryActionLabel`).
- Panel configuration is normalized through shared panel asset helpers (`resolvePanelContainerConfig`) and remains persisted in the composition root config (`asset-composition` content), so serialization/deserialization stays on existing registry-backed seams.
- Default panel composition roots now seed both layout and header config, and legacy/partial configs degrade safely back to supported defaults instead of throwing.
- Embedded Panel Design Studio now surfaces a user-friendly section behavior summary while keeping editing in the shared inspector/property-schema model.

## Direction 5 UI extension update: panel empty states + persisted panel composition architecture (stories 2.2.9-2.2.10)

- Panel composition state is now resolved through one shared helper (`resolvePanelCompositionState` in `ui/studio-shell/experience-assets/PanelAssetCompositionState.ts`) so embedded panel authoring and runtime preview use the same status model for:
  - empty/new panels with no child assets,
  - configured layout/header panels with no content yet,
  - invalid/incomplete composition payloads,
  - unresolved child asset references.
- Embedded Panel Design Studio now renders reusable non-technical guidance notices for those states and keeps the same shared Asset Library + Asset Inspector flows for recovery/action, instead of panel-local one-off fallback copy.
- Panel Design Studio now keeps the active composition root in local authoring state and syncs from persisted draft content updates, so repeated inspector/library edits apply against the latest panel composition while still writing through the existing system draft persistence seam (`setDraftContent` -> `systemSpec.canvasAuthoring.pageLayouts`).
- Runtime interface preview now surfaces panel-composition status (empty/unresolved/invalid) using the same shared resolver for `asset-composition` panel content, so page-level preview does not silently show blank sections when panel content is missing or broken.
- Responsibility boundaries in this slice remain explicit:
  - **System Studio canvas** owns page structure, panel placement, and selecting which panel to edit.
  - **Embedded Panel Design Studio** owns panel-internal composition (slots, child assets, panel config).
  - **Asset Library + Asset Inspector** inside panel design own child insertion, replacement, and schema-driven config edits.
  - **System draft serialization/deserialization** remains the persistence backbone for panel identity/layout/content metadata (`SystemStudioDraftDocument` + existing registry-backed composition serialization).


## Direction 5 extension update: schema asset contract + entity/table model foundation (stories 3.1.1-3.1.2)

- Shared taxonomy now includes `schema` as a first-class atomic semantic role (`atomic/schema/none`) instead of overloading dataset, pipeline, or UI-only roles.
- Taxonomy-driven contract projection now supports `schema` in `CompositionAssetContractResolver` with bounded schema-authoring contracts (JSON-schema I/O posture + dialect/entity-scale parameters).
- A canonical schema-domain contract now exists in `domain/schema-studio/SchemaStudioDomain.ts` and follows existing studio-shell asset metadata/taxonomy conventions.
- Schema asset documents are versioned (`schemaVersion=1.0.0`) and now define reusable entity/table units via `SchemaEntityDefinition`:
  - stable id (`entityId`),
  - name + optional label/description,
  - field-collection hooks (inline ids or referenced collection assets),
  - optional metadata and optional canvas layout metadata for future schema-canvas authoring.
- Bounded relationship declarations (`SchemaRelationshipDefinition`) are included with entity-id endpoint references so future ERD-style modeling can layer in without introducing runtime/pipeline semantics here.
- Deterministic validation + persistence helpers are now explicit (`createSchemaAssetDocument`, `serializeSchemaAssetDocument`, `deserializeSchemaAssetDocument`) with duplicate-id checks and relationship endpoint validation.
- Scope remains intentionally foundational: no full field editor, no ERD interaction tooling, and no execution behavior stack is introduced in this slice.
