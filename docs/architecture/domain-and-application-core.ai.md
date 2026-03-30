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

The MCP inner-layer model now adds an explicit trust/governance foundation:
- capability contracts can now declare structured credential fields and explicit permission scopes (`asset.read`, `asset.write`, `network.access`, filesystem/system scopes) in addition to side-effect class.
- installed-tool records now carry explicit granted-permission policy state so policy can be associated with each installed tool, not inferred ad hoc at call sites.
- application-layer auth/secret seams now flow through a dedicated secret repository port and an auth service that reports credential status (configured/missing required fields) without returning raw secret values in normal read models.
- execution-time policy now runs through a dedicated permission-policy service and yields explicit allow/deny decisions with structured denied scopes; denials are surfaced as structured registry errors (`permission-denied`, `missing-auth-configuration`, `auth-resolution-failed`).
- execution decisions are now emitted through an audit sink port with non-secret decision payloads, creating a seam for later trust/audit UX without forcing enterprise IAM scope in this slice.

Current limitations (intentional for this pass):
- secret persistence is still local-first, but now uses secure desktop encryption (`safeStorage` bridge) when available and encrypted local fallback otherwise.
- scope is intentionally bounded to global/project with a user-scope extension seam; this is not a full identity/tenant system.
- sandboxing is still bounded to application/runtime execution policy gates; policy shape is explicit (`network.allowed`, `filesystem.allowed`, `assets.read/write`, `environment.allowedEnvVars`) and network/filesystem/asset posture is invocation-level enforced while environment exposure is declared-only metadata (not hard OS/container isolation).

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

## Direction 5 update: Workflow Studio canonical validation + lifecycle foundation (stories 1.9-1.10)

- Workflow Studio now exposes a canonical workflow-definition validation engine in `domain/workflow-studio/WorkflowStudioDomain.ts` via `validateWorkflowDraft(...)` and `validateWorkflowEntity(...)`, with structured deterministic issues (`code`, `section`, `severity`, `path`, `message`) for triggers, inputs, steps, outputs, and cross-section dependency rules.
- Output validation now also enforces destination-specific readiness in that same canonical path (file-export format checks, web-viewer title requirements, and system-entry entity-name requirements) so output authoring gates are not UI-only.
- Validation remains inner-layer and reusable across authoring surfaces, persistence gates, and runtime-preparation readiness checks (no UI-local source of truth path).
- Workflow entity lifecycle is now explicit and transition-guarded (`draft` -> `saved` -> `executable`) through `WorkflowLifecycleStates`, `isWorkflowLifecycleTransitionAllowed(...)`, and `transitionWorkflowEntityLifecycle(...)`.
- `executable` state is now domain-gated by canonical draft readiness (lifecycle transition/create validation uses workflow-definition validation, not presentation flags).
- Workflow Studio publish flow now enforces canonical workflow-content validation before lifecycle publish/version operations (`application/workflow-studio/WorkflowStudioApplicationService.ts`).

## Direction 5 update: Workflow Studio persistence + taxonomy alignment (stories 1.11-1.12)

- Workflow Studio canonical draft and entity models now expose explicit persistence mappings and versioned serialized-document shapes (`mapWorkflowDraftToPersistenceRecord`, `mapWorkflowEntityToPersistenceRecord`, `serializeWorkflowDraftDocument`, `serializeWorkflowEntity`) in `domain/workflow-studio/WorkflowStudioDomain.ts`.
- Draft/entity rehydration now goes through canonical normalization (`mapWorkflowDraftFromPersistenceRecord`, `mapWorkflowEntityFromPersistenceRecord`, `deserializeWorkflowDraftDocument`, `deserializeWorkflowEntity`) so identity/metadata/lifecycle/triggers/inputs/steps/outputs survive round-trip without UI-local shaping.
- Workflow asset-backed references now carry taxonomy metadata on canonical asset refs (`WorkflowDraftAssetReference.taxonomy`) and are validated against shared taxonomy expectations for dataset-backed inputs and agent-assistant steps.
- Workflow draft validation now emits deterministic taxonomy/asset-reference issues for mismatched dataset taxonomy and malformed asset-backed step identities, while keeping canonical validation in the domain layer and publish enforcement in `application/workflow-studio/WorkflowStudioApplicationService.ts`.

## Direction 5 update: Workflow built-in step taxonomy + registry foundation (stories 6.1-6.2)

- Workflow-native built-in steps are now first-class inner-layer contracts in `domain/workflow-studio/WorkflowStudioDomain.ts` with canonical categories (`control-flow`, `temporal`, `human-interaction`, reserved `transformation`) and stable built-in step identities.
- Built-in step contracts now carry canonical discovery metadata (type/category/label/description/config schema id/default config) plus a shared domain validation entry point (`normalizeWorkflowDraftBuiltInStepConfig`), keeping semantics out of UI-local lists/forms.
- The initial built-ins are explicitly modeled and discoverable: `if-then`, `loop-iteration`, `delay-wait`, and `manual-approval`.
- Application discovery is now exposed through `application/workflow-studio/BuiltInWorkflowStepRegistry.ts`, giving wizard/canvas-facing layers a stable built-in step registry without hardcoded page-local definitions.
- Story 6.3 now defines `if-then` as a canonical conditional primitive with explicit condition strategy contracts (`expression` or `comparison`) and explicit branch targets (`then` / optional `else` labels + step references) validated in the same domain normalization path.
- Story 6.4 now defines `loop-iteration` as a canonical loop primitive with explicit mode/source contracts (`fixed-count`, `collection`, `range`) plus bounded body/max-iteration/exit-condition fields; cross-section checks still validate collection input references against canonical workflow inputs.
- Story 6.5 now defines `delay-wait` as a canonical temporal primitive with explicit timing modes (`duration` with structured value/unit, or `until-time` with timestamp/timezone), compatibility aliases (`durationSeconds`, `waitUntil`), and deterministic malformed-config rejection through the same built-in normalization path.
- Story 6.6 now defines `manual-approval` as a canonical human-interaction primitive with explicit interaction modes (`review` or `approval`), structured continuation/decision outcomes, required prompt semantics, timeout behavior policy (`reject`/`continue`/`escalate`), and compatibility aliasing for legacy `approvalMessage` flows.
- Stories 6.7-6.8 keep renderer authoring aligned to those contracts: wizard step selection is registry-backed and mixed with asset-backed options, and wizard built-in editors only write canonical draft config fields that continue to validate through `normalizeWorkflowDraftBuiltInStepConfig` / `validateWorkflowDraft`.
- Stories 6.9-6.10 now add canonical control-flow authoring and planning seams on top of that base:
  - step authoring operations in `ui/studio-shell/workflow/WorkflowWizardSteps.ts` now preserve control-flow integrity during insert/reorder/remove (forward-only branch/body/outcome references, move blocking when a reorder would invalidate control-flow placement, and reference cleanup on removal),
  - domain validation now includes explicit built-in reference order checks (`built-in-step-reference-order-invalid`) for `if-then`, `loop-iteration`, and `manual-approval` outcome references,
  - workflow planning now has a dedicated canonical mapper `application/workflow-studio/WorkflowDraftExecutionPlanMapper.ts` (`mapWorkflowDraftToExecutionPlan`) that validates canonical drafts first and then emits deterministic execution-plan elements for action + built-in step types without introducing a parallel workflow model.

## Direction 5 update: Studio shell persistence integration (story 1.11)

- Studio shell now has a real SQLite-backed infrastructure adapter (`infrastructure/filesystem/studio-shell/SqliteStudioShellRepository.ts`) implementing `IStudioShellRepository` with migration-managed schema, indexed studio/session/draft/version storage, and full aggregate snapshot persistence.
- Rehydration paths normalize persisted metadata/dependencies and reconstruct studio/session/draft/version state through existing domain normalization seams so taxonomy/contract/provenance/dependency/lifecycle/version invariants stay bounded to inner-layer rules.
- Desktop composition now uses the SQLite repository for studio-shell IPC operations (`electron/main/main.ts`) so studio/session/draft/version state survives process restarts.

