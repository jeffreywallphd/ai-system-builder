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

- Studio UI asset metadata is now normalized as one shared registration model across atomic primitives, composed studio assets, and system/page assets (`ui/studio-shell/studio-assets/StudioAssetContracts.ts`, `ui/studio-shell/studio-assets/StudioAssetRegistry.ts`).
- Metadata fields now consistently expose:
  - identity hooks (`metadata.id`, `metadata.assetType`)
  - display text (`title`, `summary`, `displayName`, `description`)
  - grouping/classification (`kind`, registration `category`, metadata `group`, `contractCategory`)
  - visual/discovery hooks (`iconToken`, `tags`, `keywords`)
  - optional capability flags (`capabilityFlags`) for future inspector/library filtering.
- Registration normalization now validates and freezes this metadata shape for deterministic discovery and persistence-friendly read behavior.
- Runtime renderer resolution is now explicit in the registry through bounded lookup helpers:
  - `resolveRendererById`
  - `resolveRenderersByKind`
  - `resolveRenderersByCategory`
- Resolution is fail-safe and structured (`resolved`, `missing`, `invalid`) so runtime surfaces can degrade gracefully when renderer definitions are absent or mismatched, instead of relying on ad hoc null checks.

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


## AI Loom Image System vertical-slice update: storage-instance provisioning contract + local filesystem provisioner (stories 2.1-2.2)

- Added a reusable, versioned storage-instance provisioning seam in `application/system-runtime/StorageInstanceProvisioningContract.ts` so systems and embedded subsystems can request shareable storage instances without carrying raw filesystem path configuration in UI/application contracts.
- The contract keeps provisioning input compact/inspectable (`instanceId`, requested logical binding areas, metadata, contract version), supports deterministic binding references (`storage-instance://{instanceId}/{area}`), and returns logical area bindings (`input`/`output`/`intermediate`) suitable for downstream dataset/workflow binding flows.
- Added a local filesystem implementation in `infrastructure/filesystem/system-runtime/LocalStorageInstanceProvisioner.ts` that automatically provisions deterministic directories under a storage root (`/storage/{instanceId}/input|output|intermediate`) and returns local filesystem details only as an infrastructure-specific extension of the canonical contract result.
- `/systems/` remains available for ordinary system files, but storage-instance payload directories now model reusable storage attached by logical binding semantics rather than `systemId`-owned path assumptions.
- This slice intentionally introduces the contract + local provisioner seam without forcing broad runtime rewiring yet; follow-on stories should integrate this seam into output artifact storage and dataset-instance provisioning orchestration paths.

## AI Loom Image System vertical-slice update: storage-instance metadata + initialization integration (stories 2.3-2.4)

- Added an explicit storage-instance metadata contract in `application/system-runtime/StorageInstanceMetadataModel.ts` with:
  - stable identity + contract version (`instanceId`, `storageInstanceRef`, `provider`, `contractVersion`),
  - bounded display metadata (`name`, `summary`, `tags`),
  - lifecycle state/timestamps (`provisioning|ready|archived`),
  - logical bindings (`input|output|intermediate` references),
  - shareability flags and owner attachment records (`system` + `embedded-subsystem`).
- Added an application initialization seam in `application/system-runtime/StorageInstanceInitializationService.ts` that composes the existing provisioning contract from stories 2.1/2.2 and metadata persistence:
  - supports `provision` (new instance) and `attach` (reuse shared instance),
  - ensures repeated attachment of an existing shared instance does not force reprovisioning,
  - enforces no user-managed filesystem/path configuration in initialization payloads.
- `StudioShellBackendApi` now routes reference-image dataset initialization through this storage-instance initialization seam before ensuring dataset instances, so runtime initialization uses storage contracts instead of raw location assumptions.
- Desktop composition now injects `LocalStorageInstanceProvisioner` into studio-shell runtime wiring (`electron/main/main.ts`) with infrastructure-owned storage root under `/storage/{instanceId}/...` semantics (`{app-storage}/storage/...` on disk).
- This preserves layer boundaries:
  - UI/API initialization requests carry system/owner/binding intent only,
  - application orchestrates provisioning + attach metadata,
  - infrastructure provisioners own filesystem details and path materialization.

