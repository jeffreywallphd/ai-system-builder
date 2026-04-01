# Shared Asset Contracts (Foundation Slice)

## Purpose
This note captures the minimal integration seam that complements shared taxonomy with a shared asset-contract model.

## Taxonomy vs contract
- **Taxonomy** classifies what an asset is (`structuralKind`, `semanticRole`, `behaviorKind`).
- **Asset contract** describes how an asset is used (input/output surface, configurable parameters, and optional execution metadata).

These concerns remain separate and compatible.

Specialized composite semantics remain explicit in these shared contracts: workflow = orchestrator, agent = decision unit, context-bundle = input preparer.

## Shared contract model
- Inner-layer contract types live in `domain/contracts/AssetContract.ts`.
- The model is intentionally compact:
  - input shape
  - output shape
  - public parameters/config surface
  - optional execution metadata

## Resolver/projection seam
- `application/contracts/CompositionAssetContractResolver.ts` projects contracts from existing entities without requiring broad entity rewrites.
- Current grounded projections include:
  - workflows
  - agents
  - tool capabilities
  - context packages
  - context recipes
- Bounded taxonomy-driven projections cover atomic roles and all planned Direction 5 composite roles without creating a second contract system:
  - `dataset`
  - `model`
  - `config-profile`
  - `workflow`
  - `context-bundle`
  - `dataset-pipeline`
  - `training-recipe`
  - `tool-chain`
  - `app-template`
  - `system`
- Projections are intentionally taxonomy-combination aware (structural + semantic + behavior). Unsupported combinations return no projection, which keeps publish enforcement truthful and bounded.
- Canonical-entity contract resolution now includes workflow definitions plus installed/base models and execution artifacts when matching repositories/catalogs are wired.
- Direction 5 atomic studios now use this same taxonomy-driven contract seam for authoring/publish enforcement:
  - Model Studio and Dataset Studio publish with `atomic/*/none` contract projections.
  - Tool Studio publish supports `atomic/tool/(conditional|deterministic)` projections.
- Shared Studio Shell publish-time enforcement now evaluates composite drafts through the same resolver seam for taxonomy and contract consistency (no separate composite enforcement stack).
- System Studio contract projection now extends the same shared resolver seam with bounded recursive projection (`resolveSystemContract`) so system contracts truthfully reflect explicit system I/O/parameters, child bindings, and nested-system topology without creating a parallel contract model.
- System Studio now has first-class interface/config authoring operations (`updateSystemInterfaces`, `updateSystemParameters`) so explicit system inputs/outputs/parameters/default values persist through the real draft/update/validate/publish/reload path and are consumed directly by recursive contract projection.
- System Studio now also includes bounded execution metadata authoring (`updateSystemExecutionMetadata`) for runtime/environment hints, orchestration posture, publish/export metadata, execution profile metadata, and operational ownership metadata; this remains metadata-only and does not introduce a parallel runtime/deployment stack.
- Registry/system detail lineage surfaces now make system version lineage explicit with bounded nested-system/child-version reference alignment (`includedInUpstream`) so recursive system-of-systems derivation remains deterministic and grounded in canonical version/upstream truth.
- System publish enforcement now extends the same shared studio-shell enforcement seam with bounded recursive checks for system child references/contracts, binding endpoint compatibility, and recursion cycle/depth safety before publish.
- Tool Chain Studio now reuses this same composite publish-consistency seam (`tool-chain`/`deterministic`) and the shared taxonomy-driven contract projection (`executionOrdering=sequential`) for draft authoring and publish gating.
- Workflow Template assets now include explicit composition-mapping contracts (workflow interface refs, template input/output bindings, parameter mappings, optional system-context mappings) plus parameter-definition contracts with safe default/override validation, keeping template orchestration asset-first and runtime-agnostic.
- Workflow Template deep compatibility checks are now concretely wireable through a canonical workflow-contract resolver adapter (asset-id to workflow contract), and parameter contracts now support formal cross-parameter dependency rules (`requires-when-set` / `requires-when-equals`) validated during parameter application.
- Cross-studio end-to-end consistency coverage now verifies that projected contracts remain stable through create/update/validate/publish/reload paths over shared shell seams.

