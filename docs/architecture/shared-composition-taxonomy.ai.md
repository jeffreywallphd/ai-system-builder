# AI Companion: Shared Composition Taxonomy

## Purpose
Provide one compact, reusable classification model for workflows/assets/context/models/tools/agents so parallel work stays aligned.

## Core model
`domain/taxonomy/CompositionTaxonomy.ts` defines:
- `structuralKind`: `atomic` | `composite` | `system`
- `semanticRole`: `model` | `dataset` | `tool` | `prompt-template` | `embedding-index` | `config-profile` | `workflow` | `workflow-template` | `agent` | `context-bundle` | `dataset-pipeline` | `training-recipe` | `tool-chain` | `app-template` | `system`
- `behaviorKind`: `none` | `deterministic` | `conditional` | `iterative` | `autonomous` (with `dynamic` normalized as a compatibility alias)

Behavior is a property of the same structural object, not a separate top-level architecture.

## Current inner-layer seams
- Classifier seam: `application/taxonomy/CompositionTaxonomyClassifier.ts`
- Workflow adapter: `application/workflows/WorkflowTaxonomy.ts`
- Agent adapter: `application/agents/contracts/AgentTaxonomy.ts`
- Canonical identity storage now persists taxonomy metadata for mapped entities.
- Canonical asset query criteria now supports taxonomy-aware filtering (`structuralKinds`, `semanticRoles`, `behaviorKinds`).
- Canonical asset reads still expose taxonomy with bounded fallback mapping where identity metadata is absent.
- Direction 5 atomic studio usage now concretely applies this taxonomy in Model Studio (`atomic/model/none`), Dataset Studio (`atomic/dataset/none`), Tool Studio (`atomic/tool/conditional|deterministic`), Prompt Template Studio (`atomic/prompt-template/none`), Embedding Index Studio (`atomic/embedding-index/none`), and Config Profile Studio (`atomic/config-profile/none`) via shared shell metadata and publish enforcement.
- Direction 5 composite studio usage now also concretely applies `composite/tool-chain/deterministic` through Tool Chain Studio (`domain/tool-chain-studio/*`, `application/tool-chain-studio/*`, and registration-driven Studio Shell UI integration).
- End-to-end cross-studio consistency tests now verify taxonomy coherence over the real service/bridge/backend/application/SQLite path before and after reload.

## Current mappings (foundation)
- workflow definition -> composite/workflow/deterministic (or conditional override at workflow seam; legacy `dynamic` inputs normalize to `conditional`)
- agent -> composite/agent/autonomous
- installed/base model -> atomic/model/none
- dataset version -> atomic/dataset/none
- context package -> composite/context-bundle/none
- context recipe -> composite/context-bundle/deterministic
- prompt asset -> atomic/prompt-template/none
- embedding asset -> atomic/embedding-index/none
- tool capability (mcp/local) -> atomic/tool/(conditional|deterministic)
- workflow-published capability -> composite/tool-chain/deterministic
- execution artifact canonical reads -> system/system/iterative

Current Direction 5 target shape remains:
- atomic assets: model, dataset, tool, prompt-template, embedding-index, config-profile
- composite assets: workflow, context-bundle, dataset-pipeline, training-recipe, tool-chain
- system assets: system, app-template

