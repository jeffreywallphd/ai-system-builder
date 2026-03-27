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
- application-layer registry use cases for install/register, list/detail, enable/disable transitions, safe uninstall, capability introspection queries, and an explicit update lifecycle (`preview` + `apply`) for version transitions.
- structured registry errors (`invalid-definition`, `duplicate-install`, `tool-disabled`, contract violations) to keep UI and automation error handling deterministic.
- safe removal now uses a structured result contract (`removed` or `blocked` with references) instead of mixing result types with thrown unsafe-removal errors.
- install/update semantics are now version-aware:
  - `install` for first-time registration
  - `reinstall` vs `duplicate-install` for same-version attempts (explicit behavior)
  - `update`/`downgrade`/`replace` actions for non-trivial transitions
  - explicit transition classification (`same-version`, `upgrade`, `downgrade`, `incomparable`) rather than install-overwrite-only behavior.
- installed-tool records now carry lifecycle metadata (`versionPolicy`, last action/transition, transition counters, previous/current resolved versions) so list/detail read models expose lifecycle state directly.
- update preview now returns machine-readable change summaries (version, binding, input/output schema, side effects, auth, asset I/O contract, tags/categories) plus compatibility/risk classification for future UI/workflow/agent surfaces.
- installed-tool list/detail read models now project lifecycle-operational state directly (resolved version, source, version policy, last transition/action, history summary counts, update posture) so callers do not reconstruct lifecycle state manually.
- update apply now integrates bounded dependency safety: risky/breaking updates are blocked when dependent workflows exist unless force/override flags are supplied.
- update preview/apply now also emit explicit dependency-safety posture (`no-dependencies` / `safe` / `ack-required` / `blocked`) for deterministic higher-layer gating.
- compatibility classification now includes bounded schema-contract heuristics (required-field deltas, property add/remove, and field type changes), plus optional policy profiles (`strict`, `balanced`, `permissive`) for different safety postures.
- update apply now supports explicit approval acknowledgements (`acknowledgedRisk`, `acknowledgedBreaking`) so risky/breaking transitions require deliberate confirmation in higher-layer workflows.
- installed-tool lifecycle metadata now persists durable per-tool lifecycle events (install/reinstall/update/downgrade/replace) that power lifecycle history/summary read models for observability.
- update preview/apply now emit remediation guidance suggestions for dependent-workflow impact review, output contract revalidation, trust-policy checks, and downgrade mitigation planning.
- change-summary fidelity now includes source/policy deltas, permission-set deltas, and structured change classification buckets (informational vs compatibility-risk vs likely-breaking vs dependency-impact) including explicit asset-I/O contract impact classification.
- capability introspection is still intentionally bounded, but now supports deeper schema-type matching (nested path and array-item checks), explicit auth-kind filtering, tag/category match modes, and side-effect ceilings for future planner/agent selection.
- runtime contract validation remains pragmatic and non-exhaustive, but now includes nested object/array checks, enum checks, nullable handling, and clearer issue paths.
- asset-I/O contracts now include explicit mixed raw+asset declarations, input version requirements, and output persistence semantics so MCP execution and discovery surfaces can reason about asset-backed behavior without ad hoc assumptions.

This keeps MCP tools on the same inner-layer-first path as other first-class capabilities and creates a clean seam for later workflow-node integration, permissions, and agent/planner selection behavior.

## Direction 3 update: MCP trust foundation (stories 4–5)

The MCP inner/application layers now include a bounded but real trust foundation:

- capability contracts can declare structured auth credential fields and explicit permission scopes alongside side-effect class.
- installed tool records carry explicit granted-permission policy state.
- credential storage/resolution uses a dedicated secret repository port instead of passing secrets through ad hoc tool metadata/read models.
- execution orchestration resolves credential state through an auth service, performs explicit permission-policy checks, and returns structured denials for missing auth or blocked permissions.
- execution decisions now emit non-secret audit events through a dedicated audit sink port.

This slice is intentionally local-first and bounded:
- it does not implement enterprise IAM/RBAC.
- secret persistence prefers desktop secure encryption (`safeStorage`) with an encrypted-local fallback path when secure storage is unavailable.
- secret resolution is now scope-aware (`project -> user -> global`, with global default for backward compatibility).
- sandboxing is still bounded to application/runtime policy gates: policy shape is explicit (`network.allowed`, `filesystem.allowed`, `assets.read/write`, `environment.allowedEnvVars`), network/filesystem/asset posture is invocation-level enforced, and environment exposure remains declared-only metadata.
- it creates a stable seam so stronger secret backends, consent UX, and process sandboxing can layer in later without redesigning core contracts.