## AI Loom Image System vertical-slice update: dataset storage bindings + shared attachment reuse (stories 2.5-2.6)

- Dataset-instance contracts now carry explicit storage-instance logical binding references (`DatasetInstance.storageBinding`) with:
  - storage instance identity/reference (`storageInstanceId`, `storageInstanceRef`),
  - logical area (`input|output|intermediate`),
  - logical binding identity/reference (`bindingId`, `bindingReference`).
- `SystemDatasetInstanceService` ensure/create flows now accept and persist those storage bindings, and guard against:
  - path-like dataset storage configuration fields in request payloads,
  - conflicting role/purpose ensures that attempt to rebind an existing dataset instance to a different storage binding.
- `ReferenceImageSystemTemplate` dataset-instance definitions now declare intended storage binding areas so dataset contracts remain inspectable/composable at template level.
- `StudioShellBackendApi` now wires storage initialization metadata directly into dataset-instance ensure requests:
  - dataset ensure resolves through `storage-instance metadata -> logical area binding -> dataset instance storageBinding`,
  - no user-facing raw filesystem path configuration is introduced.
- Shared attachment semantics are now explicit for subsystem reuse:
  - `initializeReferenceImageStorage` supports deterministic embedded subsystem owner identity (`{systemId}::subsystem:{embeddedSubsystemId}`) when owner kind is `embedded-subsystem`,
  - attach semantics continue to reuse existing provisioned instances without duplicate provisioning across multiple top-level systems and embedded subsystems.
- Filesystem path resolution remains infrastructure-owned; application/domain layers exchange only logical storage-instance references.

## AI Loom Image System vertical-slice update: ingestion/retrieval binding resolution + storage lifecycle operations (stories 2.7-2.8)

- Ingestion and retrieval paths now resolve through storage-instance bindings end-to-end rather than path-like or system-owned output URI assumptions:
  - reference-image upload ingestion now writes dataset record storage references from the dataset instance logical binding (`storage-instance://.../input/uploads/...`) in `StudioShellBackendApi`.
  - workflow output artifact persistence now requires the target dataset instance storage binding in `WorkflowOutputArtifactStorage` requests.
  - output materialization uses dataset-instance binding resolution as the canonical fallback reference path (`storage-instance://.../output/runs/...`) when persisted artifacts or executor refs do not provide one.
- Raw filesystem path materialization remains infrastructure-only:
  - `LocalSystemOutputArtifactStorage` now maps logical binding references into deterministic local directories under `/storage/{instanceId}/{area}/...` and no longer depends on system-owned directory identity.
  - shared helper parsing for `storage-instance://` references lives in `StorageInstanceProvisioningContract` so infrastructure adapters do not replicate reference parsing semantics.
- Added explicit storage-instance lifecycle orchestration in `StorageInstanceLifecycleService` with practical vertical-slice operations:
  - `initialize`, `reset`, `archive`, `cleanup`, `detach`, and `safeDelete`.
  - safe deletion is blocked when shared attachments are still present and requires archived lifecycle state before deletion.
  - lifecycle state/timestamps are persisted in storage metadata, preserving inspectability.
- Added local filesystem lifecycle infrastructure support (`LocalStorageInstanceLifecycleInfrastructure`) for directory-level lifecycle behavior:
  - initialize/verify binding directories,
  - reset (clear + recreate bound directories),
  - cleanup (bounded intermediate-area cleanup),
  - archive (move instance root under archive namespace),
  - delete (remove instance root).
- `StudioShellBackendApi` now exposes storage lifecycle operations (`manageReferenceImageStorageLifecycle`, `deleteReferenceImageStorage`) aligned with storage-instance semantics instead of system-exclusive ownership assumptions.

## AI Loom Image System vertical-slice update: explicit path-configuration rejection + storage-instance validation/test hardening (stories 2.9-2.10)

- Added one reusable storage-path policy validator seam (`application/system-runtime/StoragePathPolicyValidation.ts`) and applied it in:
  - storage initialization orchestration (`StorageInstanceInitializationService`),
  - dataset-instance ensure/create orchestration (`SystemDatasetInstanceService`),
  - Studio Shell reference-image storage initialization request handling (`StudioShellBackendApi`).
