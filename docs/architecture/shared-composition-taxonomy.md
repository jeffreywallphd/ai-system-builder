# Shared Composition Taxonomy (Foundation Slice)

## Why this exists
Parallel work across workflows, assets, context, tools, models, and agents needs one small shared classification model so terms do not drift.

This foundation is intentionally narrow. It adds shared taxonomy descriptors and mapping seams in inner layers without replacing existing workflow execution, agent runtime coordination, or asset-management flows.

## Taxonomy dimensions
The shared descriptor has three dimensions:

- **structural kind**: `atomic` | `composite` | `system`
- **semantic role**: `model` | `dataset` | `tool` | `prompt-template` | `embedding-index` | `config-profile` | `workflow` | `workflow-template` | `agent` | `context-bundle` | `dataset-pipeline` | `training-recipe` | `tool-chain` | `app-template` | `system`
- **behavior kind**: `none` | `deterministic` | `conditional` | `iterative` | `autonomous` (with legacy `dynamic` normalized as an alias)

Behavior is treated as a property/capability of a structural thing, not as a separate architecture stack.

## Current repo alignment
What is now implemented:

- Shared taxonomy primitives and validated descriptors live in `src/domain/taxonomy/CompositionTaxonomy.ts`.
- Classification seams live in `src/application/taxonomy/CompositionTaxonomyClassifier.ts`.
- Canonical entity mappings now include: workflow definition, installed/base model, dataset version, execution artifact.
- Workflow and agent adapter seams are explicit (`src/application/workflows/WorkflowTaxonomy.ts`, `src/application/agents/contracts/AgentTaxonomy.ts`).
- Revised semantic roles now cover atomic (`config-profile`), composite (`dataset-pipeline`), and system deployment (`app-template`) assets without introducing a second taxonomy universe.
- Canonical identity records now persist optional taxonomy metadata (`structural_kind`, `semantic_role`, `behavior_kind`) and canonical resolver/operational summaries can project it.
- Canonical asset query criteria now includes taxonomy-aware filters (`structuralKinds`, `semanticRoles`, `behaviorKinds`) in addition to kind/source/status criteria.
- Canonical asset summary/detail reads still expose taxonomy descriptors, with identity metadata as the preferred source and bounded fallback classification where needed.
- Direction 5 atomic studio usage now concretely applies this taxonomy in Model Studio (`atomic/model/none`), Dataset Studio (`atomic/dataset/none`), Tool Studio (`atomic/tool/conditional|deterministic`), Prompt Template Studio (`atomic/prompt-template/none`), Embedding Index Studio (`atomic/embedding-index/none`), and Config Profile Studio (`atomic/config-profile/none`) via shared shell draft metadata and publish enforcement.
- Direction 5 composite studio usage now also concretely applies `composite/tool-chain/deterministic` through Tool Chain Studio (`src/domain/tool-chain-studio/*`, `src/application/tool-chain-studio/*`, and registration-driven Studio Shell UI integration).
- End-to-end cross-studio consistency tests now verify this taxonomy coherence over real shared seams (service/bridge/backend/src/application/SQLite) before and after reload.


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

What is **not** implemented in this slice:

- no new UI composer
- no replacement of existing workflow execution/runtime strategy selection
- no parallel agent architecture
- no over-atomicized asset graph (for example rows/chunks/fragments remain non-global unless existing architecture elevates them)

## Composition interpretation in this codebase
- Assets remain structural/versionable objects with durable identity.
- Current target shape for Direction 5 classification remains:
  - atomic assets: model, dataset, tool, prompt-template, embedding-index, config-profile
  - composite assets: workflow, context-bundle, dataset-pipeline, training-recipe, tool-chain
  - system assets: system, app-template
- Workflows and agents are both **composite** structures.
  - Workflow semantic role: `workflow`, behavior typically `deterministic` or `conditional` (legacy `dynamic` normalizes to `conditional`).
  - Agent semantic role: `agent`, behavior `autonomous`.
- Models and dataset versions are **atomic** with behavior `none` in this taxonomy layer.
- Execution artifacts now map to **system/system/iterative** in canonical classification seams, avoiding outdated atomic/system mappings.

## Implementation status snapshot (Direction 5 through stories 5.24)

Fully implemented now:
- Shared taxonomy model + allowed combination validation.
- Studio-shell atomic and composite registrations using shared taxonomy descriptors.
- Implemented composite studio roles in active use: `workflow`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`.
- System Studio registration and authoring now runs on the same shared Studio Shell path (`/studio-shell/system`) with first-class `system` structural kind handling and bounded recursive system-of-systems composition.
- Registry list/detail/graph/lineage surfaces now project system assets as first-class records (including nested system references and version-lineage summaries) using shared registry query/graph seams.

Partially implemented / bounded:
- Specialized composite semantics are currently classification and authoring semantics (`workflow` orchestrator, `agent` decision unit, `context-bundle` input preparer); only workflow and context-bundle are implemented as specialized composite Studio Shell surfaces in this Direction 5 slice.
- System composition editing remains intentionally bounded to structural authoring (add/remove/reorder child assets, nested-system visibility, interface/parameter/config surfaces, compatibility summaries). Rich visual graph-canvas editing remains later work.

This shared taxonomy is a guardrail to keep workflow/agent/asset/system language coherent while implementation continues in parallel.
- Direction 5 atomic studio usage now also concretely applies `atomic/prompt-template/none`, `atomic/embedding-index/none`, and `atomic/config-profile/none` through Prompt Template / Embedding Index / Config Profile studios (`src/domain/prompt-template-studio/*`, `src/application/prompt-template-studio/*`, `src/domain/embedding-index-studio/*`, `src/application/embedding-index-studio/*`, `src/domain/config-profile-studio/*`, `src/application/config-profile-studio/*`, and registration-driven UI shell integration).

## Direction 5 update: Runtime taxonomy alignment foundation (stories 6.1–6.2)

- A bounded runtime alignment seam now exists in `src/application/system-runtime/RuntimeBehaviorAlignment.ts` and consumes existing taxonomy truth (`CompositionTaxonomyDescriptor` + `assertAllowedCompositionTaxonomyCombination`) instead of introducing a second behavior ontology.
- Runtime behavior profiles are now mapped directly from shared behavior kinds:
  - `deterministic` -> fixed execution profile
  - `conditional` -> branch-capable profile
  - `iterative` -> loop-capable profile
  - `autonomous` -> planner-capable profile
- `none` remains non-executable in runtime behavior mapping and intentionally resolves to no runtime behavior profile.
- Workflow, agent, and system runtime behavior resolution flows through the existing taxonomy classifier seam (`CompositionTaxonomyClassifier`) via `RuntimeBehaviorAlignmentService`, preserving current atomic/composite/system taxonomy authority.

## Image-slice lineage + system interaction realization (stories 4.4.9-4.4.10)

- Added `ImageLineageMiniView` as an additional atomic interface asset for bounded lineage inspection (input -> run -> output -> dataset).
- Added `ImageResultHistoryInteractionSpaceAsset` as a higher-level composed interface asset that integrates:
  - output gallery,
  - run history,
  - selection/inspection behavior,
  - history->output linking,
  - lineage mini-view.
- Lineage and interaction composition are driven by persisted run-history + output-gallery contracts (`ImageRunHistoryWithOutputs`) and stable record/run/instance ids.
