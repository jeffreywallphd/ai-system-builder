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

## Direction 5 update: Workflow Studio canonical validation + lifecycle foundation (stories 1.9-1.10)

- Workflow Studio now exposes a canonical workflow-definition validation engine in `domain/workflow-studio/WorkflowStudioDomain.ts` via `validateWorkflowDraft(...)` and `validateWorkflowEntity(...)`, with structured deterministic issues (`code`, `section`, `severity`, `path`, `message`) for triggers, inputs, steps, outputs, and cross-section dependency rules.
- Output validation now includes destination-specific readiness rules in that same canonical path (for example file-export format/delivery constraints, web-viewer title requirements, system-entry target/entity/collection/write-mode/record-shape compatibility checks, and prompt-response-chat prompt-link/scope/response-field checks) so Wizard output configuration gates stay domain-authoritative.
- Validation remains inner-layer and reusable across authoring surfaces, persistence gates, and runtime-preparation readiness checks (no UI-local source of truth path).
- Workflow entity lifecycle is now explicit and transition-guarded (`draft` -> `saved` -> `executable`) through `WorkflowLifecycleStates`, `isWorkflowLifecycleTransitionAllowed(...)`, and `transitionWorkflowEntityLifecycle(...)`.
- `executable` state is now domain-gated by canonical draft readiness (lifecycle transition/create validation uses workflow-definition validation, not presentation flags).
- Workflow Studio publish flow now enforces canonical workflow-content validation before lifecycle publish/version operations (`application/workflow-studio/WorkflowStudioApplicationService.ts`).

## Direction 5 update: Workflow Studio persistence + taxonomy alignment (stories 1.11-1.12)

- Workflow Studio canonical draft and entity models now expose explicit persistence mappings and versioned serialized-document shapes (`mapWorkflowDraftToPersistenceRecord`, `mapWorkflowEntityToPersistenceRecord`, `serializeWorkflowDraftDocument`, `serializeWorkflowEntity`) in `domain/workflow-studio/WorkflowStudioDomain.ts`.
- Draft/entity rehydration now goes through canonical normalization (`mapWorkflowDraftFromPersistenceRecord`, `mapWorkflowEntityFromPersistenceRecord`, `deserializeWorkflowDraftDocument`, `deserializeWorkflowEntity`) so identity/metadata/lifecycle/triggers/inputs/steps/outputs survive round-trip without UI-local shaping.
- Workflow asset-backed references now carry taxonomy metadata on canonical asset refs (`WorkflowDraftAssetReference.taxonomy`) and are validated against shared taxonomy expectations for dataset-backed inputs and agent-assistant steps.
- Workflow draft validation now emits deterministic taxonomy/asset-reference issues for mismatched dataset taxonomy and malformed asset-backed step identities, while keeping canonical validation in the domain layer and publish enforcement in `application/workflow-studio/WorkflowStudioApplicationService.ts`.

## Direction 5 update: Workflow persistence domain/application foundation (stories 11.1-11.2)

- Workflow persistence now has a dedicated canonical domain contract in `domain/workflow-studio/WorkflowPersistenceDomain.ts` that wraps canonical `WorkflowEntity` payloads (no parallel workflow definition shape).
- The persistence contract explicitly models:
  - persisted identity/status (`draft`/`saved`) derived from workflow lifecycle state,
  - metadata/timestamps,
  - ownership/context metadata (`ownerId`, `tenantId`, `studioId`, `sessionId`),
  - basic revision/version metadata (`persistenceRevision`, `workflowRevision`, optional `versionLabel`, optional duplicate source linkage),
  - payload strategy metadata (`workflow-entity` + schema version).
- The application-layer persistence boundary now has an explicit repository port (`application/ports/interfaces/IWorkflowPersistenceRepository.ts`) with create/update/get/list/duplicate contracts and bounded list-query semantics.
- Application use cases for create/update/get/list/duplicate now live in `application/workflow-persistence/*` with typed request validation and explicit failure contracts (`WorkflowPersistenceInvalidRequestError`, `WorkflowPersistenceNotFoundError`, `WorkflowPersistenceConflictError`).

## Direction 5 update: Workflow persistence infrastructure + studio draft synchronization (stories 11.3-11.4)