## Direction 5 update: System Studio inner orchestration (stories 5.9–5.10)

- System Studio now has a bounded application orchestrator (`application/system-studio/SystemStudioApplicationService.ts`) that reuses the shared Studio Shell lifecycle (initialize/open/create/update/validate/publish) instead of introducing a second lifecycle stack.
- System draft authoring remains first-class in shared draft/version persistence; no side-channel system store was introduced.
- System publish flow now enforces recursive system consistency through existing shared seams (`evaluate/assertSystemStudioDraftPublishConsistency`) including nested system resolution, child contract resolution, recursive contract projection, and recursion safety checks.
- System Studio UI integration remains on the shared `StudioShellPage` registration/route architecture (`/studio-shell/system`) with backend-authoritative draft/session/validation/publish behavior.

## Direction 5 update: External runtime bounded safeguards alignment (stories 7.23–7.24)

- External runtime safeguards stay in existing application/infrastructure seams (`SystemRuntimeBackendApi`, `ExecutionUpdateStream`, quota/rate-limit/access/tenant services) instead of introducing a second execution platform.
- Hot-path protections are explicitly bounded and testable: short-lived caller/tenant-scoped poll/status caching, bounded callback registrations per session, bounded streaming subscription/fan-out controls, bounded async in-flight tracking, and bounded emit cadence on execution updates.
- These guards are additive and preserve current correctness constraints (auth/access/tenant/version-aware semantics remain required before returning cached/projection reads).
- Architecture docs now explicitly separate:
  - implemented external runtime surface (stories 7.1–7.23),
  - bounded behavior/limits (in-process, non-distributed),
  - future work (distributed backpressure/observability platforms not in this scope).

## Direction 5 update: Composite dependency semantics + behavior enforcement (stories 3.15–3.16)

- Shared studio-shell dependency validation now performs version-aware identity checks for pinned dependencies (`assetId` must match the resolved `versionId` owner when resolvable through repository/version seams).
- Composite draft validation now enforces bounded dependency semantic-role compatibility when referenced version metadata includes taxonomy descriptors (for implemented composite studios: workflow, context-bundle, dataset-pipeline, training-recipe, tool-chain).
- Composite publish-time enforcement now requires at least one dependency and requires composite dependencies to be version-pinned, reusing the existing shared studio-shell publish-consistency seam rather than adding studio-specific publish gates.
- Existing atomic publish enforcement behavior remains unchanged.

## Direction 5 update: Studio shell extension interface (story 1.12)

- Studio shell now includes a bounded typed extension contract for renderer panel contributions (`ui/studio-shell/StudioShellExtensions.ts`) with explicit slot targeting, ordering, and duplicate-id rejection.
- `StudioShellPage` composes registered extension panels alongside shared shell concerns (session/draft context, metadata/dependencies/lifecycle surfaces, validation/error display) without moving business rules out of backend/application contracts.
- publish operations are lifecycle-gated (`validated` required) while remaining distinct from draft revisioning and immutable version history semantics.

## Direction 5 update: Studio shell initial end-to-end vertical slice (story 1.13)

- Studio shell now has a tested vertical flow across real seams (`StudioShellService` -> desktop bridge -> `StudioShellBackendApi` -> `DefaultStudioShellApplicationService` -> `IStudioShellRepository` SQLite adapter) instead of layer-local tests only.
- The bounded end-to-end path covers studio initialization/load, draft create/update, metadata patching (taxonomy/contract/provenance), dependency updates, lifecycle transitions, backend-authoritative validation projection, publish/version creation, and persisted snapshot reload.
- Persistence-backed publish truth remains explicit: draft revision/lifecycle semantics remain separate from immutable version history semantics, and reload checks verify published state survives repository/host restarts.

## Direction 5 update: Atomic studio registration foundation (story 2.5)

- The existing Studio Shell extension seam now has a bounded studio registration contract in `ui/studio-shell/StudioShellExtensions.ts` (`StudioRegistration`, `StudioRegistrationRegistry`, plus `AtomicStudioRegistry` compatibility) so atomic and composite studios share one extension/registration seam rather than a second plugin architecture.
- Registration is deterministic (`studioType` uniqueness, role validation, stable listing order, slot-scoped extension lookup) and intentionally small: identity, atomic role, bounded draft defaults, and optional slot contributions.
- Atomic registrations inherit the shared shell lifecycle and operational behavior (session/draft context, metadata/dependencies/lifecycle/version validation/publish surfaces), with `StudioShellPage` optionally consuming registration defaults/extensions.

## Direction 5 update: Model studio domain + application slice (story 2.6)

- Model Studio now has a thin inner-layer domain helper (`domain/model-studio/ModelStudioDomain.ts`) that truthfully authors atomic model metadata (taxonomy `atomic/model/none`) with generated provenance defaults.
- A bounded application orchestrator (`application/model-studio/ModelStudioApplicationService.ts`) builds on `StudioShellApplicationService` instead of duplicating shell create/update/publish flows.
- Model drafting/publishing reuses shared contract/provenance/version semantics:
  - taxonomy-driven model contract projection now resolves through `CompositionAssetContractResolver.resolveContractForTaxonomy` for `semanticRole=model`.
  - publish path reuses shared lifecycle transition + immutable version creation from studio shell application service.

## Direction 5 update: Model studio UI integration (story 2.7)

- Model Studio now integrates directly through the shared `StudioShellPage` surface using registration-driven wiring (`ui/pages/ModelStudioPage.tsx` + `ui/studio-shell/registrations/ModelStudioRegistration.ts`) rather than introducing a second Model Studio UI architecture.
- Model registration now contributes bounded model-specific extension panels (draft guidance + metadata status) through existing slot seams while shared shell panels remain authoritative for session context, metadata/dependencies, lifecycle/version state, validation, and publish flow.
- `StudioShellPage` now respects registration defaults during draft creation (title/tags plus optional taxonomy/contract/provenance patch fields) so atomic model defaults flow through the same backend/application contracts.

## Direction 5 update: Dataset studio domain + application slice (story 2.8)

- Dataset Studio now has a thin inner-layer domain helper (`domain/dataset-studio/DatasetStudioDomain.ts`) that authors atomic dataset metadata (taxonomy `atomic/dataset/none`) with generated provenance defaults.
- A bounded application orchestrator (`application/dataset-studio/DatasetStudioApplicationService.ts`) mirrors the Model Studio pattern and reuses `StudioShellApplicationService` for initialize/create/publish lifecycle rather than duplicating shell orchestration.
- Shared taxonomy-driven contract projection now includes atomic dataset defaults in `CompositionAssetContractResolver`, keeping dataset authoring aligned with shared contract/provenance/version semantics.

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
  - memory config must use canonical asset refs for durable writable types (session-only-only initialization may omit assets)
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

- Runtime retry/failure semantics are now explicit at the application contract boundary:
  - retryability comes from policy override, runtime metadata hints, then bounded heuristic fallback.
  - retry exhaustion is explicitly surfaced (`retryExhausted`) instead of being inferred from event streams only.
- Partial execution outcomes are now preserved across inner read models:
  - `AgentRunnerResult.outcomes` remains ordered per-step truth.
  - `AgentWorkingMemory.executionOutputs` carries completed/failed/cancelled step summaries.
  - execution sessions now persist per-step outcomes and output-asset diagnostics (`domain/agents/AgentExecutionSession.ts`), so "partial success + terminal fail/cancel" is durable.
- Session terminal truth is now explicit and persisted:
  - `AgentExecutionSession.terminalState` captures terminal `reason` (`completed`/`failed`/`cancelled`/`blocked`) plus bounded partial-progress summary (`hadPartialProgress`, completed/attempted step counts).
  - blocked-before-step runs persist as failed lifecycle status with terminal reason `blocked`, so blocked vs failed remains machine-readable.