- Validation now fails clearly and inspectably when callers attempt raw path/directory/filesystem configuration keys (including nested metadata payloads); requests must use storage-instance ids/references + logical bindings only.
- Dataset binding validation now enforces logical-reference correctness beyond prefix checks:
  - `storageInstanceRef` must reference only the instance root (`storage-instance://{instanceId}`),
  - `bindingReference` must reference exactly one logical area (`storage-instance://{instanceId}/{area}`),
  - binding area/reference/instance identity must stay consistent.
- Storage reference parsing (`parseStorageLogicalReference`) now rejects nested path segments for logical binding references, preventing accidental acceptance of direct path-style binding payloads.
- Test coverage now explicitly includes:
  - nested path-key rejection,
  - logical-binding reference strictness,
  - deterministic provisioning + cross-instance isolation,
  - shared attachment reuse across multiple systems and embedded subsystems,
  - lifecycle safe-delete behavior under shared attachments.
- No UI/CSS changes were required for this slice; behavior is enforced in domain/application/backend contract layers.

## AI Loom Image System vertical-slice update: storage-instance-bound binary output storage + provenance persistence (stories 2.3.5-2.3.6)

- Workflow output materialization now supports explicit binary artifact persistence through an internal storage seam (`application/system-runtime/WorkflowOutputArtifactStorage.ts`) rather than executor-specific paths.
- The filesystem implementation (`infrastructure/filesystem/system-runtime/LocalSystemOutputArtifactStorage.ts`) now governs pathing/naming under storage-instance logical bindings (`/storage/{instanceId}/{area}/...`) with:
  - deterministic namespace segments (`workflowRunId`/`materializationId`),
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

- Added a versioned reusable mapping contract for system-context -> workflow-binding translation in `domain/system-studio/SystemContextWorkflowMappingConfiguration.ts`.
- System asset execution metadata now includes bounded persisted mapping configuration (`workflowContextMapping`) in `domain/system-studio/SystemAssetDomain.ts`, enabling save/load/duplicate/inspection of context bindings at the system-asset layer.

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
- Image manipulation dataset contracts now include two additional concrete media dataset assets through the shared registry seam (`application/dataset-studio/ImageManipulationDatasetAssets.ts`):
  - a generated output dataset asset (`asset:dataset:image-reference-output`) for run-produced image results, gallery listing, preview selection, and downstream output-to-input reuse,
  - an optional FaceID reference dataset asset (`asset:dataset:image-faceid-reference`) for one-or-more conditioning references without exposing user-managed raw path contracts.
- The reference-image system template now composes the optional FaceID dataset as a first-class dataset component and marks its dataset-instance template entry as optional; provisioning remains explicit through `buildReferenceImageDatasetInstanceRequests(systemId, { includeOptionalReferenceDatasets })` so default system startup behavior is unchanged.
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

- System Studio now includes a reference-image experience panel that keeps user language simple (`Upload image`, `Processing settings`, `Start`, `Results`) while reusing existing image UI component boundaries.
- Uploads from that panel flow through a backend API seam (`StudioShellBackendApi.ingestReferenceImageUpload`) which:
  - provisions system-owned input/output dataset instances from existing reference-template requests,
  - validates/admit records through `SystemDatasetInstanceService` schema enforcement,
  - extracts metadata with the existing image metadata extractor contract,
  - persists canonical dataset image records owned by the active reference-image system draft.

## Direction 5 extension update: output dataset persistence + results visualization (stories 5.1.7-5.1.8)
- Reference-image workflow runs now persist generated outputs into the system-owned output dataset instance via a bounded Studio Shell adapter flow:
  - runtime output payload -> Comfy materialization mapper -> workflow output materialization service -> output dataset instance ingestion/update.
- Persisted output records retain traceability fields through existing generation/provenance structures (source image reference, workflow template reference/version, parameter snapshot metadata, run id/materialization id, timestamps).
- Studio Shell now exposes reference-image-specific backend read/write operations for:
  - persisting generated outputs from a completed execution result payload, and
  - listing output gallery entries from the system-owned output dataset instance.
