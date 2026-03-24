# Domain and Application Core

This document goes deeper into the inner layers of the system: the domain model and the application orchestration built around it.

## Why these layers matter most

If the infrastructure changed tomorrow—different storage, different runtime transport, different host shell—the product should still mean the same things:
- a workflow is still a workflow
- a node is still a node
- model compatibility rules still apply
- context packages and recipes still mean the same thing
- tool publication is still attached to workflows

Those stable meanings live in the **domain** and **application** layers.

## Domain core

### Workflows as the central aggregate
The workflow aggregate (`domain/workflows/Workflow.ts`) is the most important domain object in the codebase. It owns:
- identity
- metadata
- lifecycle state
- runtime profile
- execution policy
- nodes
- connections

The aggregate exposes operations like `addNode`, `updateNode`, `removeNode`, `addConnection`, and `withMetadata`, each returning a new workflow instance. That gives the architecture a relatively immutable domain style that is useful for correctness, undo/redo-friendly thinking, and controlled mutation.

### Graph semantics stay in the core
The workflow can be converted to a graph (`toGraph()`), but graph-specific behavior is separated into graph/domain services rather than being buried in the UI. That keeps graph reasoning reusable and testable.

### Validation as business policy
`domain/services/WorkflowValidator.ts` combines graph checks, node validation, connection validation, and runtime-policy checks. This is the correct place for those rules because workflow validity is a business concern, not a view concern.

### Compatibility services
The domain also contains compatibility logic such as:
- `NodeCompatibilityService`
- `ModelCompatibilityService`
- service compatibility helpers

This reinforces that "can these parts work together?" is core product policy.

## Application core

### Use cases organize behavior around intent
The application layer translates intents into orchestrated actions. The naming is explicit and readable:
- create workflow
- save workflow
- load workflow
- validate workflow
- execute workflow
- create node
- connect nodes
- install model
- list tool capabilities
- execute MCP tool
- preview workflow/tool/agent context

This gives the system an operation-centered API rather than a generic service blob.

### Ports define required capabilities
The application layer declares interfaces for capabilities it needs from the outside world, for example:
- repositories
- executors
- runtime clients
- tool catalogs
- context repositories
- model installers/downloaders

That is the main clean-architecture mechanism that decouples use cases from storage and runtime details.

### Workflow execution orchestration
`ExecuteWorkflowUseCase` shows the inner architecture well. It:
- receives the workflow and optional overrides
- computes the effective workflow
- resolves execution metadata, especially workflow context
- validates according to runtime and dependency rules
- delegates execution to an external executor port

This is a strong separation because the use case owns the policy of execution preparation, while infrastructure owns the mechanics of actual execution.

### Context as an application concern
The context system is mostly modeled in the application layer rather than the pure domain layer. That is sensible because context assembly is highly orchestration-heavy:
- loading packages and recipes
- merging explicit and derived selections
- assembling dynamic context sources
- trimming/budgeting
- generating execution envelopes and inspection outputs

`application/context/WorkflowContextService.ts` is therefore a central application-layer service.

### Projection services are application translators
Projection services translate the rich internal workflow model into alternate surfaces such as forms and tools. They are not domain rules and not infrastructure details; application is the right layer for them.

## How the inner layers support feature slices

The same inner-layer approach is reused across multiple slices:
- workflows and nodes
- context engineering
- tools and published tools
- MCP use cases
- model management
- managed services
- tuning dataset studio
- model training

This consistency is one of the healthier signs in the codebase: even as features expand, the inner architecture still tends to express them as domain models plus application orchestration.

## Why this is a good fit for the product

AI Loom Studio is not just a thin GUI over a runtime. It is an authoring and governance environment for workflows, tools, context, and local AI operations. That kind of product benefits from a strong inner core because the rules of the authoring model need to remain stable even when runtimes and integrations change.

## TODO

- Some concepts currently live more in the application layer than the domain layer because they are orchestration-heavy. That is reasonable, but over time the team may want to clarify which context-engineering rules are true domain policy versus application assembly policy.
- The workflow aggregate is clearly central, but some adjacent concepts—especially tool publication metadata and certain authoring concerns—could eventually deserve stronger domain-level abstractions if they continue to grow.

## Asset system foundation (Direction 2, first slice)

The asset layer is now moving from a simple catalog toward a cross-cutting system-of-record envelope for durable artifacts.

### New canonical concepts

The domain now includes explicit types for:
- stable asset identity (`AssetId`)
- immutable revisions (`AssetVersion`)
- typed lineage relationships (`AssetLineageEdge`)
- derivation/transformation records (`AssetTransformation`)