## Direction 5 update: Studio shell inner foundation (stories 1.1–1.2)

The studio shell now has a bounded inner-layer model and application orchestration seam for asset authoring sessions:
- domain model in `domain/studio-shell/StudioShellDomain.ts` introduces `Studio`, `AssetSession`, `AssetDraft`, and `AssetMetadata` with lifecycle/invariant rules (session mutability, draft revisioning, studio/session ownership checks).
- taxonomy and contract remain explicit-but-separate metadata concerns on `AssetMetadata` (`taxonomy` uses `CompositionTaxonomyDescriptor`; `contract` uses `AssetContractDescriptor`) so classification and interaction-surface semantics are not collapsed.
- application orchestration in `application/studio-shell/DefaultStudioShellApplicationService.ts` now exposes studio initialization, session start, draft create/load/update flows over a dedicated repository port (`IStudioShellRepository`).
- inner-layer tests cover both domain invariants and orchestration behaviors (`domain/studio-shell/tests/*`, `application/studio-shell/tests/*`).

## Direction 5 update: Studio shell metadata integration (stories 1.3–1.4)

- taxonomy authoring now uses the shared taxonomy seam with deterministic combination validation in the studio shell draft lifecycle (`assertAllowedCompositionTaxonomyCombination` in `domain/taxonomy/CompositionTaxonomy.ts`, applied by `normalizeAssetMetadata`).
- contract authoring remains a separate metadata concern and now has stricter execution metadata normalization/validation (`domain/contracts/AssetContract.ts`) while still round-tripping on the same draft/session model.
- draft updates now support metadata patch semantics (`AssetMetadataPatch`) so taxonomy and contract can be independently set/updated/cleared without overwriting each other, while full metadata replacement remains available.
- application orchestration maps domain validation failures for create/update into typed invalid-request errors (`StudioShellInvalidRequestError`) to keep higher-layer behavior deterministic.

## Direction 5 update: Studio shell provenance + versioning foundation (stories 1.5–1.6)

- studio-shell `AssetMetadata` now includes a separate provenance envelope (`creatorId`, `sourceType`, `sourceLabel`, `derivationContext`, and typed upstream asset/version references) with deterministic normalization + validation in the same inner-layer metadata lifecycle.
- provenance remains distinct from taxonomy and contract; patch semantics now support set/update/clear for provenance without collapsing the other metadata concerns.
- studio-shell draft authoring now has an explicit publish/version transition (`publishAssetDraftVersion`) that emits canonical `AssetVersion` snapshots from draft state.
- draft revisioning and publish/versioning are explicitly separate:
  - draft content/metadata edits increment `revision`
  - publish operations append immutable version ids/history and track latest published version separately.
- version creation now reuses canonical asset vocabulary (`AssetVersion`, parent version linkage, upstream version ids, immutable version-id conflict semantics) through the existing studio-shell application/repository seam.
- studio-shell application orchestration now includes explicit publish and version-history operations over `IStudioShellRepository` version persistence methods, with focused domain/application tests for normalization, validation, persistence behavior, and orchestration flow.

## Direction 5 update: Studio shell dependency + lifecycle controls (stories 1.7–1.8)

- studio-shell drafts now carry explicit dependency references (`assetId` + optional `versionId`) as a bounded concern separate from provenance and taxonomy/contract metadata.
- dependency references are normalized/deduplicated in the domain model and persisted/retrieved through the existing draft/session application flow.
- publish/version snapshots now include draft dependency references in version metadata and merge dependency version ids into canonical `AssetVersion.upstreamVersionIds` without replacing provenance behavior.
- draft authoring now has explicit lifecycle state (`draft` | `validated` | `published`) with deterministic transition rules.
- lifecycle transitions are enforced in the domain; invalid transitions now map to typed application failures (`StudioShellInvalidLifecycleTransitionError`) instead of string-matched handling.
- studio-shell now has a bounded backend/UI boundary through `infrastructure/api/studio-shell/StudioShellBackendApi.ts`, reusing `DefaultStudioShellApplicationService` and `IStudioShellRepository` while projecting a reusable shell snapshot (studio/session/draft/version/readiness state).
- validation/error handling for studio-shell is now structured across that boundary: typed operation codes (`not-found`/`conflict`/`invalid-request`/`invalid-lifecycle-transition`) plus deterministic `validationIssues` sections for taxonomy, contract, provenance, dependencies, lifecycle readiness, and publish/version status.