- The reference-image experience panel now reads from persisted output dataset records (not transient-only UI state) and provides:
  - an approachable “Generated images” gallery,
  - selection/open behavior,
  - a focused single-image viewer, and
  - optional collapsed “Settings used” details.
- Start actions now reuse the existing UI trigger + system-context mapping stack (`UiTriggerSystemContextMapper` -> `WorkflowSystemContextBindingAdapter` + `ReferenceImageSystemWorkflowContextMapping`) before invoking runtime start, so selected image refs, user settings, and dataset instance refs flow into execution context without adding a parallel mapping path.

## Direction 5 extension update: basic run history + end-to-end reference-image validation (stories 5.1.9-5.1.10)
- Reference-image run history is now recorded at output persistence time via `ImageRunHistoryService`, keyed by execution/run id and tied to the same system-owned output dataset records used by the generated-results gallery.
- Studio Shell now exposes a bounded read operation (`listReferenceImageRunHistory`) for recent activity retrieval so history is queryable through runtime/persistence layers instead of UI-only transient state.
- Desktop composition now uses `SqliteImageRunHistoryRepository` for durable run-history storage; browser fallback keeps the same API contract with in-memory persistence.
- The reference-image panel now includes approachable history UX (`Recent activity`, `Run details`, `Created`, `Source image`, `Open result`, `Settings`) and lets users jump from previous runs back to saved outputs.
- Added focused integration coverage for the end-to-end vertical slice (upload -> persist outputs -> output listing -> run history listing), including assertions that run-history entries remain associated with persisted output record ids.

## AI Loom Image System vertical-slice update: shared runtime context binding + cross-studio lineage carryover (stories 5.2.5-5.2.6)
- System Studio reference-image interactions now treat the shared `SystemContextContract` as the runtime source of truth for selected image, active parameter values, dataset instance references, and run metadata; UI edits are written back into the draft envelope (`systemSpec.referenceImageRuntimeContext`) so context survives save/reload.
- Start execution in System Studio now reuses that shared context directly and forwards it through runtime start metadata, instead of rebuilding ad hoc trigger-only payloads in each click handler.
- Output persistence now accepts and carries the same shared runtime context into run-history records, so lineage fields remain stable across Data/Workflow/System boundaries without studio-specific reconstruction.
- Image run-history lineage now records a compact cross-studio trace surface (source image ref, source dataset instance/asset, workflow asset/version, system asset/version, runtime session/trace handle, output dataset and record ids, explicit `status` + `missing` fields).

## Direction 5 extension update: system serialization + asset reference resolution seams (stories 5.3.1-5.3.2)

- System draft/version content now uses a canonical serialization contract in `domain/system-studio/SystemSerializationContract.ts` (`ai-loom.system-serialization`, `schemaVersion=1.0.0`) with explicit sections for:
  - version/compatibility metadata,
  - system definition data (components, dependencies, interfaces, bindings, execution metadata),
  - asset reference projections (dataset/workflow references),
  - runtime-owned references/state (dataset-instance references + runtime binding envelope),
  - UI/presentation configuration payload.
- Parsing/validation is centralized and zod-backed at this seam:
  - unsupported serialized versions are rejected via explicit `unsupported-system-serialization-version:*` errors,
  - legacy `systemSpec` payloads remain loadable through compatibility backfill into the canonical contract shape.
- System Studio draft create/update paths now serialize through that seam so persisted content carries explicit serialization metadata while preserving legacy fields that current UI/runtime flows still read.
- Runtime now includes a reusable serialized asset-reference resolution layer in `application/system-runtime/SerializedAssetReferenceResolutionService.ts` that resolves `kind`/`assetId`/`versionId` references with structured result codes:
  - `missing-asset`,
  - `incompatible-version`,
  - `invalid-reference`,
  - `unsupported-serialized-version`.
- Runtime system loading (`SystemRuntimeApplicationService`) now applies that resolver and surfaces graceful typed failures (`invalid-request:serialized-reference-*`) when serialized references cannot be resolved.
- Broken lineage is explicit and safe: failed or partial runs now mark lineage as `incomplete`/`partial` with `missing` field hints instead of silently writing ambiguous history entries.