These concepts are persistence-agnostic and model reproducibility/traceability directly instead of relying only on loose `version`, `parentAssetId`, or generic relationship strings.

`AssetVersion` is the immutable snapshot model (`versionId`, `assetId`, `createdAt`, optional `parentVersionId` / `versionLabel` / checksum summary), while `Asset` remains the mutable catalog envelope. `AssetTransformation` now explicitly captures multi-input / multi-output derivations and transformation outcome (`success` / `failed` / `partial` / `degraded`). `AssetLineageEdge` now uses strict relationship typing (for example `DERIVED_FROM`, `GENERATED_FROM`, `TRAINED_FROM`) with explicit directional semantics.

### Canonical vs projected

Current canonical storage for this slice is:
- existing asset catalog (`LocalAssetRepository`) for backward-compatible asset listing/edit flows
- new SQLite asset system repository for version/lineage/transformation history

Projected sources currently supported:
- uploaded files (projected as uploaded assets + first version)
- dataset exports (projected as dataset assets + version + derivation transformation)
- workflow execution outputs (projected as generated assets + version + transformation + lineage edges)
- dataset-generation execution batches (projected as dataset-generation assets + version + transformation, and lineage edges when source documents resolve to known asset versions)
- model-training artifacts (projected as model-artifact assets + version + transformation, with lineage from known dataset/base-model asset versions when available)

Projection is additive and migration-friendly; no existing flow was removed.

### Lineage and execution seam

Execution infrastructure now has an optional `ExecutionAssetLineageRecorder` seam. When supported workflow execution paths produce output assets, they can emit structured asset-system records without altering workflow execution truthfulness semantics.

The current integrated flow resolves upstream input assets to known asset versions, creates output `AssetVersion` snapshots, records `AssetTransformation`, and automatically emits lineage edges from transformation input/output pairs. This now applies across workflow-output, dataset-generation, and model-training artifact projections.

Model-training requests now support explicit asset-lineage identity hints (`datasetVersionAssetId`, `baseModelAssetId`, direct `sourceVersionIds`, and optional output namespace) so lineage projection prefers canonical IDs over broad heuristic lookup.

Partial provenance remains explicit: when upstream version truth is unavailable, lineage edges are not invented.

### Neo4j readiness

A graph projection port (`IAssetLineageGraphProjectionSink`) was introduced and wired to a no-op local implementation for now. This keeps the domain and application contracts ready for a future Neo4j projection layer without making graph infrastructure mandatory today.

### Next chunk focus

Future work should tighten identity contracts across model outputs, dataset versions, and execution artifacts while gradually migrating read/query surfaces to the canonical versioned lineage layer.

## Direction 2 update: canonical durable-entity unification (current slice)

This slice expands canonical asset-system participation beyond execution outputs:
- workflow definitions now publish canonical `workflow-definition:{workflowId}` assets with immutable versions.
- installed/base models now publish canonical `installed-model:{modelId}` assets and bind both `installed-model` and `base-model` identities.
- dataset versions now publish canonical `dataset-version:{datasetId}:{versionId}` assets and immutable versions.

Identity resolution now flows through explicit canonical identity contracts (`ICanonicalAssetIdentityRepository` + `CanonicalAssetIdentityService`) so application paths can resolve:
- canonical asset id for workflow/model/dataset-version entities
- latest canonical version id when truthfully known
- explicit pinned version ids when needed

Canonical read/query surfaces now include dedicated application use cases for:
- loading canonical asset summary by asset id
- listing canonical assets by durable kind/source/status
- listing versions and latest version per canonical asset
- loading transformation history for an asset or version
- loading direct dependencies/dependents for a version

Bounded impact analysis is now available through `GetAssetImpactAnalysisUseCase` and returns explainable direct/transitive downstream version impact, transformation consumers, and explicit partial-lineage warning signals.

SQLite asset-system persistence now includes canonical identity mappings and normalized query paths/indexes for durable filters (`kind/source/status`), latest-version lookup, transformation lookup by asset, and adjacency traversal.

What remains for next chunks:
- broaden canonical-read adoption across additional legacy catalog/repository UI paths
- expand graph sink projection wiring from in-memory/local proof toward pluggable Neo4j-backed projection (still optional)
- add richer partial-lineage diagnostics and UI-driven impact exploration without requiring full graph mode.

SQLite storage now also carries normalized `asset_versions.version_label` and `asset_versions.parent_version_id` columns (plus legacy JSON payload compatibility) so version-chain queries can progressively move from blob parsing to explicit relational reads.