## Direction 5 update: Studio shell persistence integration (story 1.11)

- Studio shell now has a real SQLite-backed infrastructure adapter (`infrastructure/filesystem/studio-shell/SqliteStudioShellRepository.ts`) implementing `IStudioShellRepository` with migration-managed schema, indexed studio/session/draft/version storage, and full aggregate snapshot persistence.
- Rehydration paths normalize persisted metadata/dependencies and reconstruct studio/session/draft/version state through existing domain normalization seams so taxonomy/contract/provenance/dependency/lifecycle/version invariants stay bounded to inner-layer rules.
- Desktop composition now uses the SQLite repository for studio-shell IPC operations (`electron/main/main.ts`) so studio/session/draft/version state survives process restarts.

## Direction 5 update: Studio shell extension interface (story 1.12)

- Studio shell now includes a bounded typed extension contract for renderer panel contributions (`ui/studio-shell/StudioShellExtensions.ts`) with explicit slot targeting, ordering, and duplicate-id rejection.
- `StudioShellPage` composes registered extension panels alongside shared shell concerns (session/draft context, metadata/dependencies/lifecycle surfaces, validation/error display) without moving business rules out of backend/application contracts.
- publish operations are lifecycle-gated (`validated` required) while remaining distinct from draft revisioning and immutable version history semantics.

## Direction 5 update: Studio shell initial end-to-end vertical slice (story 1.13)

- Studio shell now has a tested vertical flow across real seams (`StudioShellService` -> desktop bridge -> `StudioShellBackendApi` -> `DefaultStudioShellApplicationService` -> `IStudioShellRepository` SQLite adapter) rather than isolated layer checks.
- The bounded end-to-end path covers studio initialization/load, draft create/update, metadata patching (taxonomy/contract/provenance), dependency updates, lifecycle transitions, backend-authoritative validation projection, publish/version creation, and persisted snapshot reload.
- Persistence-backed publish truth remains explicit: draft revision/lifecycle semantics stay distinct from immutable version history semantics, and reload tests verify that published state survives repository/host restarts.

## Direction 5 update: Atomic studio registration foundation (story 2.5)

- The existing Studio Shell extension seam now includes a bounded atomic-studio registration contract in `ui/studio-shell/StudioShellExtensions.ts` (`AtomicStudioRegistration`, `AtomicStudioRegistry`) rather than introducing a second plugin architecture.
- Registration behavior is deterministic (`studioType` uniqueness, role validation, stable list ordering, slot-scoped extension lookup) and intentionally minimal: studio identity, atomic role, bounded draft defaults, and optional slot contributions.
- Atomic registrations inherit shared shell behavior (session/draft context, metadata/dependencies/lifecycle/version validation and publish flows), with `StudioShellPage` optionally consuming registration defaults/extensions.

## Direction 5 update: Model studio domain + application slice (story 2.6)

- Model Studio now has a thin inner-layer domain helper (`domain/model-studio/ModelStudioDomain.ts`) that authors atomic model metadata (`atomic/model/none`) with generated provenance defaults.
- A bounded application orchestrator (`application/model-studio/ModelStudioApplicationService.ts`) builds on `StudioShellApplicationService` so model authoring reuses shared shell create/update/publish/version behavior.
- Model authoring now reuses shared contract/provenance/version semantics:
  - taxonomy-driven model contracts resolve through `CompositionAssetContractResolver.resolveContractForTaxonomy` for `semanticRole=model`.
  - publish transitions and immutable version creation remain in the shared studio-shell lifecycle flow.

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

## Direction 4 update: first bounded real agent slice (stories 6.1–6.4)

- `Agent` is now a fuller domain concept (not just a config bag):
  - stable identity + explicit display name
  - structured prioritized goals with optional required-tool constraints
  - MCP-registry-aligned `allowedTools` (`mcp:<serverId>:<toolName>`)
  - asset-backed memory configuration (scoped asset ids + retrieval policy)
  - planning strategy reference
  - execution policy/trust linkage (`trustPolicyId`, trusted-tool posture, bounded max steps)
  - lifecycle status (`draft`/`ready`/`paused`/`archived`)
  - stable agent read models so callers do not reconstruct state manually.
