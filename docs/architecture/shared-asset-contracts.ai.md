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
- Taxonomy-driven bounded contract projections now cover all planned Direction 5 composite roles with truthful baselines (`workflow`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`) plus system roles (`app-template`, `system`) for recursive system composition foundations, while preserving existing atomic role coverage.
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