- Workflow persistence now has a concrete SQLite infrastructure adapter (`infrastructure/filesystem/SqliteWorkflowPersistenceRepository.ts`) implementing the existing `IWorkflowPersistenceRepository` create/update/get/list/duplicate contract over canonical persisted workflow records.
- Repository persistence keeps canonical `WorkflowEntity` payload compatibility enforced via `serializeWorkflowEntity`/`deserializeWorkflowEntity` at the infrastructure boundary, while preserving domain/application contract ownership of status/revision/timestamp semantics.
- Studio-shell workflow draft mutations now synchronize into workflow persistence through existing application use cases (`CreatePersistedWorkflowUseCase`, `UpdatePersistedWorkflowUseCase`, `GetPersistedWorkflowUseCase`) inside `StudioShellBackendApi`, rather than UI-owned persistence logic.
- Workflow draft synchronization maps workflow studio draft metadata/context into persistence ownership/version metadata and keeps lifecycle alignment (`draft` draft state, `saved` for validated/published transitions) under application orchestration.

## Direction 5 update: Explore workflow discovery + workflow studio entry routing (stories 11.5-11.6)

- Explore/library now treats persisted workflows as first-class assets through the existing explore-query seam (`application/asset-registry/ExploreAssetQueryService.ts`) by augmenting canonical registry results with workflow-persistence summaries when available.
- Persisted workflow explore rows remain taxonomy-aligned (`composite/workflow/*`) and surface persistence status/source metadata for future metadata/version filtering without introducing a parallel workflow-browser architecture.
- Workflow Studio entry now resolves explicit new/open/resume route intents through a dedicated route parser/builder seam (`ui/studio-shell/workflow/WorkflowStudioEntryRouting.ts`) layered on top of existing studio routing/search conventions.
- Workflow Studio initialization for new/open/resume remains service-backed (`StudioShellService` -> `StudioShellBackendApi`) and uses existing draft/session orchestration (`startSession`, `createDraft`, shared workflow mode store synchronization) instead of UI-local reconstruction paths.
- Persisted workflow retrieval for open/resume is now an explicit backend contract (`StudioShellBackendApi.getPersistedWorkflow`) exposed through existing desktop/browser studio-shell bridge seams, with typed not-found/invalid-entry handling.

## Direction 5 update: Workflow duplication + lightweight revision metadata hardening (stories 11.7-11.8)

- Persisted workflow duplication is now exposed as an explicit backend contract (`StudioShellBackendApi.duplicatePersistedWorkflow`) and reused by Workflow Studio entry routing (`workflowEntry=duplicate`) plus Explore workflow actions, so duplication flows through existing application/repository seams instead of UI-local copy logic.
- Duplication stays canonical and non-mutating: duplicate records inherit workflow definition + metadata, reset identity/timestamps/revision (`persistenceRevision=1`, `workflowRevision=1`), remain in `draft` status, and persist lineage through `revision.duplicatedFromWorkflowId`.
- Duplicate id allocation is now application-owned in `DuplicatePersistedWorkflowUseCase` when no explicit id is supplied (`<source>:copy`, then `:copy-<n>`), with conflict/not-found behavior preserved through existing typed persistence errors.
- Persisted workflow rehydration now validates canonical revision/timestamp/payload consistency (`normalizePersistedWorkflowRecord`) in both SQLite and in-memory repositories, so malformed persisted revision/version metadata fails fast on load instead of silently round-tripping.

## Direction 5 closeout: workflow persistence/reuse behavior contract (stories 11.13-11.14)

- The persisted workflow model remains one canonical record contract (`PersistedWorkflowRecord`) over canonical workflow definitions: no parallel persistence shape for wizard vs canvas, and no UI-local persistence model.
- Lifecycle semantics are intentionally lightweight and implemented as:
  - `draft` persisted status for in-progress workflow authoring records,
  - `saved` persisted status for validated/published workflow lifecycle states.
- Repository and use-case behavior contracts remain `create`, `getById`, `update`, `list`, and `duplicate`, with query-time filtering by status/owner/studio/search/limit and deterministic typed error mapping for invalid requests, conflicts, not-found, and adapter failures.
- Duplicate behavior remains lineage-preserving and non-mutating (`revision.duplicatedFromWorkflowId`), while resetting persistence/workflow revisions to first-write semantics for the duplicated record.
- Workflow Studio initialization paths are service-backed and persistence-backed:
  - `new` creates a new draft/session path,
  - `open-existing` loads persisted workflow definitions via `getPersistedWorkflow`,
  - `resume-draft` loads persisted draft definitions via the same retrieval contract.
- Metadata editing and save-state behavior remain part of the same persistence path as shared draft content (name/summary/tags persist through the same save operation and update Explore/read-model projections).
- Validation/error expectations stay backend-authoritative:
  - malformed draft definitions and malformed persisted serialized payloads are rejected as invalid-request failures,
  - missing workflow ids/records fail as not-found,
  - persistence adapter faults fail as persistence-failed at backend API boundaries.

## Direction 5 update: Workflow built-in step taxonomy + registry foundation (stories 6.1-6.2)