- Validation invariants were tightened for create/update:
  - non-empty id/name/goals/tool set
  - strict MCP tool identity format
  - memory config must use canonical asset references for durable writable types (session-only-only configs may initialize without assets)
  - per-goal required tools must be inside the allowed tool set
  - bounded retrieval/execution numeric policies.
- Planning moved from trivial pass-through to explicit deterministic planning service:
  - planner inspects prioritized goals + allowed tools + memory-query context
  - planner filters allowed tools against currently available capability catalog entries
  - planner produces a machine-readable bounded plan (`planId`, ordered steps, selected tool id per step, attached memory context).
- Agent memory now has a real asset-backed implementation:
  - `AssetBackedAgentMemoryStore` persists memory through asset catalog + immutable asset versions
  - memory entries are scoped by agent, tagged, metadata-capable, and queryable for planning/execution.
- Agent execution now composes planning + execution + memory persistence:
  - `AgentExecutionService` builds a bounded execution graph from planner output
  - executes each planned step via existing tool execution pathways (`ExecuteAgentToolsUseCase` and underlying MCP/workflow executors, preserving trust/policy enforcement)
  - returns stable per-step outcomes
  - persists execution outcomes back to agent memory assets.
- This remains intentionally bounded: deterministic single-agent planning only, no speculative autonomous loops, and no separate execution engine.

## Direction 4 update: Phase 5 hardening + Phase 6 inner authoring foundation

- Runtime retry/failure contracts are now explicit in application-layer agent runtime semantics:
  - retryability classification remains policy-first with runtime metadata hints and bounded heuristic fallback.
  - retry exhaustion is surfaced explicitly (`retryExhausted`) on terminal failures.
- Partial execution outcomes now remain durable across the same inner contracts:
  - runner read model: ordered per-step outcomes
  - working memory: per-step execution output summaries
  - execution sessions: persisted per-step outcome summaries and output-asset diagnostics.
- Session terminal-state truth is now explicit instead of inference-only:
  - `AgentExecutionSession.terminalState` captures terminal `reason` (`completed`/`failed`/`cancelled`/`blocked`) and bounded partial-progress summary (`hadPartialProgress`, completed/attempted step counts).
  - blocked-before-step runs persist as failed lifecycle status with terminal reason `blocked`, so blocked vs failed remains machine-readable in persisted session state.
- Session persistence remains port-first and infrastructure-backed:
  - application port: `IAgentExecutionSessionRepository` (including transition history reads)
  - infrastructure adapter: `SqliteAgentExecutionSessionRepository` with structured terminal/progress columns (`terminal_reason`, `had_partial_progress`, `completed_step_count`, `attempted_step_count`, `step_outcome_count`) plus canonical session JSON snapshots.
