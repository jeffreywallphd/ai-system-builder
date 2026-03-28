# Shared Composition Taxonomy (Foundation Slice)

## Why this exists
Parallel work across workflows, assets, context, tools, models, and agents needs one small shared classification model so terms do not drift.

This foundation is intentionally narrow. It adds shared taxonomy descriptors and mapping seams in inner layers without replacing existing workflow execution, agent runtime coordination, or asset-management flows.

## Taxonomy dimensions
The shared descriptor has three dimensions:

- **structural kind**: `atomic` | `composite` | `system`
- **semantic role**: `model` | `dataset` | `tool` | `prompt-template` | `embedding-index` | `config-profile` | `workflow` | `agent` | `context-bundle` | `dataset-pipeline` | `training-recipe` | `tool-chain` | `app-template` | `system`
- **behavior kind**: `none` | `deterministic` | `conditional` | `iterative` | `autonomous` (with legacy `dynamic` normalized as an alias)

Behavior is treated as a property/capability of a structural thing, not as a separate architecture stack.

## Current repo alignment
What is now implemented:

- Shared taxonomy primitives and validated descriptors live in `domain/taxonomy/CompositionTaxonomy.ts`.
- Classification seams live in `application/taxonomy/CompositionTaxonomyClassifier.ts`.
- Canonical entity mappings now include: workflow definition, installed/base model, dataset version, execution artifact.
- Workflow and agent adapter seams are explicit (`application/workflows/WorkflowTaxonomy.ts`, `application/agents/contracts/AgentTaxonomy.ts`).
- Revised semantic roles now cover atomic (`config-profile`), composite (`dataset-pipeline`), and system deployment (`app-template`) assets without introducing a second taxonomy universe.
- Canonical identity records now persist optional taxonomy metadata (`structural_kind`, `semantic_role`, `behavior_kind`) and canonical resolver/operational summaries can project it.
- Canonical asset query criteria now includes taxonomy-aware filters (`structuralKinds`, `semanticRoles`, `behaviorKinds`) in addition to kind/source/status criteria.
- Canonical asset summary/detail reads still expose taxonomy descriptors, with identity metadata as the preferred source and bounded fallback classification where needed.
- Direction 5 atomic studio usage now concretely applies this taxonomy in Model Studio (`atomic/model/none`), Dataset Studio (`atomic/dataset/none`), Tool Studio (`atomic/tool/conditional|deterministic`), Prompt Template Studio (`atomic/prompt-template/none`), Embedding Index Studio (`atomic/embedding-index/none`), and Config Profile Studio (`atomic/config-profile/none`) via shared shell draft metadata and publish enforcement.
- Direction 5 composite studio usage now also concretely applies `composite/tool-chain/deterministic` through Tool Chain Studio (`domain/tool-chain-studio/*`, `application/tool-chain-studio/*`, and registration-driven Studio Shell UI integration).
- End-to-end cross-studio consistency tests now verify this taxonomy coherence over real shared seams (service/bridge/backend/application/SQLite) before and after reload.


## Specialized composite role interpretation
- Specialized composite assets remain first-class in this taxonomy:
  - `workflow` = orchestrator
  - `agent` = decision unit
  - `context-bundle` = input preparer
- These are semantic-role distinctions inside one shared taxonomy (not separate architecture stacks).

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

## Implementation status snapshot (story 3.19)

Fully implemented now:
- Shared taxonomy model + allowed combination validation.
- Studio-shell atomic and composite registrations using shared taxonomy descriptors.
- Implemented composite studio roles in active use: `workflow`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`.

Partially implemented / bounded:
- Specialized composite semantics are currently classification and authoring semantics (`workflow` orchestrator, `agent` decision unit, `context-bundle` input preparer); only workflow and context-bundle are implemented as specialized composite Studio Shell surfaces in this Direction 5 slice.
- System-level target roles (`app-template`, `system`) exist in taxonomy; UI authoring surfaces are still pending, but bounded inner recursion-capable system composition modeling now exists in `domain/system-studio/SystemAssetDomain.ts`.

This shared taxonomy is a guardrail to keep workflow/agent/asset/system language coherent while implementation continues in parallel.
- Direction 5 atomic studio usage now also concretely applies `atomic/prompt-template/none`, `atomic/embedding-index/none`, and `atomic/config-profile/none` through Prompt Template / Embedding Index / Config Profile studios (`domain/prompt-template-studio/*`, `application/prompt-template-studio/*`, `domain/embedding-index-studio/*`, `application/embedding-index-studio/*`, `domain/config-profile-studio/*`, `application/config-profile-studio/*`, and registration-driven UI shell integration).