## Direction 5 extension update: canonical system save/load operations (stories 5.3.3-5.3.4)

- System Studio now exposes explicit save/load orchestration methods over the same canonical serialization contract (`SystemStudioApplicationService.saveSystemDefinition` / `loadSystemDefinition`) rather than introducing a parallel format.
- Save operations re-parse/validate draft content through `parseSystemSerializationDocument`, then reserialize through `serializeSystemSerializationDocument`, so persisted drafts always carry canonical serialization metadata and remain reloadable.
- Saved payloads preserve:
  - system definition (components/interfaces/parameters/bindings),
  - dataset/workflow references,
  - runtime binding envelope and runtime-owned dataset-instance references when present,
  - UI configuration state.
- Load operations now return a structured reconstruction result containing:
  - canonical serialization metadata + schema version,
  - reconstructed in-memory `SystemAsset`,
  - UI configuration payload,
  - structured resolution issues (`warning`/`error`) from the serialized asset-reference resolution seam.
- Unresolved references are handled gracefully for load inspection:
  - missing unpinned assets can surface as warnings,
  - incompatible/missing pinned references surface as errors,
  - schema incompatibility remains explicit via structured issue codes.

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

## Direction 5 UI cleanup update: optional draft-authoring surfaces + System Studio canvas scope (cleanup stories 1-2)

- Draft-authoring surface selection is now contract-level and explicitly optional in studio registration shell hints:
  - registrations can now express `draftAuthoringSurfaces.wizard` and `draftAuthoringSurfaces.canvas` independently,
  - experience-asset id lists remain supported for compatibility, but surface resolution is now centralized (`resolveDraftAuthoringExperienceAssetIds`) instead of studio-local conditionals.
- Shared shell runtime now passes resolved draft-authoring surface configuration through one path (`StudioShellPage` -> surface boundary input), so studios can cleanly support:
  - wizard only,
  - canvas only,
  - both wizard and canvas,
  - neither surface.
- System Studio now uses **wizard-only** system-level draft authoring by registration contract (no system-level mode-toggle canvas), while still keeping the **page-level structure canvas** inside the wizard’s page-layout step.
- Missing/disabled draft-authoring surfaces now degrade gracefully with explicit no-surface messaging instead of empty/placeholder shells.

## Direction 5 UI cleanup update: System Studio primary-canvas clarity + section-add persistence hardening (cleanup stories 3-4)

- System Studio now removes lingering standalone canvas-role affordances inside the system draft authoring boundary so there is one clear canvas role: the page-structure canvas hosted in the wizard page-layout step.
- Wizard copy now explicitly frames the page-structure canvas as the main layout editing surface, while keeping page setup and settings as supporting flows.
- Page section add/update/remove persistence now always reconciles against the latest serialized draft content snapshot before writing updates, preventing freshly added sections from being dropped by stale in-memory panel arrays during rapid edit/reconcile cycles.
- Section creation now assigns stable composed-panel metadata (`assetId`, `panelType`) and collision-safe ids from current persisted page panels, preserving compatibility with existing selection, panel-design handoff, and future drag/resize flows.

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

- Shared taxonomy now treats `schema` as a first-class atomic semantic role (`atomic/schema/none`) rather than overloading dataset, pipeline, or UI asset roles.
- Shared taxonomy-driven contract projection now includes `schema` in `CompositionAssetContractResolver` with a bounded schema-authoring contract surface:
  - JSON-schema input/output payload posture,
  - schema metadata/definition compatibility,
  - inspectable parameters for modeling dialect and entity scale.
- A canonical schema-domain contract now exists in `domain/schema-studio/SchemaStudioDomain.ts` and follows existing studio asset conventions:
  - schema studio identity + taxonomy metadata helpers,
  - schema asset metadata construction aligned with shared draft metadata/provenance,
  - versioned schema-asset document contract (`schemaVersion=1.0.0`).
- Schema assets now formalize reusable entity/table modeling units via `SchemaEntityDefinition` with:
  - stable identity (`entityId`),
  - canonical naming (`name`, optional `label`),
  - optional descriptions,
  - field-collection hook support (inline or external reference),
  - optional metadata and optional canvas-layout metadata for future node/canvas authoring.