- Workflow-native built-in steps are now a first-class inner-layer concept in `domain/workflow-studio/WorkflowStudioDomain.ts` with canonical step taxonomy categories (`control-flow`, `temporal`, `human-interaction`, reserved `transformation`) and stable built-in step identities.
- Canonical built-in step contracts now include type/category/label/description/config schema id/default config and a domain validation entry point (`normalizeWorkflowDraftBuiltInStepConfig`) so built-in semantics stay out of UI-only code.
- The initial planned built-ins are now modeled explicitly as canonical contracts: `if-then`, `loop-iteration`, `delay-wait`, and `manual-approval`.
- Workflow draft normalization/validation now routes built-in config checks through those canonical contracts and remains persistence-safe through existing draft/entity persistence mappings.
- Application-layer discovery now uses `application/workflow-studio/BuiltInWorkflowStepRegistry.ts`, exposing stable built-in step enumeration and metadata to outer layers (wizard/canvas selectors) without hardcoded page-local built-in lists.
- Story 6.3 now defines `if-then` as a canonical conditional primitive with explicit condition strategy contracts (`expression` or `comparison`) and explicit branch targets (`then` / optional `else` labels + step references) validated through the same domain normalization path.
- Story 6.4 now defines `loop-iteration` as a canonical loop primitive with explicit mode/source contracts (`fixed-count`, `collection`, `range`) plus bounded body/max-iteration/exit-condition fields; cross-section checks continue to validate collection input references against canonical workflow inputs.
- Story 6.5 now defines `delay-wait` as a canonical temporal primitive with explicit timing modes (`duration` with structured value/unit, or `until-time` with timestamp/timezone), compatibility aliases (`durationSeconds`, `waitUntil`), and deterministic malformed-config rejection through the same built-in normalization path.
- Story 6.6 now defines `manual-approval` as a canonical human-interaction primitive with explicit interaction modes (`review` or `approval`), structured continuation/decision outcomes, required prompt semantics, timeout behavior policy (`reject`/`continue`/`escalate`), and compatibility aliasing for legacy `approvalMessage` flows.
- Stories 6.7-6.8 keep renderer authoring aligned to this inner model: wizard step selection reads from `BuiltInWorkflowStepRegistry` alongside asset-backed options, and wizard built-in editors only mutate canonical draft config fields that are validated by `normalizeWorkflowDraftBuiltInStepConfig` / `validateWorkflowDraft` rather than UI-local schema forks.
- Stories 6.9-6.10 now add canonical control-flow authoring and planning seams on top of that base:
  - planning remains canonical-first through `mapWorkflowDraftToExecutionPlan(...)`, and stories 6.11-6.12 now add runtime execution over that same plan seam (`WorkflowDraftExecutionRuntime`) plus explicit built-in persistence/rehydration round-trip coverage across studio-shell SQLite paths,
  - step authoring operations in `ui/studio-shell/workflow/WorkflowWizardSteps.ts` now preserve control-flow integrity during insert/reorder/remove (forward-only branch/body/outcome references, move blocking when a reorder would invalidate control-flow placement, and reference cleanup on removal),
  - domain validation now includes explicit built-in reference order checks (`built-in-step-reference-order-invalid`) for `if-then`, `loop-iteration`, and `manual-approval` outcome references,
  - workflow planning now has a dedicated canonical mapper `application/workflow-studio/WorkflowDraftExecutionPlanMapper.ts` (`mapWorkflowDraftToExecutionPlan`) that validates canonical drafts first and then emits deterministic execution-plan elements for action + built-in step types without introducing a parallel workflow model.

## Direction 5 update: Workflow trigger domain model + concrete manual/temporal types (stories 7.1-7.4)

- Workflow triggers are now modeled as first-class canonical domain contracts in `domain/workflow-studio/WorkflowStudioDomain.ts` with stable identity (`id`), kind (`user`/`temporal`/`state`), type identifiers, and typed configuration payloads that remain part of the canonical workflow draft (`WorkflowDraft.triggers`).
- Trigger configuration validation is now exposed through an explicit domain entry point (`normalizeWorkflowDraftTriggerConfig`) so trigger-config correctness remains reusable across authoring, persistence rehydration, and future runtime mapping.
- The domain now publishes trigger type definitions (`WorkflowDraftTriggerDefinition`) with stable type ids, labels/descriptions, config schema ids, capability metadata, and default config payloads for each initial trigger category/type.
- Initial seeded trigger definitions are explicit and discoverable for planned Epic 7 categories, with manual/user and temporal now implemented as concrete first trigger families:
  - user/manual: `manual`, `button-click`, `user-initiated-run`
  - temporal: `schedule`, `recurring`
  - state: `data-available`, `asset-state-changed`, `system-event`