## Canonical read integration seam
- Canonical operational reads now carry optional `contract` alongside canonical identity/taxonomy/provenance/dependency metadata.
- `CanonicalEntityReadResolver` is the preferred seam for reading taxonomy + contract together where available.
- Agent Studio output/memory asset exploration now reuses canonical asset-management reads (`loadAssetDetail`, `listVersionChain`) so run/session references stay asset-native and lineage-friendly instead of introducing agent-only output APIs.

## Scope boundaries
- This is an integration foundation only.
- It does **not** add a full system-composer UI, contract editor UI, or a parallel agent-only contract universe.
- Agents continue to extend the shared composition model and use the shared contract seam.
- Direction 5 atomic studio slices now consume taxonomy-driven atomic contract projection for Prompt Template, Embedding Index, and Config Profile (`atomic/prompt-template/none`, `atomic/embedding-index/none`, `atomic/config-profile/none`) through shared shell metadata + publish-enforcement seams.

## Implementation status snapshot (Direction 5 through stories 5.24)

Fully implemented now:
- Shared taxonomy-driven contract projection for implemented atomic and composite Studio Shell roles.
- Composite publish-time consistency enforcement through shared seams (`evaluateCompositeStudioDraftConsistency` / `assertCompositeStudioDraftPublishConsistency`) across Workflow, Context Bundle, Dataset Pipeline, Training Recipe, and Tool Chain studios.
- Composite-to-atomic interop coverage through shared dependency + contract/taxonomy validation paths (no studio-specific contract stacks).

Partially implemented / bounded:
- Contract projections are baseline interaction contracts for authoring/publish-gating alignment; they are not a full runtime behavior execution contract system.

Not implemented in this slice:
- Rich visual/system-runtime contract tooling beyond current bounded System Studio panels and shared publish enforcement.

## Direction 5 update: Runtime execution contract + dependency resolution foundation (stories 6.3–6.4)

- Runtime now has an explicit execution-contract mapping seam in `application/system-runtime/RuntimeExecutionContractMapping.ts`.
- Mapping stays derived from existing shared system contract truth (`CompositionAssetContractResolver.resolveSystemContract`) plus system definitions, rather than creating a second contract universe.
- Runtime execution contract mapping now projects:
  - runtime execution inputs/outputs
  - runtime execution parameters/configuration (system-authored + contract-derived)
  - runtime-visible child component interface references for atomic/composite/system children
  - bounded recursive nested-system traversal status for system-of-systems readiness.
- Runtime now has an explicit dependency-resolution seam in `application/system-runtime/RuntimeDependencyResolution.ts`.
- Dependency resolution reuses existing version-aware recursive dependency truth (`collectSystemDirectDependencies` + nested-system traversal) and does not create a second dependency graph model.
- Recursive resolution is bounded and cycle-safe, producing deterministic runtime-oriented outputs (resolved component set, direct/transitive dependencies, ordering hints) suitable for later execution-plan construction without implementing the runtime planner/orchestrator in this slice.


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

- Runtime orchestration now enforces bounded runtime-state retention in hot paths (trace events, trace logs, runtime errors, and progression history) so long-running iterative/autonomous requests stay memory-bounded.
- Pathological runtime bound requests now fail deterministically as `invalid-request` (for depth, iteration/planning-cycle, and runtime-state retention limits) instead of allowing runaway progression.
- Runtime execution persistence now has bounded retention behavior:
  - in-memory runtime execution store prunes oldest records when capacity is exceeded
  - SQLite runtime execution store prunes oldest persisted records when capacity is exceeded.
- These safeguards preserve current correctness/version-aware behavior while avoiding speculative infrastructure (no distributed scheduler/queue/observability architecture added).

## Direction 5 update: Runtime documentation alignment (story 6.24)