- Phase 6 authoring/configuration now extends the inner application core:
  - persistence seam: `IAgentRepository` + `SqliteAgentRepository`
  - CRUD use cases: `CreateAgentUseCase`, `UpdateAgentUseCase`, `GetAgentUseCase`, `ListAgentsUseCase`, `DeleteAgentUseCase`, `ArchiveAgentUseCase`
  - CRUD failure paths now use explicit application error classes (`AgentConflictError`, `AgentNotFoundError`, `AgentInvalidRequestError`) so transport/API mapping is deterministic without message-substring parsing
  - structured configuration use cases: `ConfigureAgentGoalsUseCase`, `ConfigureAgentPolicyUseCase`, `ConfigureAgentToolsUseCase`, `ConfigureAgentMemoryUseCase`, `ConfigureAgentStrategyUseCase`
  - policy configuration updates are now centralized through a shared domain seam (`AgentPolicyConfiguration`) so tool-access, safety approvals/sandbox, and cost/execution limits are updated with one deterministic normalization/validation path.
  - goal authoring semantics are now deterministic through a shared domain configuration seam (`AgentGoalConfiguration`): add/update/remove/reorder operations reject duplicate goal ids, missing goal references, malformed required tool ids, and non-contiguous priority ordering.
  - goal ordering invariants are now normalized around contiguous `priorityOrder` values starting at 1 so create/update/configure flows share one coherence rule.
  - cohesive whole-config validation seam: `AgentConfigurationValidationService` + `ValidateAgentConfigurationUseCase`, now with deterministic cross-field issue codes for goal/tool/memory/policy/strategy coherence before domain fallback validation.
  - any new agent-facing artifact/read model must reuse shared composition seams (`CompositionTaxonomyClassifier` classification or `CompositionAssetContractResolver` projection) instead of introducing agent-only presentation semantics.
  - `SqliteAgentRepository` now also persists structured authoring/query metadata (`strategy_id`, `strategy_mode`, `goal_count`, `allowed_tool_count`) while preserving aggregate round-trip via `agent_json`.
  - repository read paths now rehydrate `agent_json` snapshots through domain normalization so round-tripped aggregates keep canonical memory asset refs and validated goal/policy/tool/planning/execution semantics.
  - memory contracts are now hardened for authoring/configuration updates:
    - canonical asset-backed references + malformed-id rejection
    - retrieval compatibility validation (`latest-first` / `semantic-filter` / `hybrid`)
    - writable/retrievable/session-only type coherence checks
    - explicit session-only vs durable retention contradiction checks.
    - structured memory issue codes now explicitly cover malformed/non-canonical refs, duplicate refs, malformed asset-version ids, semantic/recency range errors, and retention-policy contradictions.
  - strategy contracts are now explicitly bounded to supported descriptors (current slice: `deterministic@deterministic-linear`) with unsupported id/mode combinations rejected deterministically before persistence.
    - structured strategy issue codes now explicitly include missing strategy id and unsupported id/mode combinations.
  - configuration use cases now also emit typed missing/invalid id failures (`AgentNotFoundError`, `AgentInvalidRequestError`) instead of generic message-thrown errors.
  - whole-agent validation output now includes stable sectioned issue structure (`code`, `path`, `section`, `severity`, `message`) and is reused by CRUD/configuration use cases through a common `AgentConfigurationValidationError` path.
  - validation semantics now include explicit create/update pathways (`mode: create|update`) so update flows can enforce immutable-id behavior deterministically.
  - policy/sandbox/trust cross-field contradictions now emit dedicated issue codes (required-vs-denied permission, sandbox denial vs required approval, and tool-scope approval coherence) before generic domain fallback validation.
  - agent read-model contracts now project full memory configuration (`assets`, `retrieval`, `policy`, `revision`) so backend/API callers can consume one canonical authoring contract without reconstructing from partial fields.
  - backend authoring transport now has a dedicated thin seam (`infrastructure/api/agents/AgentAuthoringBackendApi` + desktop IPC `ai-loom-desktop-agents:*`) that maps request/response DTOs to the existing use cases/validation service.
  - backend API error mapping is now type-only (`AgentAuthoringError` + `AgentConfigurationValidationError`), with unknown failures mapped to `internal` instead of substring-coerced transport codes.
  - API read responses now use a hardened projection envelope (`{ agent, taxonomy, contract? }`) where taxonomy is classified through `CompositionTaxonomyClassifier` and contract is projected through `CompositionAssetContractResolver`, so backend authoring responses do not introduce agent-only presentation semantics.
  - backend authoring coverage now includes SQLite-backed integration tests for CRUD + goal/policy/tool/memory/strategy updates and API mapping/error-path tests so real persistence seams are exercised directly.
- No separate agent runtime engine or non-asset memory system was introduced; backend/API transport can stay thin over these use cases.


## Direction 5 update: Model studio UI integration (story 2.7)

- Model Studio now integrates directly through the shared `StudioShellPage` surface using registration-driven wiring (`ui/pages/ModelStudioPage.tsx` + `ui/studio-shell/registrations/ModelStudioRegistration.ts`) rather than introducing a second Model Studio UI architecture.
- Model registration now contributes bounded model-specific extension panels (draft guidance + metadata status) through existing slot seams while shared shell panels remain authoritative for session context, metadata/dependencies, lifecycle/version state, validation, and publish flow.
- `StudioShellPage` now respects registration defaults during draft creation (title/tags plus optional taxonomy/contract/provenance patch fields) so atomic model defaults flow through the same backend/application contracts.

## Direction 5 update: Dataset studio domain + application slice (story 2.8)

- Dataset Studio now has a thin inner-layer domain helper (`domain/dataset-studio/DatasetStudioDomain.ts`) that authors atomic dataset metadata (taxonomy `atomic/dataset/none`) with generated provenance defaults.
- A bounded application orchestrator (`application/dataset-studio/DatasetStudioApplicationService.ts`) mirrors the Model Studio pattern and reuses `StudioShellApplicationService` for initialize/create/publish lifecycle rather than duplicating shell orchestration.
- Shared taxonomy-driven contract projection now includes atomic dataset defaults in `CompositionAssetContractResolver`, keeping dataset authoring aligned with shared contract/provenance/version semantics.

## Direction 5 update: Dataset studio UI integration (story 2.9)