- Manual trigger config now includes explicit invocation-scope semantics (`workflow-start`, `workflow-continuation`) so user-driven starts work now while preserving forward compatibility for intermediate continuation and future human-approval resume semantics.
- Temporal trigger config now supports pragmatic schedule semantics with explicit validation:
  - one-time execution (`runAt`)
  - cron-like schedule execution (`cronExpression`)
  - recurring interval execution (`every` + `unit`)
  - optional execution window bounds (`startAt`/`endAt`) with timestamp and ordering checks.
- Application-layer discovery now uses `application/workflow-studio/WorkflowTriggerTypeRegistry.ts`, which provides stable trigger listing/lookup/filtering, default-config projection, and config-validation delegation without adding UI-local trigger catalogs or runtime-specific trigger behavior.
- Runtime mapping readiness is now explicit through `application/workflow-studio/WorkflowTriggerRuntimeMapper.ts`, which projects canonical trigger contracts into runtime-facing descriptors without introducing a scheduler engine or UI-owned trigger logic.
- This keeps trigger semantics in inner layers and provides extension seams for future selector/configuration UI, persistence wiring, and execution-time trigger mapping.

## Direction 5 update: Workflow state trigger implementation + shared trigger validation pipeline (stories 7.5-7.6)

- State trigger configuration now exposes explicit event semantics (`sourceType`, `eventCategory`, `subject`) while preserving existing compatibility fields (`eventName`, `stateKey`, `stateValue`, `asset`, `filter`).
- State trigger defaults now map to concrete scenarios:
  - `data-available` -> dataset/data-ingestion semantics.
  - `asset-state-changed` -> asset-update semantics with explicit asset scope.
  - `system-event` -> system-state-change semantics.
- Trigger validation now has a shared canonical pipeline (`validateWorkflowDraftTriggers`) that performs:
  - per-trigger normalization/validation routed by trigger kind/type,
  - structured malformed-trigger issue reporting,
  - workflow-level trigger checks (duplicate ids, duplicate definitions, continuation-step references).
- `validateWorkflowDraft` now delegates trigger checks to that shared pipeline instead of keeping trigger-specific validation logic inline.
- Application-layer reuse now has a dedicated validation seam (`application/workflow-studio/WorkflowTriggerValidationPipeline.ts`) for single-trigger, type-config, and collection-level trigger validation without UI-owned trigger policy.
- Forward compatibility for human-approval continuation semantics is preserved by default pipeline scope handling (`workflow-start` and `workflow-continuation` are both valid invocation scopes).

## Direction 5 update: Workflow trigger persistence/read-write + wizard selector integration (stories 7.7-7.8)

- Canonical workflow draft persistence/read/write now treats trigger arrays as first-class draft content through the same authoritative mappings (`mapWorkflowDraftToPersistenceRecord`, `mapWorkflowDraftFromPersistenceRecord`, `serializeWorkflowDraft`, `deserializeWorkflowDraft`) used by workflow Studio save/load/version flows.
- SQLite-backed studio-shell integration now has focused trigger round-trip coverage so manual/user, temporal, and state trigger definitions survive persisted draft reload without a separate trigger storage model.
- Invalid trigger payload handling is bounded and safe at read/load seams: malformed trigger payloads surface parse/validation state during mode-store synchronization and do not replace previously valid shared draft state.
- Wizard trigger selector authoring is now registry-driven via `ui/studio-shell/workflow/WorkflowWizardTriggers.ts` over `WorkflowTriggerTypeRegistry`, so supported trigger discovery/default instance creation stays aligned with canonical trigger contracts.
- Renderer trigger edit flows remain shared-draft-first and validation-projection-driven (`WorkflowStudioModeStateStore` + canonical draft validation) with no duplicated UI-local trigger validation policy.

## Direction 5 update: Workflow trigger execution-planning alignment + coverage (stories 7.11-7.12)

- Trigger runtime mapping is now execution-plan integrated: `application/workflow-studio/WorkflowDraftExecutionPlanMapper.ts` includes trigger semantics mapped by `application/workflow-studio/WorkflowDraftTriggerExecutionPlanner.ts` from canonical draft triggers.
- Execution trigger semantics are explicit per supported trigger family and preserve type-specific config:
  - manual/user triggers -> user-invocation semantics (including `workflow-start` and `workflow-continuation` scope metadata),
  - temporal triggers -> temporal scheduling semantics (`scheduleMode`, cron/runAt/interval/time-window metadata),
  - state triggers -> state-event semantics (`sourceType`, `eventCategory`, subject/event/filter criteria metadata).
- Planning remains architecture-clean and source-of-truth aligned:
  - canonical workflow draft remains the only trigger source,
  - shared trigger normalization/validation still gates planning before mapping,
  - UI does not own runtime trigger mapping behavior.