- Runtime architecture docs now align to implemented seams through stories 6.1–6.23 and explicitly distinguish:
  - implemented behavior (runtime domain, mapping/resolution, environment/plan, orchestration/step execution, state/trace/recovery, API/UI/status/result, persistence, version awareness, nested systems, and bounded stability controls),
  - bounded/partial behavior (single-host bounded loops/planning, bounded retention/read-model summaries),
  - future work (broader scheduling/distributed execution/advanced observability not yet implemented).

## Direction 5 update: Runtime input validation + output serialization (stories 7.5–7.6)

- External runtime execution now validates invocation payloads through a centralized seam (`application/system-runtime/RuntimeInputValidationService.ts`) before orchestration begins.
- Validation is derived from existing runtime execution contract truth (`RuntimeExecutionContractMapping` + resolved system contract) and stays bounded to current model expressiveness:
  - missing required inputs,
  - unsupported input keys where contract semantics are explicit,
  - bounded parameter/config object shape and declared type checks.
- Validation failures are deterministic and structured (`RuntimeValidationError`) and are returned to runtime API consumers as `invalid-request` responses with machine-readable issue lists.
- Runtime result retrieval now uses a transport-layer serialization seam (`infrastructure/api/system-runtime/RuntimeOutputSerializer.ts`) that projects:
  - version-aware execution identity,
  - execution summary,
  - contract-labeled output payload entries,
  - bounded nested-system summaries,
  - bounded diagnostics summary + entries.
- Serializer behavior is intentionally thin over existing runtime result truth and does not re-derive execution business logic.

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

## Direction 5 extension update: derived attributes + media schema validation layer (stories 1.1.5-1.1.6)

- Canonical image-record contracts now include a typed derived-attributes seam (`domain/dataset-studio/contracts/ImageDerivedAttributes.ts`) with bounded fields (`aspectRatio`, `orientation`, `isAnimated`, `pixelCount`, `megapixels`) while preserving canonical record extensibility.
- Derived-attribute computation is now explicit and swappable through an internal contract (`IImageDerivedAttributeCalculator`) with a default application-layer implementation (`DefaultImageDerivedAttributeCalculator`), keeping computation separate from ingestion extraction and validation plumbing.
- `ImageIngestorAsset` now computes derived fields from canonical dimensions/format before record finalization, and outputs those derived values through canonical media metadata for downstream preview/runtime usage.
- Media validation now has explicit domain-level contracts (`IMediaRecordValidator`, `IMediaDatasetValidator`) and normalized result/diagnostic payloads, with zod-backed adapter implementations confined to `application/dataset-studio/adapters/validation/*`.
- Media schema-intent validation now routes through that shared media dataset validator seam (no parallel validation stack), covering assetRef shape, dimensions, format allow-list alignment, metadata/tags compatibility, and derived-attribute shape checks.
- Runtime canonical-shape validation now reuses the same media dataset validator seam for `image-metadata-records`, so ingestion/runtime validation behavior is inspectable and consistent.

## Direction 5 extension update: media dataset compatibility + image preview support (stories 1.1.7-1.1.8)

- Media datasets continue to register/load through the same `DataAssetRegistry` and `CanonicalDataAsset` contracts; no media-only asset registry/runtime path was introduced.
- Shared dataset inspectability metadata now derives preview-mode hints from schema-intent metadata (`previewHint`) when explicit preview modes are not configured, keeping preview capability discoverable through common descriptor contracts.
- Image preview shaping now runs through the shared `DataPreviewEngine` using a dedicated mapper seam (`application/data-studio/ImageDatasetPreviewBuilder.ts`) instead of UI-local parsing logic.
- `image-metadata-records` previews now expose schema-aware image fields per item:
  - image reference/id
  - width/height
  - format
  - selected metadata summary
  - tags
  - derived attributes
- Preview mapping is resilient to partial/malformed image records and surfaces bounded warning diagnostics instead of failing preview generation.
- Data Studio preview UI now renders bounded thumbnail-oriented image rows (where a preview source is available) with graceful fallbacks for missing references/metadata.