## Implementation status snapshot (Direction 5 through stories 5.24)
- Fully implemented now: shared taxonomy model + combination validation, shared studio registration taxonomy defaults, active composite studio roles (`workflow`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`), and bounded System Studio registration/authoring for first-class `system` assets on the shared shell route (`/studio-shell/system`).
- Fully implemented now: registry list/detail/graph/lineage projections include system assets and nested-system references through the same shared registry query + graph seams (no parallel taxonomy universe).
- Partially implemented / bounded: specialized composite semantics are currently taxonomy/authoring semantics (workflow orchestrator, agent decision unit, context-bundle input preparer); only workflow/context-bundle have specialized composite Studio Shell surfaces in this slice.
- System-level taxonomy authoring is integrated through shared Studio Shell routing/registration (`/studio-shell/system`) with bounded System Studio orchestration; richer visual composition-canvas UX remains intentionally out of scope while recursive semantics stay in the inner system domain foundation (`domain/system-studio/SystemAssetDomain.ts`).


## Specialized composite role interpretation
- Specialized composite assets remain first-class in this taxonomy:
  - `workflow` = orchestrator
  - `agent` = decision unit
  - `context-bundle` = input preparer
- These are semantic-role distinctions inside one shared taxonomy (not separate architecture stacks).

## Image-slice interface asset interpretation (stories 4.4.1-4.4.2)

- For image manipulation UI assets, taxonomy/composition guidance is:
  - atomic interface assets: reusable bounded components like output gallery item/card, output detail pane, metadata summary panel, parameter summary panel.
  - higher-level composed interface assets: system-bound assemblies that compose those atomic assets and bind them to system context + dataset instances + workflow/run events.
- In this slice, contract design is generalized for future media/document/system interfaces, while concrete implementation remains image-focused.

## Image-slice interface asset realization (stories 4.4.5-4.4.6)

- Atomic interface assets now include reusable output/history renderers:
  - `ImageOutputGalleryCollection` and card composition for grid/list output presentation,
  - `ImageRunHistoryList` + run-history item surface,
  - reusable parameter/metadata summary panels shared across output and run-history rows.
- Higher-level composed interface assets now bind those atomic assets to persisted system state contracts:
  - `ImageOutputGalleryAsset` -> dataset-backed `OutputGalleryListing`,
  - `ImageRunHistoryAsset` -> persisted `ImageRunHistoryListing`.
- This preserves taxonomy intent: bounded reusable atomics plus system-aware composition assets that handle dataset/workflow/run context wiring.

## Image-slice interface asset interaction realization (stories 4.4.7-4.4.8)

- Atomic interface assets now include explicit interaction units for output/result workflows:
  - output selection action bar,
  - output detail/inspection pane,
  - run-history list item selection state/action.
- Higher-level composed assets now include history/output interaction orchestration:
  - `ImageOutputGalleryAsset` binds persisted output records to selection, inspection, active-result marking, and reuse-as-input preparation semantics,
  - `ImageHistoryLinkedOutputInspectorAsset` binds selected run-history entries to linked output-gallery projections using persisted identifiers/contracts.
- Composition remains taxonomy-aligned: atomics keep narrow reusable contracts while composed assets own dataset/workflow/run/system-context binding behavior.

## Explicit non-goals in this slice
- no UI composer rewrite
- no replacement of workflow or execution backbone
- no parallel agent architecture/runtime model
- no over-atomicization of rows/chunks/fragments as global assets
- Direction 5 atomic studio usage now also concretely applies `atomic/prompt-template/none`, `atomic/embedding-index/none`, and `atomic/config-profile/none` through Prompt Template / Embedding Index / Config Profile studios (`domain/prompt-template-studio/*`, `application/prompt-template-studio/*`, `domain/embedding-index-studio/*`, `application/embedding-index-studio/*`, `domain/config-profile-studio/*`, `application/config-profile-studio/*`, and registration-driven UI shell integration).

## Direction 5 update: Runtime taxonomy alignment foundation (stories 6.1–6.2)

- Added bounded runtime behavior mapping seam: `application/system-runtime/RuntimeBehaviorAlignment.ts`.
- Mapping reuses existing taxonomy descriptors and validation (`CompositionTaxonomyDescriptor`, `assertAllowedCompositionTaxonomyCombination`) and does not create a second taxonomy universe.
- Runtime behavior mapping is intentionally minimal and authoritative:
  - deterministic => fixed execution profile
  - conditional => branch-capable execution profile
  - iterative => loop-capable execution profile
  - autonomous => planner-capable execution profile
- Behavior kind `none` stays non-executable in this runtime mapping layer (returns no runtime behavior profile).
- Workflow/agent/system resolution is provided through `RuntimeBehaviorAlignmentService` and delegates classification to the existing `CompositionTaxonomyClassifier` seam.