- Unsupported/invalid trigger semantics now fail safely in planning paths (typed/structured planning failures) rather than silently dropping trigger definitions.
- Trigger coverage now includes focused tests on execution-planning seams plus regression coverage across existing domain/validation/persistence/wizard trigger tests, and docs now reflect the implemented end-to-end trigger flow.

## Direction 5 update: Studio shell persistence integration (story 1.11)

- Studio shell now has a real SQLite-backed infrastructure adapter (`infrastructure/filesystem/studio-shell/SqliteStudioShellRepository.ts`) implementing `IStudioShellRepository` with migration-managed schema, indexed studio/session/draft/version storage, and full aggregate snapshot persistence.
- Rehydration paths normalize persisted metadata/dependencies and reconstruct studio/session/draft/version state through existing domain normalization seams so taxonomy/contract/provenance/dependency/lifecycle/version invariants stay bounded to inner-layer rules.
- Desktop composition now uses the SQLite repository for studio-shell IPC operations (`electron/main/main.ts`) so studio/session/draft/version state survives process restarts.

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

- Studio shell now has a tested vertical flow across real seams (`StudioShellService` -> desktop bridge -> `StudioShellBackendApi` -> `DefaultStudioShellApplicationService` -> `IStudioShellRepository` SQLite adapter) rather than isolated layer checks.
- The bounded end-to-end path covers studio initialization/load, draft create/update, metadata patching (taxonomy/contract/provenance), dependency updates, lifecycle transitions, backend-authoritative validation projection, publish/version creation, and persisted snapshot reload.
- Persistence-backed publish truth remains explicit: draft revision/lifecycle semantics stay distinct from immutable version history semantics, and reload tests verify that published state survives repository/host restarts.

## Direction 5 update: Atomic studio registration foundation (story 2.5)

- The existing Studio Shell extension seam now includes a bounded studio registration contract in `ui/studio-shell/StudioShellExtensions.ts` (`StudioRegistration`, `StudioRegistrationRegistry`, plus `AtomicStudioRegistry` compatibility) so atomic and composite studios share one extension/registration seam rather than a second plugin architecture.
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

## Direction 5 update: External runtime bounded safeguards alignment (stories 7.23–7.24)

- External runtime safeguards continue to live on the current inner-layer seams (runtime backend API + existing access/quota/rate-limit/tenant policies + streaming/callback adapters); this epic does not introduce a second runtime architecture.
- External hot-path guardrails are now explicitly bounded and testable: short-lived caller/tenant-scoped poll/status caching, bounded callback registration counts per execution session, bounded streaming subscription/fan-out behavior, bounded async in-flight tracking, and bounded stream emission cadence.
- These additions are additive and correctness-preserving: authentication, access control, tenant isolation, and version-aware execution semantics remain enforced before protected reads are returned.
- Documentation now explicitly distinguishes what is implemented now (external runtime stories 7.1–7.23), what is bounded by design, and what remains future work (for example distributed external backpressure/observability infrastructure).

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
- Non-goals remain explicit: no second studio shell and no second taxonomy/contract stack; Prompt Template, Embedding Index, and Config Profile remain implemented through the same shared shell seams instead of separate architectures.

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
- Workflow draft output contracts now include a canonical structured output model (`id`, `order`, `outputType`, `format`, `destination`, `configuration`, `sourceStepId`) supporting one-or-more outputs per draft without introducing output-specific parallel schemas.
- Output destination definitions are now inner-layer contracts (`list/getWorkflowDraftOutputDestinationDefinitions`) with stable schema ids/defaults/formats for `file-export`, `web-viewer`, `system-entry`, and `prompt-response-chat`, so output selector/configuration flows reuse domain truth instead of UI-local registries.
- Output discovery now also has an explicit application-layer registry seam (`application/workflow-studio/WorkflowOutputTypeRegistry.ts`) that projects domain output definitions into reusable selector/config metadata (capabilities, field contracts, multiplicity policy, and destination/format support) for renderer and future execution/persistence surfaces.
- Output normalization now preserves backward compatibility aliases (`destination.options`, legacy top-level `title`) while projecting canonical `configuration`, and validation now includes output ordering integrity (`output-order-duplicate`, `output-order-non-contiguous`) plus destination-specific readiness checks.
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
- Rich visual graph-canvas tooling or runtime/deployment orchestration layers beyond current bounded system authoring + registry projection.

## Direction 5 update: System consistency + interop integration coverage (stories 5.21–5.22)

