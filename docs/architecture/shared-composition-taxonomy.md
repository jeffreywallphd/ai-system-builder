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

What is **not** implemented in this slice:

- no new UI composer
- no replacement of existing workflow execution/runtime strategy selection
- no parallel agent architecture
- no over-atomicized asset graph (for example rows/chunks/fragments remain non-global unless existing architecture elevates them)

## Composition interpretation in this codebase
- Assets remain structural/versionable objects with durable identity.
- Workflows and agents are both **composite** structures.
  - Workflow semantic role: `workflow`, behavior typically `deterministic` or `conditional` (legacy `dynamic` normalizes to `conditional`).
  - Agent semantic role: `agent`, behavior `autonomous`.
- Models and dataset versions are **atomic** with behavior `none` in this taxonomy layer.
- Execution artifacts now map to **system/system/iterative** in canonical classification seams, avoiding outdated atomic/system mappings.

This shared taxonomy is a guardrail to keep workflow/agent/asset/system language coherent while implementation continues in parallel.