- Session persistence remains port-first and architecture-consistent:
  - application port: `IAgentExecutionSessionRepository` (including transition history reads).
  - infrastructure adapter: `SqliteAgentExecutionSessionRepository` with structured terminal/progress columns (`terminal_reason`, `had_partial_progress`, `completed_step_count`, `attempted_step_count`, `step_outcome_count`) plus canonical `session_json` snapshots.
- Phase 6 inner authoring/configuration now starts from the same core-first structure:
  - persistence seam: `IAgentRepository` + concrete `SqliteAgentRepository`.
  - CRUD application use cases: `CreateAgentUseCase`, `UpdateAgentUseCase`, `GetAgentUseCase`, `ListAgentsUseCase`, `DeleteAgentUseCase`, `ArchiveAgentUseCase`.
  - CRUD failure paths now use explicit application error classes (`AgentConflictError`, `AgentNotFoundError`, `AgentInvalidRequestError`) so transport/API mapping does not depend on message substring parsing.
  - bounded structured configuration use cases: goals/policy/tools/memory/strategy (`ConfigureAgent*UseCase`).
  - policy configuration updates are now centralized through `AgentPolicyConfiguration` operations so tool access, safety approvals/sandbox posture, and cost/execution limits share one deterministic normalization/validation path.
  - goal authoring operations are centralized in a domain configuration seam (`AgentGoalConfiguration`): add/update/remove/reorder reject duplicate ids, missing goal references, malformed required tool ids, and non-contiguous ordering.
  - goal ordering invariants are now aligned across create/update/configure flows to contiguous `priorityOrder` values starting at 1.
  - cohesive validation seam: `AgentConfigurationValidationService` + `ValidateAgentConfigurationUseCase` now emits deterministic cross-field issue codes for goal/tool/memory/policy/strategy coherence before domain fallback validation.
  - new agent-facing artifacts/read models continue to flow through shared composition seams (`CompositionTaxonomyClassifier` or `CompositionAssetContractResolver`) rather than introducing agent-only semantics.
  - `SqliteAgentRepository` also projects structured authoring/query metadata (`strategy_id`, `strategy_mode`, `goal_count`, `allowed_tool_count`) while preserving aggregate round-trip in `agent_json`.
  - repository read paths now rehydrate `agent_json` snapshots through domain normalization so persisted aggregates keep canonical memory asset refs and validated goal/policy/tool/planning/execution semantics.
  - memory contracts are now hard-validated for authoring updates (canonical asset-backed refs, retrieval compatibility, writable/retrievable/session-only coherence, and retention/session-only contradiction checks).
    - explicit structured issue codes now cover non-canonical/malformed refs, duplicate refs, malformed asset-version ids, semantic/recency range errors, and retention-policy contradictions.
  - strategy contracts are now explicitly bounded to supported descriptors (current slice: `deterministic@deterministic-linear`) with unsupported id/mode combinations rejected deterministically.
    - explicit structured issue codes now include missing strategy id and unsupported id/mode combinations.
  - whole-agent validation issues now include explicit section metadata (`goals`/`tools`/`memory`/`strategy`/etc.) and are reusable across CRUD/configuration/API via a shared `AgentConfigurationValidationError`.
  - configuration use cases now also use explicit typed failures for missing/invalid agent ids (`AgentNotFoundError`, `AgentInvalidRequestError`) instead of generic thrown-string errors.
  - create/update validation paths are now explicit in the service contract (`mode: create|update`) so update flows can enforce immutable-id semantics deterministically.
  - cross-field policy/sandbox/trust contradictions now emit dedicated issue codes (required-vs-denied permission, sandbox denial vs required approval, and tool-scope approval coherence) before domain fallback validation.
  - agent read-model contracts now expose full structured memory configuration (`assets`, `retrieval`, `policy`, `revision`) instead of partial memory summaries.
  - desktop backend transport now has dedicated thin authoring handlers (`ai-loom-desktop-agents:*`) via `AgentAuthoringBackendApi`, mapping DTO payloads directly onto use cases and structured validation output.
  - backend API error mapping is now type-only (`AgentAuthoringError` + `AgentConfigurationValidationError`), with unknown failures mapping to `internal` rather than substring-coerced transport codes.
  - API authoring read responses are now explicitly hardened as `{ agent, taxonomy, contract? }`, with taxonomy classified via `CompositionTaxonomyClassifier` and contract projected via `CompositionAssetContractResolver` so transport contracts reuse canonical composition seams.
  - backend authoring coverage now includes SQLite-backed integration tests for CRUD + goal/policy/tool/memory/strategy updates and API mapping/error-path tests so real persistence seams are exercised directly.
- No UI/runtime bypass was introduced; transport can remain thin over these use cases.

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
- Studio registration defaults now reuse taxonomy-driven contract projection through shared helpers (`createStudioMetadataPatch`, `createAtomicStudioMetadataPatch`, `createCompositeStudioMetadataPatch` in `ui/studio-shell/registrations/AtomicStudioRegistrationDefaults.ts`) so atomic and composite studios align on metadata default validity posture.
- Shared shell default dependency authoring now starts with an empty dependency set (instead of an implicit unpinned seed dependency), removing studio-specific accidental warning drift while preserving backend-authoritative dependency validation semantics.
- Focused tests now cover cross-atomic validation consistency and shared issue structure (`application/studio-shell/tests/StudioShellValidation.test.ts`, `infrastructure/api/studio-shell/tests/StudioShellBackendApi.test.ts`).

## Direction 5 update: Atomic contract and taxonomy enforcement hardening (stories 2.13–2.14)

- Atomic publish flows for Model/Dataset/Tool now enforce shared taxonomy + contract truth through one reusable application seam (`application/studio-shell/AtomicStudioAssetEnforcement.ts`) instead of studio-specific ad hoc checks.
- Enforcement validates structural kind (`atomic`), expected semantic role (`model`/`dataset`/`tool`), allowed behavior kinds (including bounded tool `conditional|deterministic`), and contract equivalence against taxonomy-driven projection (`CompositionAssetContractResolver.resolveContractForTaxonomy`).
- Model/Dataset/Tool application publish orchestration now runs this shared enforcement before lifecycle transition/publish so metadata drift introduced via shell patching cannot publish invalid atomic versions.
- 

## Direction 5 update: Atomic studio end-to-end consistency (story 2.15)

- Cross-studio consistency now has one shared end-to-end integration test over the real renderer/service -> desktop bridge -> backend API -> application orchestration -> SQLite persistence path (`ui/services/tests/StudioShellService.integration.test.ts`).
- The test runs the same lifecycle for Model, Dataset, and Tool studios: initialize/open studio, create atomic draft defaults, update draft content/metadata, run lifecycle validation/publish, reload persisted state, and verify version history.
- Assertions are taxonomy/contract/lifecycle/version coherent across all implemented atomic studios:
  - taxonomy stays atomic with role-specific semantics (`model`, `dataset`, `tool`);
  - contract remains taxonomy-projected through `CompositionAssetContractResolver`;
  - publish transitions remain lifecycle-gated and produce immutable version entries;
  - post-reload snapshots preserve published lifecycle state and validation readiness.

## Direction 5 update: Atomic studio documentation alignment (story 2.16)

- Direction 5 architecture notes now explicitly describe the implemented atomic slice as of stories 2.1–2.15: shared shell reuse, registration foundation, model/dataset/tool implementation status, and cross-studio consistency guarantees.
- The documented taxonomy model is aligned to current role coverage:
  - atomic: `model`, `dataset`, `tool`, `prompt-template`, `embedding-index`, `config-profile`
  - composite: `workflow`, `context-bundle`, `dataset-pipeline`, `training-recipe`, `tool-chain`
  - system: `system`, `app-template`
- Non-goals remain explicit: no second studio shell and no second taxonomy/contract stack; Prompt Template, Embedding Index, and Config Profile remain implemented through the same shared shell seams rather than separate architectures.

## Direction 5 update: Prompt Template studio domain + application slice (story 2.17)