- Shared integration coverage now includes bounded end-to-end consistency for System Studio across create/update/validate/publish/reload over the real renderer service -> desktop bridge -> backend API -> application orchestration -> SQLite path (`ui/services/tests/StudioShellService.integration.test.ts`).
- System-specific operations are now exercised over that same seam (list/add/remove/reorder child components, interface updates, parameter updates, execution-metadata updates, and compatibility-insights queries) using the actual `SystemStudioBackendApi` bridge contract, not test-only direct application calls.
- Cross-kind interop coverage now validates mixed atomic/composite/system child composition in a single system draft with pinned versions, clean compatibility-insights status, and persisted upstream version lineage after publish/reload.

## Direction 5 update: Registry performance + consistency hardening (stories 4.15–4.16)

- Registry reads now include a bounded in-memory cache layer (`application/asset-registry/RegistryCacheLayer.ts`) used by query and dependency-graph services with cache-aside/read-through behavior.
- Registry query caching is keyed by filter/search shape and invalidated by source-signature changes (`versionCount` + `lineageEdgeCount`) so cache entries remain derived from canonical asset/version/lineage truth.
- Dependency graph expansion/traversal now caches adjacency and frequently repeated traversals, while projection rebuild remains tied to projection dirty/signature checks (`IRegistryGraphProjectionRepository`) rather than a second persistence layer.
- Cross-studio registry consistency now has integration-style coverage for atomic + composite publish/read/query/graph/lineage/search flows, including version update and dependency replacement scenarios (`application/asset-registry/tests/CrossStudioRegistryConsistency.integration.test.ts`).

## Direction 5 update: System registry graph + lineage validation (story 5.23)

- Registry integration coverage now explicitly validates system assets over the real registry seams (query service + graph service + backend API + SQLite persistence + published versions/lineage).
- Coverage includes:
  - parent system -> child asset edges (atomic/composite/system),
  - nested system -> parent system edges,
  - mixed lineage/dependency projection consistency across list/detail/graph/traversal surfaces,
  - version-aware system lineage coherence (parent/child version updates reflected in version history and system lineage projections).
- This remains an extension of the existing registry projection architecture (`RegistryQueryService`, `RegistryDependencyGraphService`, `RegistryBackendApi`), not a second graph/lineage subsystem.

## Direction 5 update: Registry alignment + UX refinement (stories 4.17–4.18)

### Registry architecture truth (as implemented)
- Registry data is a **derived projection**, not a source of truth. `RegistryQueryService` composes asset records, latest versions, lineage edges, taxonomy classification, contract resolution, and validation projection into `RegistryAsset` read models (`domain/asset-registry/RegistryAsset.ts`, `application/asset-registry/RegistryQueryService.ts`).
- Query/read surfaces are split cleanly:
  - `RegistryQueryService`: list/filter/search + detail by asset/version.
  - `CrossStudioRegistryQueryService`: taxonomy/contract/provenance/dependency-focused query wrappers used by API.
  - `RegistryDependencyGraphService`: direct and traversal graph reads (upstream/downstream) over rebuilt or persisted projection snapshots.
- Dependency semantics are explicit:
  - `version-upstream`: declared version upstream references.
  - `lineage-edge`: lineage relationships from canonical lineage edges.
  - `draft-dependency`: metadata-declared dependency references.
  These are projected into one dependency view without introducing a second graph model.
- Lineage semantics are version-centric and bounded: lineage lists and graph traversals are read projections with depth limits, not global causality proofs.
- Registry validation is projected from shared Studio Shell validation + atomic/composite consistency enforcement; the registry UI/API does not invent independent validation logic.

### Caching strategy (implemented)
- Caching is in-memory only (`RegistryCacheLayer`) and always disposable.
- Caches are keyed by query/traversal parameters and guarded by source signatures (`versionCount`, `lineageEdgeCount`), with namespace invalidation on signature drift.
- Graph caching includes adjacency/direct/traversal memoization. Projection rebuild remains governed by projection dirty/signature checks when `IRegistryGraphProjectionRepository` is present.
- No cache layer acts as durable truth; canonical asset/version/lineage repositories remain authoritative.

### API and usage patterns (implemented)
- Registry API (`infrastructure/api/registry/RegistryBackendApi.ts`) exposes:
  - list/filter/search assets
  - detail by asset id or version id
  - direct dependencies/dependents
  - upstream/downstream traversal
- API contracts intentionally use bounded typed error mapping (`not-found`, `invalid-request`, `internal`) over internal service failures.

### Atomic vs composite vs system handling (current scope)
- **Atomic and composite assets** are fully represented in current registry query/filter/detail/graph flows through taxonomy + contract projections and shared validation insights.
- **System assets** are first-class in current registry query/filter/detail/graph/lineage flows, including system-of-systems child references and bounded version-lineage projections for nested/child version inclusion.
- Future work remains explicit: broader visual graph editing and runtime/deployment orchestration UX are still outside current registry/system stories.

## Direction 5 update: System runtime domain foundation (stories 6.1–6.2)