## Direction 5 extension update: media tagging/annotations + schema-aware image ingestion (stories 1.1.9-1.1.10)

- Canonical image-record contracts now include first-class lightweight annotations (`domain/dataset-studio/contracts/ImageAnnotations.ts`) and integrate them into `ImageRecord` normalization/creation (`domain/dataset-studio/contracts/ImageRecord.ts`) alongside normalized tags.
- Annotation support is intentionally bounded and inspectable for dataset/workflow/system interoperability:
  - optional `caption`, `description`, `note`
  - optional bounded `labels`
  - optional simple region reference (`x/y/width/height`, pixel coordinate-space support).
- Media validation seams remain adapter-backed and library-agnostic at the domain contract boundary:
  - image-record validation (`ZodImageRecordValidator`) now validates/normalizes tags + annotations
  - media-dataset validation (`ZodMediaDatasetValidator`) now maps/validates annotations from canonical image metadata records.
- Schema-aware ingestion now extends the shared unified ingestion architecture (no parallel media ingestion stack):
  - unified ingestion requests can carry `schemaIntentId`
  - media schema intent (`media`) can force canonical image metadata output targeting
  - advanced unified ingestion config now supports image tag/annotation passthrough (`imageTags`, `imageAnnotations`)
  - routed image ingestion forwards those values into `ImageIngestorAsset`.
- `ImageIngestorAsset` now supports tags/annotations in config/request and emits them in normalized metadata/preview payloads while preserving existing canonical image record flow.
- Image detection/ingestion behavior is now more robust for schema-aware media inputs:
  - ingestion may proceed when probe-confirmed image metadata is valid even if extension/content-type are ambiguous
  - unsupported formats are still rejected with explicit diagnostics
  - partial metadata remains tolerated when a valid canonical image record can be constructed.
- Shared preview compatibility is preserved and extended:
  - `ImageDatasetPreviewBuilder` and Data Studio preview surface now expose annotations in image preview rows
  - records without annotations remain backward-compatible.

## Direction 5 extension update: media versioning + workflow compatibility contracts (stories 1.1.11-1.1.12)

- Media dataset assets now expose inspectable versioning through the same shared dataset-asset inspection/registry seams:
  - dataset version id,
  - dataset schema version,
  - dataset contract version,
  - revision,
  - published version id,
  - schema-intent contract version.
- Canonical image-record version handling now has explicit bounded compatibility rules in a shared domain helper (`domain/dataset-studio/contracts/ImageRecordVersioning.ts`) that reuses existing dataset version parsing/comparison conventions instead of creating a media-only versioning stack.
- Media validation now enforces bounded image-record schema-version compatibility (invalid/incompatible versions fail validation) while preserving backward-safe defaults for legacy records with missing schema-version declarations.
- Workflow dataset-input contracts now include an inspectable compatibility descriptor seam (`application/workflow-studio/WorkflowDatasetCompatibilityContracts.ts`) on the existing input-binding/context-assembly path (no parallel workflow pathway):
  - generic dataset-reference compatibility for all dataset inputs,
  - media image-record compatibility contracts when inputs declare media intent (`schemaIntentId=media` / `shapeKind=image-metadata-records` / `recordContract=image-record`),
  - stable workflow-facing media fields: `assetRef`, `width`, `height`, `format`, `metadata`, `tags`, `derived`, `annotations`,
  - optional selected-field subset projection for bounded dataset-selection compatibility.

## Direction 5 extension update: media adapter containment hardening (story 1.1.13)

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

## Direction 5 extension update: canonical image dataset records + runtime access layer (stories 1.3.3-1.3.4)

- Canonical image records used inside runtime dataset instances are now explicitly modeled as inspectable/versionable contracts:
  - image payload keeps canonical media fields (`assetRef`, `width`, `height`, `format`, optional `mimeType`, metadata, tags, derived attributes, optional annotations, schema version),
  - dataset-instance envelope keeps runtime-operational identity/provenance (`recordId`, `instanceId`, `systemId`, dataset asset linkage, record metadata, runtime provenance fields, admitted/updated timestamps, and mutation version).