- Schema definitions also include bounded relationship declarations (`SchemaRelationshipDefinition`) that reference entities by id, preserving compatibility with future ERD-style authoring without forcing runtime execution semantics into this slice.
- Serialization/deserialization + validation are now explicit and deterministic through `createSchemaAssetDocument`, `serializeSchemaAssetDocument`, and `deserializeSchemaAssetDocument`, including:
  - duplicate entity/relationship id rejection,
  - relationship endpoint validation against declared entities,
  - normalized immutable documents for persistence and downstream registry/read-model use.
- This slice intentionally keeps scope structural and asset-first: it does not add full schema-field authoring UX, relationship editors, or schema execution behaviors.

## Direction 5 extension update: schema field + relationship model formalization (stories 3.1.3-3.1.4)

- `SchemaEntityDefinition` now carries first-class field contracts (`fields`) instead of only field-collection hooks, aligned with existing domain validation/serialization patterns.
- Field contracts (`SchemaFieldDefinition`) are intentionally generic and include:
  - stable identity (`fieldId`),
  - user-facing and machine-facing naming (`name`, optional `key`),
  - typed value contract (`type`) with reusable baseline kinds (for relational and non-relational structured schema authoring),
  - required/optional marker, optional default value hook, optional description/help text, and metadata hooks.
- Entity-level field normalization now enforces deterministic integrity:
  - duplicate `fieldId` and duplicate field-name rejection,
  - inline field-collection references must resolve to declared fields,
  - inline collection field ids default to the entity field list when omitted.
- `SchemaRelationshipDefinition` is now formalized as a reusable relationship model for schema assets with:
  - stable identity (`relationshipId`),
  - source/target entity references,
  - optional source/target field references,
  - optional relationship type + bounded cardinality hints,
  - optional label/description and metadata for future ERD/canvas authoring.
- Relationship validation is now entity/field-aware in the same canonical domain seam:
  - source/target entities must exist,
  - source/target field references (when provided) must resolve on the referenced entities.
- Serialization/deserialization compatibility is preserved by accepting legacy relationship `kind` values and normalizing them into the new `type` property at the boundary.
- This remains a structural foundation slice: it strengthens schema-authoring contracts for future studio/pipeline integration without introducing schema-editing UI workflows or runtime database semantics.

## Direction 5 extension update: schema persistence/validation completion slice (stories 3.1.9-3.1.10)

- Schema domain now includes a reusable validation seam (`validateSchemaAssetDocument`) that follows existing issue-list validation patterns and returns deterministic structural diagnostics without mutating persisted content.
- Validation currently covers bounded structural integrity checks:
  - duplicate entity/table names,
  - duplicate field names within an entity/table,
  - missing relationship entity references,
  - missing relationship field references,
  - incomplete field definitions and obviously incomplete relationship bindings.
- Schema document parsing now supports a safe-edit compatibility seam (`deserializeSchemaAssetDocumentForEditing`) for malformed/legacy payloads:
  - strict parsing is still available for canonical persistence paths,
  - safe-edit parse normalizes recoverable sections and returns explicit warning issues when payloads are incomplete.
- Persistence remains aligned with existing taxonomy/registration/versioning patterns:
  - schema assets remain first-class atomic `schema` role assets,
  - schema documents remain versioned (`schemaVersion=1.0.0`) and serialize through canonical domain helpers,
  - Schema Studio edits continue to flow through the existing studio draft content infrastructure.

## AI Loom image manipulation update: Build-flow system template registration + primary workflow binding hardening (stories 1.5-1.6)

- Build now resolves image manipulation as a real **system build template asset entry** through `application/system-studio/SystemBuildTemplateCatalog.ts` instead of a detached page-local card definition.
- Build-to-System-Studio handoff carries a stable `buildTemplateId` that resolves to seeded draft defaults (asset id, metadata, dependencies, and serialized system composition content) so first save persists the canonical system asset id (`asset:system:reference-image-manipulation`) via the existing studio-shell draft path.
- Seeded system draft content composes the existing image input/output/optional FaceID datasets and binds the primary workflow template component (`asset:workflow-template:image-to-image:starter`) through normal system `components` + `bindings` structure.
- This keeps workflow binding explicit and inspectable at the system asset layer, while deferring schema-to-node mapping/runtime adapter details to later stories.

