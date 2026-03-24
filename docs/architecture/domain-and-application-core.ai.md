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


## Direction 3 update: MCP plugin registry/capability contracts (current slice)

The MCP layer now has an explicit inner-layer contract for installed tool definitions:
- domain-level MCP tool capability schema (`id`, `version`, display metadata, I/O schemas, side effects, auth metadata, cost/execution hints, tags/categories, optional runtime binding).
- application-layer registry use cases for install/register, list/detail, enable/disable transitions, safe uninstall, and capability introspection queries.
- structured registry errors (`invalid-definition`, `duplicate-install`, `unsafe-removal`, contract violations) to keep UI and automation error handling deterministic.

This keeps MCP tools on the same inner-layer-first path as other first-class capabilities and creates a clean seam for later workflow-node integration, permissions, and agent/planner selection behavior.

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
- loading canonical asset detail with latest version + aggregate counts
- loading bounded provenance summaries (direct upstream/downstream + producer/consumer transformations)
- loading explicit "why this version exists" explanations from transformation/lineage evidence

Canonical read preference is now integrated into three durable real flows (with explicit fallback semantics when canonical identity is missing):
- `LoadWorkflowUseCase` now routes canonical resolution through a shared resolver and returns canonical identity/version metadata plus bounded provenance and dependency-state hints.
- `ListInstalledModelsUseCase` now defaults to the same shared canonical operational resolver path, and identity-only fallback now lives inside that shared service instead of caller-side stitching.
- `DefaultTuningDatasetStudioApplicationService` now uses the same shared resolver path for dataset-version detail/list responses, including centralized identity-only fallback behavior when resolver infrastructure is unavailable.

Canonical read consolidation now has a dedicated application helper (`CanonicalEntityOperationalReadService`) so higher-level flows do not each hand-roll canonical + fallback semantics.

Dependency-health capability now includes both bounded impact analysis and a direct operational summary (`GetAssetDependencyHealthUseCase`) that distinguishes:
- direct upstream/downstream dependencies
- transitive downstream invalidation exposure (bounded depth)
- confidence (`certain` vs `partial`) with explicit partial-lineage reasons
- transformation consumers and stale-exposure explanations for downstream assets/versions

SQLite asset-system persistence now includes canonical identity mappings and normalized query paths/indexes for durable filters (`kind/source/status`), latest-version lookup, version-chain queries, transformation lookup by asset, adjacency traversal, and identity lookup/index coverage for durable entity mappings.
It now also persists canonical dependency-state snapshots (`canonical_dependency_state`) so dependency-state can be reused operationally (fresh cached reads) or re-derived truthfully when forced/refreshed.

Graph-projection readiness now moves beyond a no-op seam:
- projection replay is now supported from canonical storage (`ReplayAssetGraphProjectionUseCase`) with bounded scoping by asset/version/transformation ids.
- the in-memory projection sink can now answer simple path checks (`hasVersionPath`) to prove graph-oriented behavior without requiring Neo4j.
- projection verification now supports scoped version-adjacency parity checks plus scoped edge-parity mismatch details between canonical storage and projection traversal (`VerifyAssetGraphProjectionUseCase`) with explicit verification summaries.
- a concrete Neo4j-targeted sink contract (`Neo4jAssetLineageGraphProjectionSink` + `INeo4jCypherExecutor`) now exists as the default graph-db projection target in composition, while still using a local no-op executor unless a real driver adapter is configured.

Dependency lifecycle semantics now include explicit application-layer states (`healthy`, `impacted`, `stale`, `partially-trusted`, `reconciliation-needed`) via `GetCanonicalDependencyStateUseCase`, plus bounded reconciliation/refresh helpers:
- dependency-state summaries now carry lifecycle source metadata (`persisted-fresh` vs `recomputed`) with explicit reason text for operational explainability.
- `RefreshCanonicalDependencyStateUseCase` to recompute dependency-state summaries with explicit persisted-vs-refresh behavior.
- `ReconcileCanonicalIdentityMappingsUseCase` to heal stale/missing pinned version references.
- canonical workflow/model/dataset operational reads now surface explicit trust/explanation/next-step metadata (`operationalStatus`) derived from canonical dependency-state.
- `ReplayScopedAssetGraphProjectionUseCase` for scoped graph replay by canonical entity mapping.
- `ProjectionRebuildOrchestrationUseCase` for bounded multi-scope replay + optional verification (entity and asset scopes).

Broader canonical-read adoption now also includes legacy UI service seams:
- `WorkflowService` now routes load/list reads through `LoadWorkflowUseCase` when available, so canonical-read preference metadata can be surfaced without page-level lookup duplication.
- `ModelService` now exposes a full installed-model read-model response (`listInstalledModelsReadModel`) so callers can consume canonical identity summaries directly.
- `ModelService.getInstalledModelReadModel` now resolves canonical summaries through the same canonical operational service even when legacy catalog fallback is used, reducing detail-view stitching drift.
- `CanonicalAssetManagementService` now provides a dedicated UI-facing seam for canonical asset detail, dependency-state checks, scoped graph replay, identity reconciliation actions, projection verification, and multi-scope rebuild orchestration.
- renderer composition now wires that seam to desktop runtime-backed canonical repositories by default via the desktop preload bridge (`canonicalAssets`) when available.
- bounded management unification now includes a reusable canonical management snapshot read (`LoadCanonicalAssetManagementSnapshotUseCase`) and a desktop/UI hook (`loadManagementSnapshot`) so a single call can provide canonical detail, version-chain dependency-state rollups, operational remediation summaries, latest-version existence explanation, and scoped projection-health/trust diagnostics.
- projection verification now returns explicit trust state plus scoped mismatch details, and rebuild orchestration can optionally verify-before-replay and replay only mismatched scoped versions.
- projection verification read-model assembly is now centralized (`ProjectionTrustReadModelService`) so desktop handlers and management snapshots share the same trust/comparison/remediation summary semantics.

Partial-lineage diagnostics now include a bounded application read model (`GetAssetLineageDiagnosticsUseCase`) designed for future UI exploration without requiring graph infrastructure at render time.

What remains for next chunks:
- expand canonical asset-management UI usage beyond the current bounded controls (detail/history/verification/rebuild actions are wired; broader UX unification is still pending).
- expand projection replay/sink verification contracts from local proof toward richer Neo4j traversal adapters (still optional) and cover broader entity-scoped rebuild workflows.
- add richer partial-lineage diagnostics and UI-driven impact exploration without requiring full graph mode.
- unify additional legacy-first reads (outside workflow/model/dataset detail/list paths) onto the same canonical operational resolver seam, especially deeper history pages that still stitch fallback metadata ad hoc.
- expose projection rebuild outcomes with richer end-user action narratives in UI (current pass standardizes trust/remediation summaries but keeps rebuild UX intentionally bounded).

Direction 2 is now considered strong enough to hand off to Direction 3:
- canonical operational reads for workflow/model/dataset paths share the same fallback/trust semantics and are stable enough to treat as the backbone.
- projection trust/remediation summaries and management snapshots are now consistent, bounded, and reusable across desktop/UI surfaces.
- remaining caveats are intentionally small and non-blocking (mostly deeper legacy history surfaces and broader UX unification), and further Direction 2 changes should now be driven only by concrete Direction 3 integration needs.

SQLite storage now also carries normalized `asset_versions.version_label` and `asset_versions.parent_version_id` columns (plus legacy JSON payload compatibility) so version-chain queries can progressively move from blob parsing to explicit relational reads.
