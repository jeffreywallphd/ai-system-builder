# AI Companion: Shared Composition Taxonomy

## Purpose
Provide one compact, reusable classification model for workflows/assets/context/models/tools/agents so parallel work stays aligned.

## Core model
`domain/taxonomy/CompositionTaxonomy.ts` defines:
- `structuralKind`: `atomic` | `composite` | `system`
- `semanticRole`: `model` | `dataset` | `tool` | `prompt-template` | `embedding-index` | `config-profile` | `workflow` | `agent` | `context-bundle` | `dataset-pipeline` | `training-recipe` | `tool-chain` | `app-template` | `system`
- `behaviorKind`: `none` | `deterministic` | `conditional` | `iterative` | `autonomous` (with `dynamic` normalized as a compatibility alias)

Behavior is a property of the same structural object, not a separate top-level architecture.

## Current inner-layer seams
- Classifier seam: `application/taxonomy/CompositionTaxonomyClassifier.ts`
- Workflow adapter: `application/workflows/WorkflowTaxonomy.ts`
- Agent adapter: `application/agents/contracts/AgentTaxonomy.ts`
- Canonical identity storage now persists taxonomy metadata for mapped entities.
- Canonical asset query criteria now supports taxonomy-aware filtering (`structuralKinds`, `semanticRoles`, `behaviorKinds`).
- Canonical asset reads still expose taxonomy with bounded fallback mapping where identity metadata is absent.

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

## Explicit non-goals in this slice
- no UI composer rewrite
- no replacement of workflow or execution backbone
- no parallel agent architecture/runtime model
- no over-atomicization of rows/chunks/fragments as global assets