- Added a bounded runtime domain slice at `domain/system-runtime/SystemRuntimeDomain.ts` for execution-state modeling that is explicitly separate from persisted asset-definition models.
- The runtime model introduces execution concerns only: execution identity, invocation context, runtime environment references, status transitions, input/output payload envelopes, and execution-node references.
- Runtime node references are nested-system-ready (`parentExecutionNodeId` + `path`) while intentionally stopping short of full orchestration/planning engines in this slice.
- Added runtime behavior alignment seam at `application/system-runtime/RuntimeBehaviorAlignment.ts` that maps shared behavior kinds into runtime execution profiles without reclassifying assets or duplicating taxonomy logic.


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

## Direction 5 update: Data Studio canonical-shape + converter foundation (stories 13.1-13.2)

- Data Studio now has a bounded canonical data-shape contract in `domain/dataset-studio/CanonicalDataShapes.ts` for:
  - record collections,
  - table projections,
  - document-derived text-item collections,
  - image-derived structured metadata records.
- Canonical shape metadata now includes bounded provenance/lineage/transformation-ready envelopes (source hints, asset/version lineage refs, converter metadata, preview attributes) so later preview/lineage/transform flows can reuse one inner-layer contract.
- A reusable conversion core now exists in `application/dataset-studio/DataConverterCore.ts` with explicit contracts and typed failures for core conversions:
  - file-like payloads -> canonical records,
  - canonical records -> canonical table,
  - document text -> canonical text items,
  - image metadata payloads -> canonical image metadata records.
- Scope remains intentionally bounded in this slice:
  - no ingestion asset execution pipeline was added,
  - no parallel data taxonomy or parallel asset identity model was introduced,
  - conversion logic remains deterministic and composable for future ingestion/preparation assets.


## Direction 5 update: Data Studio converter contracts + source locator abstraction (stories 13.3-13.4)

- Data converter operations now have explicit request/result contracts in `application/dataset-studio/DataConverterContracts.ts` with:
  - operation-scoped request unions,
  - converter context metadata (`requestId`/`operationId`/pipeline lineage hints),
  - structured diagnostics (`code`/`severity`/`path`/details),
  - explicit operation boundary metadata (raw/resolved/canonical input boundary -> canonical output kind) for preview/lineage/pipeline composition.
- Data conversion orchestration in `application/dataset-studio/DataConverterCore.ts` now keeps existing 13.1/13.2 conversion behavior while adding:
  - a contract-first `convert(...)` operation entrypoint,
  - structured success/failure envelopes,
  - typed source-resolution failure handling for pre-conversion boundaries.
- Data source resolution is now a separate reusable abstraction in `application/dataset-studio/DataSourceLocator.ts`:
  - normalized source-reference contracts (`in-memory`, `local-file`, `url`),
  - standardized resolved source model consumed by converter contracts,
  - loader-backed resolution seam (`IDataSourcePayloadLoader`) so source lookup stays separate from conversion semantics.
- Scope remains bounded:
  - no parallel data taxonomy/asset identity model was introduced,
  - converter logic still projects into canonical data-shape contracts from 13.1,
  - source locator remains a small reusable boundary without introducing ingestion-pipeline orchestration in this slice.

## Direction 5 update: Data Studio preview engine + data asset base abstraction (stories 13.5-13.6)

- Data Studio now has a reusable preview engine in `application/data-studio/DataPreviewEngine.ts` that maps canonical data-shape outputs into deterministic preview models:
  - `records`, `table`, `text-items`, and `image-metadata-records` are supported directly from the canonical shape contract,
  - previews are sampled/partial by bounded options (`maxItems`, `maxColumns`, `maxTextLength`) rather than full data exploration behavior,
  - preview metadata and diagnostics are preserved in one model so application services and UI surfaces can reuse the same preview truth.
- UI rendering adapters for the preview model now exist in `ui/components/assets/DataPreviewSurface.tsx`:
  - rendering is model-driven (canonical shape -> preview model -> UI) rather than ad hoc per-screen branching,
  - diagnostics and metadata are surfaced alongside sampled content for authoring-time inspection.
- Data assets now have a shared domain abstraction in `domain/dataset-studio/DataAssetBase.ts`:
  - extends the existing asset architecture (`domain/assets/Asset`) instead of introducing a parallel asset hierarchy,
  - standardizes explicit input/output contracts, bounded config surface, preview capability, version metadata, inspectability, and composability checks.
- A thin concrete canonical adapter `domain/dataset-studio/CanonicalDataAsset.ts` plus application integration in `application/dataset-studio/DataAssetFactory.ts` now provide a minimal end-to-end bridge from converter results to data-asset instances and preview generation.
- Scope remains intentionally bounded:
  - no ingestion-suite/pipeline-builder runtime stack was introduced,
  - no parallel taxonomy/identity/contract model was introduced,
  - abstractions remain focused on reusable data preview + data-asset foundation for later ingestion/pipeline stories.