- Dataset Studio now integrates through the shared shell renderer with registration-driven wiring (`ui/pages/DatasetStudioPage.tsx` + `ui/studio-shell/registrations/DatasetStudioRegistration.ts`) instead of introducing a second dataset page architecture.
- Dataset registration contributes bounded dataset-specific panel guidance (`draft-authoring`, `metadata`) while shared shell surfaces remain authoritative for session/draft context, taxonomy/contract/provenance/dependencies, validation, lifecycle, and publish/version state.
- Dataset Studio flow now has an explicit renderer-service integration test over the real shell backend/persistence path (`ui/services/tests/StudioShellService.integration.test.ts`) using dataset-studio studio ids and taxonomy semantics.

## Direction 5 update: Tool studio domain + application slice (story 2.10)

- Tool Studio now has a thin inner-layer domain helper (`domain/tool-studio/ToolStudioDomain.ts`) for atomic tool authoring with taxonomy `atomic/tool/(conditional|deterministic)` and generated provenance defaults.
- A bounded application orchestrator (`application/tool-studio/ToolStudioApplicationService.ts`) mirrors model/dataset patterns and reuses `StudioShellApplicationService` for initialize/create/publish lifecycle instead of duplicating shell orchestration.
- Shared taxonomy-driven contract projection now includes atomic tool defaults in `CompositionAssetContractResolver.resolveContractForTaxonomy`, aligning Tool Studio draft metadata with shared contract/provenance/version semantics and MCP/API-facing provider metadata posture.

## Direction 5 update: Tool studio UI integration (story 2.11)

- Tool Studio now integrates through the same shared shell renderer/route seam as Model and Dataset Studio (`ui/pages/ToolStudioPage.tsx` + `ui/studio-shell/registrations/ToolStudioRegistration.ts` + `/studio-shell/tool` route wiring) instead of a separate page architecture.
- Tool registration contributes bounded tool-specific panel guidance (`draft-authoring`, `metadata`) and MCP/API-oriented draft defaults while preserving shared shell authority for session/draft state, dependency/lifecycle/version flows, and backend validation rendering.
- Tool Studio flow now has explicit renderer-service integration coverage over the real shell backend/persistence path (`ui/services/tests/StudioShellService.integration.test.ts`) using tool-studio ids/taxonomy semantics.

## Direction 5 update: Atomic validation standardization (story 2.12)

- Shared studio-shell validation projection is now centralized in one application seam (`application/studio-shell/StudioShellValidation.ts`) and consumed by backend snapshot/validate endpoints, replacing backend-local duplicate validation assembly.
- Atomic registration defaults for Model/Dataset/Tool now reuse taxonomy-driven contract projection through a shared registration helper (`ui/studio-shell/registrations/AtomicStudioRegistrationDefaults.ts`) so default metadata validity posture is consistent across atomic studios.
- Shared shell default dependency authoring now starts with an empty dependency set (instead of an implicit unpinned seed dependency), removing studio-specific accidental warning drift while preserving backend-authoritative dependency validation semantics.
- Focused tests now cover cross-atomic validation consistency and shared issue structure (`application/studio-shell/tests/StudioShellValidation.test.ts`, `infrastructure/api/studio-shell/tests/StudioShellBackendApi.test.ts`).

## Direction 5 update: Atomic contract and taxonomy enforcement hardening (stories 2.13–2.14)

- Atomic publish flows for Model/Dataset/Tool now enforce shared taxonomy + contract truth through one reusable application seam (`application/studio-shell/AtomicStudioAssetEnforcement.ts`) instead of studio-specific ad hoc checks.
- Enforcement validates structural kind (`atomic`), expected semantic role (`model`/`dataset`/`tool`), allowed behavior kinds (including bounded tool `conditional|deterministic`), and contract equivalence against taxonomy-driven projection (`CompositionAssetContractResolver.resolveContractForTaxonomy`).
- Model/Dataset/Tool application publish orchestration now runs this shared enforcement before lifecycle transition/publish so metadata drift introduced via shell patching cannot publish invalid atomic versions.
- Focused tests now cover cross-studio consistency at the shared seam and publish-gate behavior in each atomic studio service (`application/studio-shell/tests/AtomicStudioAssetEnforcement.test.ts`, `application/model-studio/tests/ModelStudioApplicationService.test.ts`, `application/dataset-studio/tests/DatasetStudioApplicationService.test.ts`, `application/tool-studio/tests/ToolStudioApplicationService.test.ts`).