- Runtime dataset instance access is exposed through existing internal service/repository seams (not direct persistence calls in workflows/systems):
  - create/add (`ingestImageRecordIntoInstance`, batch ingest),
  - read/get (`getImageRecordFromInstance`, batch get by ids),
  - list/query (`listImageRecordsForInstance` with bounded query contract),
  - update (`updateImageRecordInInstance` with patch contracts),
  - delete/remove (`deleteImageRecordFromInstance`, delete-all for instance).
- Persistence remains adapter-bounded (`DatasetInstanceRepository` over `DatasetInstanceStorageAdapter` with SQLite adapter implementation), so future non-image dataset intents can reuse the same runtime boundary pattern without leaking backend details.

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
  - `domain/workflow-studio/tests/WorkflowInputBindingDomain.test.ts`
  - `application/workflow-studio/tests/WorkflowInputBindingResolutionService.test.ts`
  - `application/workflow-studio/tests/WorkflowExecutionContextAssemblyService.test.ts`

## AI Loom Image Manipulation vertical-slice update: binding preview inspection + asset-definition integration (stories 3.2.7-3.2.8)

- Added reusable binding preview/inspection orchestration in `application/workflow-studio/WorkflowInputBindingPreviewService.ts` on top of the existing canonical resolver:
  - reports declared source metadata per workflow input (source id/kind/priority/required + declared source summary),
  - reports selected source and bounded resolved value summaries (shape + compact textual summary),
  - reports unresolved bindings and all structured validation/resolution diagnostics in one inspectable payload.
- Added reusable image-workflow binding configuration seam in `application/contracts/ImageWorkflowInputBindingConfiguration.ts` so high-level image workflow assets can persist, duplicate, serialize, and inspect workflow input bindings through the same domain binding contract (`WorkflowInputBindingDomain`).
- Integrated binding-aware configuration into high-level image workflow asset definitions (`image-to-image`, `restyle`, `enhance-upscale`, `batch-transform`) via `inputBindings`:
  - authorable binding descriptors now live inside the asset definition/configuration surface,
  - defaults include supported 3.2.x binding source kinds (UI form values, selected image context, dataset instances, constants/defaults).
- Extended discovery/inspection projection in `application/contracts/ImageWorkflowAssetRegistry.ts` so registry entries expose serialized binding configuration for cross-system reuse and authoring-time inspection.
- Added focused tests for preview/inspection behavior and binding-aware asset configuration serialization/duplication:
  - `application/workflow-studio/tests/WorkflowInputBindingPreviewService.test.ts`
  - `application/contracts/tests/ImageWorkflowInputBindingConfiguration.test.ts`
  - updated image workflow asset and registry tests under `application/contracts/tests/*`.

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


## AI Loom Image Manipulation vertical-slice update: runtime output-persistence integration + validation coverage (stories 3.3.9-3.3.10)

- Workflow runtime execution now integrates the same output-binding pipeline used in stories 3.3.1-3.3.8 through `application/workflow-studio/WorkflowRuntimeOutputPersistenceService.ts` (binding descriptors -> write-plan resolution -> record materialization -> dataset-instance persistence), instead of introducing a parallel runtime writer path.
- Runtime output persistence is configuration-driven (`executionMetadata.workflowOutputPersistence.configuration`) and supports output/history/comparison dataset target behavior consistently via one orchestration seam.
- Execution results now carry structured output-persistence summaries (`outputPersistence`) so downstream history/UI surfaces can inspect persisted-record counts, target counts, and bounded issues without infrastructure-specific DTO leakage.
- Persistence failures after successful execution are bounded/predictable: execution result status is promoted to failed with structured persistence issue metadata, and write-plan/materialization denials fail before any dataset writes.
- Added focused runtime unit/integration coverage for success + bounded failure paths, append-oriented history behavior, comparison grouping semantics, and lineage/traceability metadata propagation.