## Direction 5 update: Data asset execution framework + lineage metadata model (stories 13.7-13.8)

- Data Studio now has an internal data-layer execution seam in `application/dataset-studio/DataAssetExecutionFramework.ts`:
  - explicit execution request/context/result contracts for dataset assets,
  - bounded execution input modes (`source-reference`, `resolved-source`, `converter-request`, `converter-result`, and canonical-shape),
  - lifecycle-oriented execution flow (validation -> resolve/convert -> preview -> packaged result),
  - standardized execution outputs for preview, diagnostics, downstream composition, and lineage handoff.
- Execution integrates existing 13.1-13.6 foundations directly:
  - conversion and source resolution via `DataConverterCore` + source-locator-backed conversion paths,
  - canonical data-shape output reuse from `domain/dataset-studio/CanonicalDataShapes.ts`,
  - preview generation via `application/data-studio/DataPreviewEngine.ts`,
  - data-asset compatibility checks against `domain/dataset-studio/DataAssetBase.ts`.
- Data lineage metadata is now first-class in `domain/dataset-studio/DataLineageMetadata.ts`:
  - typed lineage references (inputs/intermediates/outputs),
  - execution-step provenance with status/timestamps/diagnostics,
  - producer + execution markers and serializable metadata envelopes.
- Data asset creation now has an execution-result bridge (`DataAssetFactory.createFromExecutionResult`) so execution outputs can be projected into canonical data assets without introducing a separate taxonomy or registry path.
- Scope remains intentionally bounded:
  - lineage is modeled as metadata/provenance attached to execution results and assets, not a standalone graph engine,
  - no lineage visualization/editor UI or distributed orchestration pipeline was introduced in this slice.

## Direction 5 update: Data Studio validation/error model + preview-panel integration seam (stories 13.9-13.10)

- Data Studio now has a focused validation/error framework in `application/dataset-studio/DataStudioValidation.ts` that standardizes:
  - issue sections across canonical-shape, converter-request/result, source-reference/resolved-source, data-asset-config, execution-request, and preview-model boundaries,
  - warning vs error severities with path-level issue reporting,
  - deterministic mapping from validation issues -> converter diagnostics for existing execution/preview contracts.
- Converter/source/execution flows now consume that same framework:
  - `DataConverterCore` performs contract-level request/result validation and emits structured diagnostics before/after conversion,
  - `DataSourceLocator` validates source inputs + resolved outputs and returns typed locator failures with diagnostics,
  - `DataAssetExecutionFramework` validates execution requests/output/preview and now returns explicit `validationIssues` plus structured `failure` metadata (`validation` vs `runtime`) in execution results.
- Scope remains bounded and architecture-aligned:
  - no parallel data taxonomy or parallel execution stack was introduced,
  - validation remains explicit/result-driven (not exception-first control flow),
  - data-layer diagnostics stay inspectable and reusable for UI surfaces.

## Direction 5 update: Data asset registry + schema-driven config contracts (stories 13.11-13.12)

- Data Studio now has an explicit registry seam in `application/dataset-studio/DataAssetRegistry.ts` for deterministic registration/discovery/loading of data assets without creating a parallel taxonomy or global plugin runtime.
- Registry entries now expose bounded discovery metadata for UI/application composition:
  - asset identity (`assetId`, `versionId`, `name`),
  - taxonomy-aligned role metadata (`taxonomy` + bounded `specialization` tags for converter/preview/ingestion/transformation intent),
  - contract references (input/output shape descriptors + contract version),
  - output/composability metadata (`outputShapeKind`, `composableInputShapeKinds`),
  - capability metadata (`configurable`, `previewable`, `executable`),
  - schema-driven config contracts (`DataAssetConfigSchema`) for reusable authoring surfaces.
- Data asset config schema contracts are now centralized in `application/dataset-studio/DataAssetConfiguration.ts`:
  - typed field kinds and options,
  - deterministic schema normalization/default resolution,
  - bounded schema inference from existing `DataAssetBase.config` values when explicit schema is not provided.
- Data Studio validation now includes schema-aware config validation in `application/dataset-studio/DataStudioValidation.ts` (`validateDataAssetConfigValues`) so field-level config diagnostics use the same validation framework as execution/preview flows.
- Scope remains intentionally bounded:
  - no remote marketplace/auto-discovery/plugin-packaging architecture was introduced,
  - registry loading is explicit registration + optional config-aware asset factory functions,
  - taxonomy/asset identity remain anchored to existing shared asset + dataset foundations.