- Prompt Template Studio now has a thin inner-layer domain helper (`domain/prompt-template-studio/PromptTemplateStudioDomain.ts`) for atomic prompt-template authoring with taxonomy `atomic/prompt-template/none` and generated provenance defaults.
- A bounded application orchestrator (`application/prompt-template-studio/PromptTemplateStudioApplicationService.ts`) follows the Model/Dataset/Tool pattern and reuses `StudioShellApplicationService` for initialize/create/publish lifecycle.
- Shared taxonomy-driven contract projection now includes atomic prompt-template defaults in `CompositionAssetContractResolver.resolveContractForTaxonomy`, and publish flow reuses shared atomic taxonomy/contract enforcement via `AtomicStudioAssetEnforcement`.

## Direction 5 update: Prompt Template studio UI integration (story 2.18)

- Prompt Template Studio now integrates through the same shared shell renderer/route seam (`ui/pages/PromptTemplateStudioPage.tsx` + `ui/studio-shell/registrations/PromptTemplateStudioRegistration.ts` + `/studio-shell/prompt-template` route wiring) instead of a separate page architecture.
- Prompt-template-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata`) while shared shell surfaces stay authoritative for session/draft context, metadata/dependencies, validation, lifecycle/version, and publish flow.
- Cross-atomic renderer-service integration coverage now includes prompt-template alongside model/dataset/tool in `ui/services/tests/StudioShellService.integration.test.ts`.

## Direction 5 update: Embedding Index studio domain + application slice (story 2.19)

- Embedding Index Studio now has a thin inner-layer domain helper (`domain/embedding-index-studio/EmbeddingIndexStudioDomain.ts`) for atomic embedding-index authoring with taxonomy `atomic/embedding-index/none` and generated provenance defaults.
- A bounded application orchestrator (`application/embedding-index-studio/EmbeddingIndexStudioApplicationService.ts`) follows the same Model/Dataset/Tool/Prompt Template pattern and reuses `StudioShellApplicationService` for initialize/create/publish lifecycle.
- Shared taxonomy-driven contract projection now includes atomic embedding-index defaults in `CompositionAssetContractResolver.resolveContractForTaxonomy`, and publish flow reuses shared atomic taxonomy/contract enforcement via `AtomicStudioAssetEnforcement`.

## Direction 5 update: Embedding Index studio UI integration (story 2.20)

- Embedding Index Studio now integrates through the shared shell renderer/route seam (`ui/pages/EmbeddingIndexStudioPage.tsx` + `ui/studio-shell/registrations/EmbeddingIndexStudioRegistration.ts` + `/studio-shell/embedding-index` route wiring) instead of introducing a second UI architecture.

## Direction 5 update: Config Profile studio domain + application slice (story 2.21)

- Config Profile Studio now has a thin inner-layer domain helper (`domain/config-profile-studio/ConfigProfileStudioDomain.ts`) for atomic config-profile authoring with taxonomy `atomic/config-profile/none` and generated provenance defaults.
- A bounded application orchestrator (`application/config-profile-studio/ConfigProfileStudioApplicationService.ts`) follows the same Model/Dataset/Tool/Prompt Template/Embedding Index pattern and reuses `StudioShellApplicationService` for initialize/create/publish lifecycle.
- Config Profile authoring and publish remain aligned with taxonomy-driven contract projection (`CompositionAssetContractResolver`), centralized validation (`StudioShellValidation`), and publish-time atomic enforcement (`AtomicStudioAssetEnforcement`) through shared shell seams.

## Direction 5 update: Config Profile studio UI integration (story 2.22)

- Config Profile Studio now integrates through the shared shell renderer/route seam (`ui/pages/ConfigProfileStudioPage.tsx` + `ui/studio-shell/registrations/ConfigProfileStudioRegistration.ts` + `/studio-shell/config-profile` route wiring) instead of introducing a second UI architecture.
- Config-profile renderer behavior remains registration-bounded (`draft-authoring`, `metadata` slots), while shared shell panels remain authoritative for draft/session context, metadata/dependency/lifecycle/version state, validation display, and publish flow.
- Embedding-index-specific renderer behavior remains registration-bounded (`draft-authoring`, `metadata`) while shared shell surfaces remain authoritative for session/draft context, metadata/dependencies, validation, lifecycle/version, and publish flow.
- Cross-atomic renderer-service and enforcement coverage now includes embedding-index alongside model/dataset/tool/prompt-template in `ui/services/tests/StudioShellService.integration.test.ts` and `application/studio-shell/tests/AtomicStudioAssetEnforcement.test.ts`.

## Direction 5 update: Workflow studio domain + application slice (story 3.5)

- Workflow Studio now has a thin bounded inner-layer domain helper (`domain/workflow-studio/WorkflowStudioDomain.ts`) for specialized composite orchestrator authoring with taxonomy `composite/workflow/{deterministic|conditional|iterative}` and generated provenance defaults.
- Workflow Studio domain now includes a canonical workflow authoring entity contract (`WorkflowEntity`) with stable identity, human-readable name, descriptive metadata, lifecycle timestamps, and explicit relation to canonical draft state.
- Workflow Studio domain now includes canonical workflow draft schema contracts (`WorkflowDraft`) with typed top-level sections (`triggers`, `inputs`, `steps`, `outputs`), explicit step ordering semantics, and deterministic serialize/deserialize normalization helpers.
- Workflow draft trigger contracts now use a canonical discriminated trigger model (`kind` + `type` + typed `config`) covering user (`manual` / `button-click` / `user-initiated-run`), temporal (`schedule` / `recurring`), and state (`data-available` / `asset-state-changed` / `system-event`) trigger categories with kind/type compatibility validation.
- Workflow draft input contracts now use canonical source typing (`sourceType`) with dataset-asset references (`assetId` + optional `versionId`) plus bounded runtime/static source variants, enabling multiple input entries per draft without UI-local schema forks.
- Workflow draft step contracts now use an explicit canonical base step model with stable step identity (`id`), explicit ordering (`order`), and clear step classification (`kind` + `type`) while preserving deterministic ordering/uniqueness validation.
- Workflow draft step contracts now include an explicit asset-backed step substructure (`assetRef`) with canonical asset references (`assetId` + optional `versionId`) and implemented agent/assistant-backed step support (`assetKind=agent-assistant`) without introducing a parallel step model.
- Workflow draft step contracts now include canonical built-in step variants (`if-then`, `loop-iteration`, `delay-wait`, `manual-approval`) under the same base step model (`kind=control-flow`) with typed configuration payloads and deterministic structural validation.
- Workflow draft output contracts now include a canonical structured output model (`outputType`, `format`, `destination`) supporting one-or-more outputs per draft without introducing output-specific parallel schemas.
- A bounded application orchestrator (`application/workflow-studio/WorkflowStudioApplicationService.ts`) reuses `StudioShellApplicationService` for initialize/create/publish lifecycle instead of introducing workflow-specific create/update/publish infrastructure.
- Publish gating now reuses shared composite enforcement (`assertCompositeStudioDraftPublishConsistency`) so workflow semantic-role and behavior invariants plus taxonomy-driven contract derivability remain backend/application-authoritative.

## Direction 5 update: Workflow studio UI integration (story 3.6)

- Workflow Studio now integrates through the same shared shell renderer/route seam (`ui/pages/WorkflowStudioPage.tsx` + `ui/studio-shell/registrations/WorkflowStudioRegistration.ts` + `/studio-shell/workflow` route wiring) instead of a separate workflow UI architecture.
- Workflow registration contributes bounded workflow-specific guidance/metadata slot panels while shared shell surfaces remain authoritative for draft/session context, taxonomy/contract/provenance/dependencies state, lifecycle transitions, validation display, and publish/version operations.
- Renderer-service integration coverage now includes a workflow composite-orchestrator scenario over the real shared path (`StudioShellService` -> desktop bridge -> `StudioShellBackendApi` -> `DefaultStudioShellApplicationService` -> SQLite repository) in `ui/services/tests/StudioShellService.integration.test.ts`.

## Direction 5 update: Context Bundle studio domain + application slice (story 3.7)

- Context Bundle Studio now has a thin bounded inner-layer domain helper (`domain/context-bundle-studio/ContextBundleStudioDomain.ts`) for specialized composite input-preparer authoring with taxonomy `composite/context-bundle/{none|deterministic}` and generated provenance defaults.
- A bounded application orchestrator (`application/context-bundle-studio/ContextBundleStudioApplicationService.ts`) reuses `StudioShellApplicationService` for initialize/create/publish lifecycle instead of introducing context-bundle-specific create/update/publish infrastructure.
- Publish gating now reuses shared composite enforcement (`assertCompositeStudioDraftPublishConsistency`) so context-bundle semantic-role and behavior invariants plus taxonomy-driven contract derivability remain backend/application-authoritative.

## Direction 5 update: Context Bundle studio UI integration (story 3.8)

- Context Bundle Studio now integrates through the same shared shell renderer/route seam (`ui/pages/ContextBundleStudioPage.tsx` + `ui/studio-shell/registrations/ContextBundleStudioRegistration.ts` + `/studio-shell/context-bundle` route wiring) instead of a separate context-bundle UI architecture.
- Context-bundle registration contributes bounded context-specific guidance/metadata slot panels while shared shell surfaces remain authoritative for draft/session context, taxonomy/contract/provenance/dependencies state, lifecycle transitions, validation display, and publish/version operations.
- Renderer-service integration coverage now includes a context-bundle composite input-preparer scenario over the real shared path (`StudioShellService` -> desktop bridge -> `StudioShellBackendApi` -> `DefaultStudioShellApplicationService` -> SQLite repository) in `ui/services/tests/StudioShellService.integration.test.ts`.

## Direction 5 update: Dataset Pipeline studio domain + application slice (story 3.9)

- Dataset Pipeline Studio now has a thin bounded inner-layer domain helper (`domain/dataset-pipeline-studio/DatasetPipelineStudioDomain.ts`) for composite dataset-pipeline authoring with taxonomy `composite/dataset-pipeline/{deterministic|iterative}` and generated provenance defaults.
- A bounded application orchestrator (`application/dataset-pipeline-studio/DatasetPipelineStudioApplicationService.ts`) reuses `StudioShellApplicationService` for initialize/create/publish lifecycle instead of introducing dataset-pipeline-specific infrastructure.
- Publish gating now reuses shared composite enforcement (`assertCompositeStudioDraftPublishConsistency`) so dataset-pipeline semantic-role and behavior invariants plus taxonomy-driven contract derivability remain backend/application-authoritative.
- Dataset-pipeline draft guidance and tests intentionally reuse existing data-preparation vocabulary (source ingestion, data cleaning, dataset transformation, data validation) instead of creating a parallel pipeline ontology.

## Direction 5 update: Dataset Pipeline studio UI integration (story 3.10)

- Dataset Pipeline Studio now integrates through the same shared shell renderer/route seam (`ui/pages/DatasetPipelineStudioPage.tsx` + `ui/studio-shell/registrations/DatasetPipelineStudioRegistration.ts` + `/studio-shell/dataset-pipeline` route wiring) instead of a separate dataset-pipeline UI architecture.
- Dataset-pipeline registration contributes bounded dataset-pipeline-specific guidance/metadata slot panels while shared shell surfaces remain authoritative for draft/session context, taxonomy/contract/provenance/dependencies state, lifecycle transitions, validation display, and publish/version operations.

## Direction 5 update: Training Recipe studio domain + application slice (story 3.11)

- Training Recipe Studio now has a thin bounded inner-layer domain helper (`domain/training-recipe-studio/TrainingRecipeStudioDomain.ts`) for composite training-recipe authoring with taxonomy `composite/training-recipe/deterministic` and generated provenance defaults.
- A bounded application orchestrator (`application/training-recipe-studio/TrainingRecipeStudioApplicationService.ts`) reuses `StudioShellApplicationService` for initialize/create/publish lifecycle instead of introducing a separate training architecture.
- Publish gating reuses shared composite enforcement (`assertCompositeStudioDraftPublishConsistency`) so training-recipe semantic-role and deterministic-behavior invariants plus taxonomy-driven contract derivability remain backend/application-authoritative.

## Direction 5 update: Training Recipe studio UI integration (story 3.12)

- Training Recipe Studio now integrates through the same shared shell renderer/route seam (`ui/pages/TrainingRecipeStudioPage.tsx` + `ui/studio-shell/registrations/TrainingRecipeStudioRegistration.ts` + `/studio-shell/training-recipe` route wiring) instead of a separate training-recipe UI architecture.
- Training-recipe registration contributes bounded training-recipe-specific guidance/metadata slot panels while shared shell surfaces remain authoritative for draft/session context, taxonomy/contract/provenance/dependencies state, lifecycle transitions, validation display, and publish/version operations.

## Direction 5 update: Tool Chain studio domain + application + UI integration (stories 3.13–3.14)

- Tool Chain Studio now has a thin bounded inner-layer domain helper (`domain/tool-chain-studio/ToolChainStudioDomain.ts`) for composite tool-chain authoring with taxonomy `composite/tool-chain/deterministic` and generated provenance defaults.
- A bounded application orchestrator (`application/tool-chain-studio/ToolChainStudioApplicationService.ts`) reuses `StudioShellApplicationService` for initialize/create/publish lifecycle and shared composite publish enforcement (`assertCompositeStudioDraftPublishConsistency`) instead of introducing tool-chain-specific infrastructure.
- Tool Chain Studio now integrates through the same shared shell renderer/route seam (`ui/pages/ToolChainStudioPage.tsx` + `ui/studio-shell/registrations/ToolChainStudioRegistration.ts` + `/studio-shell/tool-chain` route wiring), with tool-chain-specific behavior bounded to registration defaults and slot contributions.

## Direction 5 update: Composite consistency + interop coverage (stories 3.17–3.18)

- Shared integration coverage now includes all implemented composite studios (workflow, context-bundle, dataset-pipeline, training-recipe, tool-chain) over the same service -> bridge -> backend -> application -> SQLite seam (`ui/services/tests/StudioShellService.integration.test.ts`).
- Shared validation and publish seams now carry composite dependency identity/version checks, semantic-role compatibility checks, taxonomy/contract consistency checks, and publish-time dependency pinning requirements (`application/studio-shell/StudioShellValidation.ts`, `application/studio-shell/AtomicStudioAssetEnforcement.ts`).
- Composite-to-atomic interop in this slice is dependency + taxonomy + contract driven (composites reference atomic versions and are validated by shared seams); this slice does not add a separate composite runtime orchestration subsystem.

## Direction 5 implementation status (through stories 5.24)

Fully implemented now:
- Shared Studio Shell lifecycle/session/draft/version/persistence/validation/publish seams for both atomic and composite studios.
- Unified registration model supporting atomic and composite studios through one shell page/extension architecture.
- Implemented composite studios: Workflow, Context Bundle, Dataset Pipeline, Training Recipe, Tool Chain.
- Shared taxonomy + shared contract projection coverage for the implemented atomic/composite roles and corresponding publish enforcement.

Partially implemented / intentionally bounded:
- Composite behavior semantics are currently enforced as metadata + validation/publish constraints, not as a separate runtime behavior engine in Direction 5.
- Specialized composite role semantics are fully represented in taxonomy/contract language (`workflow` orchestrator, `agent` decision unit, `context-bundle` input preparer), but only workflow/context-bundle are currently implemented as specialized composite Studio Shell surfaces.

Explicitly later than this scope:
- Any broader system-composer architecture beyond current shared shell + taxonomy/contract/dependency enforcement seams.
- Rich visual graph-canvas tooling or runtime/deployment orchestration beyond current bounded system authoring + registry projection seams.

## Direction 5 update: System consistency + interop integration coverage (stories 5.21–5.22)

- Shared integration coverage now includes bounded end-to-end consistency for System Studio across create/update/validate/publish/reload over the real renderer service -> desktop bridge -> backend API -> application orchestration -> SQLite path (`ui/services/tests/StudioShellService.integration.test.ts`).
- System-specific operations are now exercised over that same seam (list/add/remove/reorder child components, interface updates, parameter updates, execution-metadata updates, and compatibility-insights queries) using the actual `SystemStudioBackendApi` bridge contract, not test-only direct application calls.
- Cross-kind interop coverage now validates mixed atomic/composite/system child composition in a single system draft with pinned versions, clean compatibility-insights status, and persisted upstream version lineage after publish/reload.

## Direction 5 update: Registry performance + consistency hardening (stories 4.15–4.16)

- Registry now has a bounded in-memory cache seam (`application/asset-registry/RegistryCacheLayer.ts`) consumed by query + dependency-graph services via cache-aside/read-through behavior (no second source-of-truth).
- Query caching is keyed by filter/search shape and guarded by source signatures (`versionCount` + `lineageEdgeCount`) so publish/version/dependency changes invalidate cached projections deterministically.
- Dependency graph caching now memoizes adjacency/direct-expansion/traversal results; projection dirty/signature checks still govern rebuild truth through `IRegistryGraphProjectionRepository`.
- Cross-studio correctness now has integration-style coverage that spans atomic + composite assets across publish visibility, taxonomy/contract/provenance projection, dependency graph traversal, lineage, filtering/search, and dependency replacement after version updates.

## Direction 5 update: System registry graph + lineage validation (story 5.23)

- Registry integration coverage now explicitly exercises published system assets over the real query/graph/API/SQLite seams (no mocked graph truth).
- Coverage now includes parent-system -> child (atomic/composite/system) edges, nested system edges, mixed dependency + lineage consistency across detail/graph/traversal reads, and version-aware parent/child system lineage coherence.
- This extends the existing registry projection stack (`RegistryQueryService`, `RegistryDependencyGraphService`, `RegistryBackendApi`) rather than introducing a second graph or lineage architecture.

## Direction 5 update: Registry docs + UX alignment (stories 4.17–4.18)

- Registry remains projection-only: `RegistryQueryService` materializes `RegistryAsset` read models from canonical asset/version/lineage/taxonomy/contract/validation data; it is not a source-of-truth store.
- Query stack boundaries are explicit:
  - `RegistryQueryService` = projection/filter/search/detail
  - `CrossStudioRegistryQueryService` = API-facing facet wrappers
  - `RegistryDependencyGraphService` = direct + traversal dependency graph reads
- Dependency semantics in registry read models are explicit by source: `version-upstream`, `lineage-edge`, `draft-dependency`.
- Cache behavior remains in-memory/disposable and signature-invalidated (`versionCount:lineageEdgeCount`) across query + graph namespaces.
- Registry API remains bounded to list/filter/search/detail + dependency/dependent traversal endpoints with typed transport errors (`not-found`/`invalid-request`/`internal`).
- Scope truth:
  - atomic + composite assets are fully covered in registry browse/detail/graph/navigation flows.
  - system assets are now first-class in registry browse/detail/graph/lineage flows, including nested-system child references and bounded version-lineage summaries.

## Direction 5 update: System runtime domain foundation (stories 6.1–6.2)

- New bounded runtime domain slice: `domain/system-runtime/SystemRuntimeDomain.ts`.
- Keeps runtime state separate from asset definitions and models only execution-state concerns:
  - execution id
  - execution context/invocation metadata
  - environment refs
  - execution status lifecycle
  - input/output payload envelopes
  - execution node refs
- Execution node refs include `parentExecutionNodeId` and `path` for nested-system readiness without implementing recursive orchestration.
- Runtime behavior alignment is now explicit in application layer (`application/system-runtime/RuntimeBehaviorAlignment.ts`) and consumes shared taxonomy truth rather than introducing parallel runtime taxonomy rules.


## Direction 5 update: Runtime environment abstraction + execution plan builder (stories 6.5–6.6)

- Runtime environment selection is now a bounded domain/application seam (`RuntimeEnvironmentDomain` + `RuntimeEnvironmentSelector`) rather than an implicit local-host assumption.
- The selector models current truthful local capabilities and explicit extension points for MCP-mediated and remote/distributed environments without implementing infrastructure adapters in this slice.
- Runtime planning now has an explicit `ExecutionPlanBuilder` in `application/system-runtime/ExecutionPlanBuilder.ts` that composes:
  - system structure + bindings
  - runtime execution contract mapping outputs
  - runtime dependency resolution outputs
  - runtime behavior profile
  - selected runtime environment
- Plan outputs are deterministic and cycle-safe (with explicit invalid results) and remain runtime-only artifacts, preserving separation from asset-definition models and UI state.

## Direction 5 update: Execution orchestration + step execution seams (stories 6.7–6.8)

- Runtime execution now includes an application-authoritative orchestration seam in `application/system-runtime/ExecutionOrchestrationService.ts`.
- The orchestration service:
  - accepts a built plan (or builds one through `ExecutionPlanBuilder`)
  - initializes runtime execution state in `SystemRuntimeDomain`
  - sequences plan nodes deterministically through `orderedNodeIds`
  - delegates all unit execution to a lower-level step engine seam.
- Runtime step execution now includes a bounded engine seam in `application/system-runtime/StepExecutionEngine.ts`.
- The step engine:
  - consumes execution-plan nodes + selected runtime environment
  - supports atomic/composite/system step categories with bounded system-step recursion readiness
  - reflects conditional/iterative/autonomous behavior profiles only to currently truthful bounded capability depth (single-pass branching/iteration/planning markers, no full loop/retry/autonomy runtime yet)
  - returns runtime-domain-consistent step status/output/diagnostics without mutating asset-definition models.

## Direction 5 update: bounded loop/planning progression + execution state tracking (stories 6.9–6.10)

- Runtime orchestration now supports bounded iterative and autonomous progression while preserving existing deterministic sequencing semantics.
- `ExecutionOrchestrationService` now:
  - keeps per-node bounded progression (`maxIterationsPerNode`, `maxPlanningCyclesPerNode`)
  - performs additional passes only when the step engine returns behavior-truthful progression decisions (`iterate`, `replan`)
  - fails truthfully on unsupported progression or bound overruns.
- `StepExecutionEngine` now returns explicit progression decisions (`complete`, `iterate`, `replan`, `unsupported`) derived from runtime behavior profiles rather than ad hoc node-type branching.
- `SystemRuntimeDomain` now carries typed runtime execution-state tracking (`runtimeState`) including:
  - plan-level progress snapshot counters
  - node-level status transitions
  - bounded iteration/planning-cycle markers
  - last progression decision/error summaries.
- Execution-state tracking remains runtime-scoped and in-memory/domain-application scoped for now (no parallel asset persistence model, no UI monitoring/logging subsystem in this slice).

## Direction 5 update: Deployment provisioning + execution foundation (stories 8.5–8.6)

- Deployment now includes a bounded environment provisioning seam in deployment layers (`domain/deployment/EnvironmentProvisioningDomain.ts`, `application/deployment/EnvironmentProvisioningCompatibilityValidator.ts`, `application/deployment/EnvironmentProvisioningService.ts`).
- Provisioning remains deterministic and provider-agnostic:
  - it accepts built deployment bundles + validated deployment configuration + selected abstract target category (`local`/`cloud`/`edge`),
  - emits a structured provisioning plan and a provisioned-environment reference,
  - validates compatibility explicitly before producing a ready environment.
- Deployment execution now has a bounded application service (`application/deployment/DeploymentExecutionService.ts`) and explicit deployment contracts (`domain/deployment/DeploymentExecutionDomain.ts`):
  - execution requires bundle/config/target + provisioned-environment linkage,
  - emits structured deployment result/status + version-pinned traceable deployment record,
  - persists records through a minimal bounded in-memory repository seam for later state/log/version stories.
- Boundaries remain explicit in this slice:
  - no provider-specific provisioning/deployment adapters,
  - no health monitoring, rollback, autoscaling, or endpoint exposure,
  - no merging with runtime execution orchestration.

## Direction 5 update: Deployment state tracking + diagnostics (stories 8.7–8.8)

- Deployment now has explicit lifecycle state contracts in `domain/deployment/DeploymentStateDomain.ts` (`requested`, provisioning progress/completion, deployment-in-progress, `active`, `failed`, `inactive`) with bounded transition validation.
- `application/deployment/DeploymentExecutionService.ts` now orchestrates provisioning + execution through `executeLifecycle`, persists state snapshots/transitions on deployment records, and exposes query seams (`listDeploymentsByState`, `getDeploymentStateSnapshot`, `listStateTransitions`).
- Deployment diagnostics are now explicit and separate from runtime execution trace/audit semantics via `domain/deployment/DeploymentDiagnosticsDomain.ts` + `application/deployment/DeploymentDiagnosticsService.ts`:
  - authoritative provisioning/deployment/state-transition points emit bounded deployment log entries,
  - failure paths emit structured deployment diagnostic records linked to deployment identity and version-pinned linkage metadata.
- Boundaries remain explicit in this slice:
  - deployment state/diagnostics are not merged into system runtime execution-state or trace/log models,
  - no rollback/health/endpoint/autoscaling behavior is added yet,
  - storage remains intentionally bounded (in-memory repositories) while preserving durable-in-process queryability for later API/UI stories.

## Direction 5 update: Deployment version management + rollback (stories 8.9–8.10)

- Deployment activation is now an explicit management concern separated from deployment lifecycle state:
  - deployment records track activation state (`active`/`inactive`/`superseded`) and activation history events with action-kind metadata.
  - successful deployments are not implicitly active; activation is explicitly selected by management actions.
- Versioned deployment management now has a bounded application service (`application/deployment/DeploymentVersionManager.ts`) that:
  - lists deployment history by system/version/target scope,
  - exposes active deployment lookup for a bounded target context,
  - applies explicit active selection while superseding prior active records in-scope.
- Rollback is now an explicit bounded deployment-management action via `application/deployment/DeploymentRollbackService.ts` with contracts in `domain/deployment/DeploymentRollbackDomain.ts`:
  - rollback eligibility is explicit and structured (`isRollbackEligible`),
  - rollback actions record request/decision/outcome separately from ordinary deployment actions,
  - rollback re-activation preserves deployment-version traceability (asset version, bundle, config, target, deployment identity).
- Scope remains intentionally bounded:
  - no health-triggered automatic rollback,
  - no endpoint-routing/traffic-shifting orchestration,
  - no merge with runtime retry/recovery semantics.

## Direction 5 update: Deployment access control + quotas (stories 8.11–8.12)

- Deployment governance now reuses Epic 7 caller-context patterns (authenticated caller kind/id, roles, session, tenant context) through bounded deployment services rather than introducing a second auth universe.
- `application/deployment/DeploymentAccessControl.ts` introduces explicit deployment access contracts:
  - `DeploymentAccessContext`, `DeploymentAccessPolicy`, `DeploymentAccessEvaluator`, and structured `DeploymentAccessDecision`.
  - bounded role-based policy defaults for deploy, activation, rollback, and deployment history/detail reads.
  - structured denial errors (`DeploymentAccessDeniedError`) that preserve caller/tenant/system/target linkage metadata.
- Authoritative deployment entry seams now enforce access checks before mutation:
  - deployment execution entry (`DeploymentExecutionService.execute`/`executeLifecycle`),
  - deployment activation/version management (`DeploymentVersionManager.setActiveDeployment`),
  - rollback execution (`DeploymentRollbackService.rollback`),
  - deployment-history/detail reads where exposed (`DeploymentVersionManager`, rollback action listing).
- Deployment quotas remain distinct from access control through `application/deployment/DeploymentQuotaEvaluator.ts`:
  - explicit `DeploymentQuotaPolicy`, `DeploymentQuotaDecision`, and structured `DeploymentQuotaExceededError`,
  - bounded windowed limits for deployments per caller, deployments per target scope, activation-change frequency, and rollback frequency.
- Quota evaluation is centralized at the same authoritative deployment boundaries (execution/activation/rollback) and is tenant-aware in scoped key derivation.
- Scope remains intentionally bounded:
  - no billing/subscription framework,
  - no distributed/global quota coordination,
  - no merging deployment quotas into runtime execution quotas/rate limits.

## Direction 5 update: Deployment environment isolation + system endpoint exposure (stories 8.13–8.14)

- Deployment records now include explicit environment isolation scope (`domain/deployment/DeploymentIsolationDomain.ts`) with durable linkage across deployment identity, source system/bundle version, deployment target/environment, tenant context, and bounded runtime binding key.
- Deployment isolation enforcement is centralized through `application/deployment/DeploymentIsolationEvaluator.ts` and applied at authoritative seams:
  - deployment state/log/diagnostic reads,
  - deployment history + active deployment lookup/selection paths,
  - rollback candidate selection.
- Isolation remains deployment-specific (not a duplicate of runtime request isolation) and extends Epic 7 tenant/caller propagation semantics into deployment-management boundaries.
- System endpoint exposure is now a first-class deployment output via `domain/deployment/SystemEndpointExposureDomain.ts` and `application/deployment/SystemEndpointExposureService.ts`:
  - stable endpoint identity maps to the active deployment for a bounded system/target/tenant scope,
  - endpoint records preserve deployment linkage (deployment id, system version, bundle/build key, config id, environment),
  - endpoint resolution reuses deployment isolation checks.
- Scope remains intentionally bounded:
  - endpoint exposure in this slice only binds stable endpoint identity to active deployment linkage,
  - endpoint routing and health monitoring are introduced by later stories (8.15–8.16),
  - no alternate invocation architecture outside existing runtime external invocation seams.

## Direction 5 update: Bounded autoscaling interface + deployment audit trail (stories 8.17–8.18)

- Deployment autoscaling is now an explicit bounded deployment-management seam (not provider infrastructure):
  - domain contracts in `domain/deployment/DeploymentAutoscalingDomain.ts` (`DeploymentScalingPolicy`, `DeploymentScalingConfiguration`, `DeploymentScaleStatus`, `ScaleDecision`, `ScaleActionRequest`),
  - application orchestration in `application/deployment/DeploymentAutoscalingService.ts` exposing a typed `AutoscalingInterface`.
- Autoscaling remains deployment-linked and provider-agnostic:
  - only active deployments are eligible for scaling configuration and scale-action requests,
  - scaling records preserve linkage across deployment id, system asset/version, bundle/build key, deployment configuration, target/environment, tenant boundary, and nested-system counts,
  - bounded policy inputs (utilization/health metadata) can drive explicit `ScaleDecision` outputs without introducing automatic scaling loops or provider adapters.
- Deployment governance now includes a deployment-specific audit trail separate from runtime execution audit and deployment diagnostics:
  - domain audit contracts in `domain/deployment/DeploymentAuditTrailDomain.ts`,
  - queryable persistence seam in `application/deployment/DeploymentAuditTrailService.ts`,
  - authoritative deployment boundaries now emit deployment audit records:
    - deployment lifecycle request/outcomes (`DeploymentExecutionService`),
    - activation changes (`DeploymentVersionManager`),
    - rollback request/outcomes (`DeploymentRollbackService`),
    - autoscaling configuration/action management events (`DeploymentAutoscalingService`).
- Scope remains intentionally bounded:
  - no provider-specific autoscaling infrastructure integration,
  - no health-remediation/autoscaling control loop,
  - no merging deployment audit records into runtime invocation audit or deployment diagnostics streams.

## Direction 5 update: Deployment endpoint/runtime interop + bounded safeguards alignment (stories 8.19–8.24)

- Deployment public surfaces are now explicitly implemented and tested:
  - deployment SDK/public contract + reference client (`infrastructure/api/deployment/sdk/PublicDeploymentSdkContract.ts`, `DeploymentClient.ts`),
  - deployment backend API transport mapping (`infrastructure/api/deployment/DeploymentBackendApi.ts`),
  - deployment end-to-end + interop coverage (`infrastructure/api/deployment/tests/DeploymentLifecycleE2E.test.ts`, `DeploymentInteropE2E.test.ts`, `DeploymentClientSdk.test.ts`).
- Endpoint routing and deployment health are now first-class implemented seams (stories 8.15–8.16), layered on top of exposure/version/activation truth:
  - `application/deployment/EndpointRoutingService.ts` resolves exposed endpoint -> active deployment -> runtime invoker path,
  - `application/deployment/DeploymentHealthMonitor.ts` evaluates deployment health from deployment state + diagnostics + endpoint resolvability signals.
- Story 8.23 adds bounded performance safeguards without introducing a second deployment platform:
  - deterministic build bundle reuse for repeated build requests (`DeploymentBuildPipeline` bounded cache),
  - bounded deployment diagnostics/log polling (`DeploymentDiagnosticsService` query limits),
  - short-lived bounded history/active-deployment lookup caching on deployment version management read paths (`DeploymentVersionManager`),
  - bounded deployment SDK/public read shaping + short-lived read response caching for status/history/active/health API calls (`DeploymentBackendApi`),
  - bounded endpoint resolvability work in health evaluation (`DeploymentHealthMonitor` endpoint-resolution cap with explicit truncation reason).
- These safeguards are intentionally additive and correctness-preserving:
  - access control, quota checks, tenant/environment isolation, activation/rollback semantics, and deployment audit boundaries remain authoritative,
  - no distributed caches/queues/control-planes were introduced; safeguards remain in-process and bounded.
- Current boundaries (implemented vs future):
  - implemented now: packaging -> target/config validation -> build/bundle -> provisioning/execution -> state/diagnostics -> versioning/rollback -> access/quota/isolation -> endpoint exposure/routing -> health -> autoscaling interface -> deployment audit trail -> SDK/public API + e2e/interop tests + bounded read-path safeguards.
  - future work: provider-specific deployment infrastructure, distributed deployment orchestration/backpressure/observability platforms, and autonomous autoscaling/remediation loops.

## Direction 5 update: Studio–Studio handoff platform + bounded stability safeguards (stories 9.1–9.24)

- Epic 9 is implemented as a bounded Studio–Studio handoff stack in existing inner/application seams (`domain/studio-handoff/*`, `application/studio-handoff/*`, `infrastructure/filesystem/studio-handoff/*`, `infrastructure/api/studio-handoff/*`), not as a second orchestration platform.
- Implemented handoff model/surfaces now include:
  - first-class handoff contract + context (`StudioHandoffContract`, `StudioHandoffContext`) with version-pinned asset identity and intent/provenance metadata,
  - compatibility validation grounded in taxonomy/contract/capability truth (`StudioHandoffCompatibilityValidator`),
  - source output + target input adapter layers (`StudioOutputAdapterLayer`, `StudioInputAdapterLayer`) with grouped multi-asset support,
  - deterministic routing (`StudioHandoffRoutingService`) over capability descriptors and target contract matching,
  - orchestration + incremental revision flow (`StudioHandoffOrchestrationService`, `refreshStudioHandoff`) preserving version-aware handoff identity.
- Implemented persistence/traceability now include:
  - persisted handoff records + query surfaces (`StudioHandoffPersistenceService`, `StudioHandoffQueryService`, SQLite repo),
  - lineage records (`StudioHandoffLineageTracker`) and cross-studio dependency graph records (`CrossStudioDependencyGraphBuilder`, `StudioHandoffDependencyTracker`),
  - handoff audit trail (`StudioHandoffAuditTrailService` + SQLite audit repo),
  - structured failure/retry/reconciliation semantics (`StudioHandoffFailure*`, `StudioHandoffRetryService`) with explicit retry linkage records.
- Implemented System Studio integration/public surfaces:
  - System Studio handoff intake/composition initialization (`SystemStudioHandoffIntegrationService`) including grouped/system-of-systems intake context,
  - public SDK contract + mapper/client transport seams (`infrastructure/api/studio-handoff/sdk/*`),
  - end-to-end and cross-studio interop coverage (`StudioHandoffPipeline.integration.test.ts`, `CrossStudioInterop.integration.test.ts`).
- Story 9.23 bounded safeguard additions (correctness-preserving, in-process):
  - repeated compatibility/routing/input-adaptation/output-adaptation calls now use bounded in-memory decision caches for stable version-pinned inputs,
  - handoff query history reads are now explicitly bounded by default and capped by max-limit shaping (application + SQLite query `LIMIT`),
  - lineage/dependency trackers now keep bounded record windows and bounded read/build projections to avoid unbounded growth/query amplification.
- Current boundaries (implemented vs bounded/future):
  - implemented now: deterministic, version-aware handoff contracts/routing/adaptation/orchestration + persistence/lineage/dependency/audit + retry/reconciliation + System Studio intake + SDK + e2e/interop tests + bounded hot-path safeguards.
  - bounded/partial by design: in-process caches/record windows only; no distributed cache/queue/control-plane and no separate runtime/deployment architecture for handoffs.
  - future work: larger-scale distributed reliability/observability/backpressure systems, if and when required by product scope.

## Direction 5 update: Exchange publish/package/import platform + end-to-end coherence coverage (stories 10.1–10.24)

- Epic 10 is implemented as a bounded exchange stack across existing domain/application/infrastructure seams (`domain/exchange/*`, `application/exchange/*`, `infrastructure/api/exchange/*`) and remains explicitly separate from runtime execution state, deployment execution state, and studio-handoff transport artifacts.
- Implemented exchange domain model/capabilities now include:
  - unified exchange bundle model + format/version compatibility (`ExchangeBundleDomain`, `ExchangeFormatVersioning`),
  - package manifests for atomic/composite assets and systems (`AssetPackageManifest`, `SystemPackageManifest`),
  - dependency snapshot model/builders (`BundleDependencySnapshot`),
  - validation + deterministic serialization/deserialization (`ExchangeBundleValidation`, `ExchangeBundleSerialization`),
  - import conflict handling (`ExchangeImportConflictResolution`) and exchange provenance/lineage tracking (`ExchangeProvenance`).
- Implemented authoritative application workflows now include:
  - version-pinned export/import flows for atomic/composite/system assets (`Atomic|Composite|SystemAssetExportService`, `Atomic|Composite|SystemAssetImportService`),
  - publishable package lifecycle modeling + status transitions (`PublishablePackageService`),
  - exchange access control/evaluation (`ExchangeAccessControl`) with caller/tenant propagation,
  - local-first exchange catalog abstraction + concrete local catalog/query support (`ExchangeCatalogServices`),
  - authoritative publish workflow linking package readiness, artifact verification, catalog registration, and published record persistence (`ExchangePublishWorkflow`).
- Public exchange contract surfaces are implemented and tested via the SDK/public DTO mapping seam (`infrastructure/api/exchange/sdk/PublicExchangeSdkContract.ts`, `ExchangeSdkMapper.ts`, `ExchangeSdkContract.test.ts`).
- Story 10.23 end-to-end integration coverage now verifies coherent exchange lifecycle behavior over real seams (export -> deserialize/validate -> publish/catalog -> import), including bounded access-denial/conflict outcomes and system-of-systems continuity (`application/exchange/tests/ExchangeEndToEndLifecycle.integration.test.ts`).
- Current boundaries (implemented vs bounded/future):
  - implemented now: local-first exchange for atomic/composite/system package export/import/publish/catalog with provenance/lineage continuity and public contract mapping.
  - bounded/partial by design: local catalog implementation is in-memory/local-reference oriented in this slice; repository abstraction boundaries are preserved for later remote/LAN catalog adapters.
  - future work: distributed/LAN package sharing, remote repository synchronization, and distributed execution/deployment behaviors are design considerations preserved by current abstraction boundaries, not current product behavior.

