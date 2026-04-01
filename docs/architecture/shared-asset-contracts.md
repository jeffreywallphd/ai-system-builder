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