## AI Loom image manipulation update: Comfy runtime execution metadata + system template structural validation (stories 1.7-1.8)

- `ReferenceImageSystemTemplate` now declares explicit runtime execution intent metadata on the canonical `systemAsset.executionMetadata` seam (ComfyUI runtime environment, workflow-template-driven orchestration mode, and required runtime capability/hint descriptors).
- This remains declarative metadata only (no runtime process start, install management, health polling, or execution adapter behavior is introduced in this slice).
- Added reusable image-system template validation in `application/system-studio/ImageManipulationSystemTemplateValidation.ts` returning inspectable `AssetValidationResult` contracts.
- Validation enforces required system identity metadata, required input/output dataset bindings, optional FaceID dataset semantics, required primary workflow template binding, and required Comfy runtime execution metadata/capabilities.

## AI Loom image manipulation update: property schema model + generation controls (stories 3.3-3.4)

- `ComfyImageManipulationPropertySchema` now includes a first-class **Models** group with checkpoint, VAE, and FaceID selectors plus inspectable mapping metadata (`runtimeBinding`, `optionSource`, fallback strategy).
- Default model values remain runnable with no user input via system-managed fallback resolution (`system-default`) while preserving forward compatibility with runtime-installed model discovery.
- Generation controls now expose explicit Comfy-aligned parameters in the schema surface:
  - `steps`,
  - `cfg` (prompt strength),
  - `sampler`,
  - `scheduler`,
  - deterministic `seed` (defaulted to a fixed integer).
- Validation now enforces bounded ranges and allowed option sets for generation controls, and rejects empty model selections.
- Preview summaries now include selected/default model configuration and concise generation behavior details, keeping schema assets inspectable and previewable without introducing UI-specific logic.

## AI Loom image manipulation update: image + FaceID property controls (stories 3.5-3.6)

- `ComfyImageManipulationPropertySchema` now includes first-class image controls for `width`, `height`, and image-to-image `denoiseStrength`, with safe runnable defaults and bounded validation suitable for Comfy runtime mapping.
- Width/height are represented as bounded discrete pixel-grid values (`multipleOf: 64`) to stay compatible with current runtime/model constraints while remaining future-extensible through schema metadata.
- Output result-count authoring remains explicit and validated (`1..4`) so single and multi-result generation are both contract-supported.
- FaceID now has an explicit optional contract group (`enabled`, `referenceBindings`, `weight`, `startStepFraction`, `endStepFraction`) with schema-driven runtime mapping metadata and non-technical user-facing labels/descriptions.
- FaceID reference bindings use dataset-native logical references (`datasetBindingId`, `datasetAssetId`) and reject raw file paths, preserving system-managed storage architecture boundaries.
- FaceID step-window consistency is validated (`startStepFraction <= endStepFraction`) and preview output now summarizes whether identity guidance is enabled plus selected/default configuration.

## AI Loom image manipulation update: defaults, validation, and user-facing metadata hardening (stories 3.7-3.8)

- `ComfyImageManipulationPropertySchema` now ships a fully runnable default configuration contract (`createComfyImageManipulationDefaultConfig`/`resolveComfyImageManipulationConfig`) that resolves every field group without requiring additional user input.
- Validation now returns consistent structured issues (`scope`, `code`, `path`, `message`) for field-level and cross-field checks so downstream preview/inspector surfaces can render deterministic validation states without ad hoc parsing.
- Cross-field checks now explicitly cover:
  - required positive prompt semantics,
  - download target compatibility with multi-result output counts,
  - FaceID timing window ordering (`startStepFraction <= endStepFraction`),
  - FaceID reference requirements only when FaceID is enabled.
- User-facing schema labels/descriptions were refined for non-technical readability while preserving inspectable runtime mapping metadata for advanced controls (for example, exposing user-friendly labels with technical metadata retained for CFG/seed/sampler/scheduler mappings).
- Preview summaries now reflect resolved default state and user-friendly wording (including identity-guidance summary phrasing) rather than raw partial input.
