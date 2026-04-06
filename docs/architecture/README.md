# Architecture Overview

AI Loom Studio is organized around a clean-architecture-style core for desktop-first tooling. The codebase separates **business meaning**, **application orchestration**, **host/runtime adapters**, and **UI delivery** so that workflows, tools, context packages, model management, and managed runtimes can evolve without forcing all concerns into the renderer or the Electron host.

This documentation describes the architecture **as implemented today**, not as an idealized target. Where the implementation appears to drift from the product's core intentions, each document includes a **TODO** section so the current state is transparent.

## Core architectural intent

At a high level, the system aims to provide:

- A stable **domain core** for workflows, nodes, models, assets, context packages, tools, managed services, and tuning datasets.
- An **application layer** that exposes explicit use cases and service orchestration over domain models and ports.
- An **infrastructure layer** that binds those ports to concrete implementations such as filesystem storage, browser storage, Electron bridges, Python runtime clients, MCP runtime adapters, and execution engines.
- A **presentation/host layer** that delivers the product through a React renderer and an Electron desktop shell.
- A runtime model that can truthfully distinguish between **delegated execution** and **fallback/interpreted execution**, rather than pretending every run used the same engine.

## The main architectural layers

### 1. Domain
The `domain/` tree contains the business model and validation logic. It defines the language of the product: workflows, nodes, connections, model compatibility, workflow validation, managed services metadata, tuning-dataset entities, and more. The domain is intentionally free of Electron, browser, and storage details.

Representative files:
- `domain/workflows/Workflow.ts`
- `domain/services/WorkflowValidator.ts`
- `domain/services/NodeCompatibilityService.ts`
- `domain/models/Model.ts`
- `domain/tuning-datasets/TuningDatasetEntities.ts`

### 2. Application
The `application/` tree defines use cases, application services, DTOs, projection services, and ports/interfaces. This is the layer that answers questions like:
- "How do we execute a workflow?"
- "How do we run a published workflow as a tool?"
- "How do we preview workflow context?"
- "How do we install or search models?"

It depends inward on the domain and outward only through interfaces/ports.

Representative files:
- `application/workflows/ExecuteWorkflowUseCase.ts`
- `application/tools/RunToolUseCase.ts`
- `application/context/WorkflowContextService.ts`
- `application/ports/interfaces/*`
- `application/projection/*`

### 3. Infrastructure
The `infrastructure/` tree implements the concrete adapters that make the application layer usable in real environments. This includes:
- filesystem repositories
- browser-storage repositories
- desktop bridge repositories
- Python runtime adapters
- MCP integration
- execution strategies
- dependency registration/composition

Representative files:
- `infrastructure/composition/ApplicationBootstrap.ts`
- `infrastructure/composition/InfrastructureRegistry.ts`
- `infrastructure/filesystem/LocalWorkflowRepository.ts`
- `infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`
- `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`

### 4. Presentation and hosts
The system has two delivery surfaces working together:

- **React renderer (`ui/`)**: pages, stores, UI services, composition helpers, and components.
- **Electron desktop host (`electron/`)**: main-process startup, preload bridge, local storage/bootstrap services, and desktop-only capabilities.

The host decides what capabilities exist; the UI composes the dependencies it needs for the current runtime mode.

Representative files:
- `ui/composition/createUiDependencies.ts`
- `ui/composition/AppProviders.tsx`
- `ui/routes/AppRouter.tsx`
- `electron/main/main.ts`
- `electron/preload.ts`
- `electron/shared/DesktopContracts.ts`

## Architectural reading order

If you are new to the codebase, this is the most useful order for understanding it:

1. **Read the domain contracts and aggregates first** to learn the product language.
2. **Read the application use cases and ports** to see how that language is orchestrated.
3. **Read the execution/runtime adapters** to understand how the product actually runs.
4. **Read the UI composition root** to see what the renderer instantiates in practice.
5. **Read the Electron main/preload layer** to understand the desktop-specific bridge.

## Key architectural characteristics

### Desktop-first, but with browser fallbacks
The product is described as desktop tooling, and the Electron host is the canonical shell. At the same time, the renderer composition supports browser-style fallbacks for persistence and some runtime behavior. That creates a pragmatic architecture in which desktop is the intended home, but degraded/browser-backed execution remains possible.

### Clean architecture with pragmatic seams
The codebase clearly follows clean architecture concepts:
- domain models are separated from adapters
- use cases depend on ports
- infrastructure implements ports
- the UI talks mostly through services/use cases/stores

However, the implementation is intentionally pragmatic rather than dogmatic. Some UI services still mutate domain objects directly for convenience, and the UI has its own manual composition root in addition to the infrastructure DI bootstrap.

### Feature slices built on shared layers
Within the broad architecture, several feature slices are implemented end-to-end through the same layering approach:
- workflows and nodes
- tools and MCP integration
- context engineering and context packages
- model management and training
- managed services/runtime orchestration
- tuning dataset studio

## Runtime modes in practice

The runtime is not a single path. The system currently supports multiple execution/storage modes depending on configuration and host availability:

- **Desktop + Electron bridge** for durable local storage and model-file access.
- **Desktop + managed local Python runtime** for delegated execution and managed services.
- **Browser/development fallback** for local storage-backed persistence and reduced capabilities.
- **Truthful execution selection**, where the executor chooses a compatible strategy and records provenance instead of hiding degraded behavior.

## Where to go next

- For the inner clean-architecture core, read [`domain-and-application-core.md`](./domain-and-application-core.md).
- For layer boundaries and dependency rules, read [`layers-and-boundaries.md`](./layers-and-boundaries.md).
- For execution, tools, MCP, and runtime selection, read [`workflow-execution-and-tools.md`](./workflow-execution-and-tools.md).
- For host/runtime composition and desktop delivery, read [`desktop-runtime-and-hosts.md`](./desktop-runtime-and-hosts.md).
- For UI composition and state flow, read [`presentation-and-state.md`](./presentation-and-state.md).
- For cross-studio asset selection contracts and capability rules, read [`asset-selector-framework.md`](./asset-selector-framework.md).
- For canonical studio launch/return handoff contracts, read [`studio-handoff-contract.md`](./studio-handoff-contract.md).
- For local identity domain, contracts, persistence, and provider-extension seams, read [`identity-foundation.md`](./identity-foundation.md).
- For authoritative local identity registration/login server endpoints and transport contracts, read [`identity-server-api.md`](./identity-server-api.md).
- For session lifecycle, policy, guard, revocation, and client integration behavior, read [`identity-session-architecture.md`](./identity-session-architecture.md).
- For trusted-device domain lifecycle, trust-state transitions, and identity/workspace trust contracts, read [`trusted-device-foundation.md`](./trusted-device-foundation.md).
- For node identity/trust lifecycle vocabulary, capability-profile contracts, and revocation/last-seen domain invariants, read [`node-trust-foundation.md`](./node-trust-foundation.md).
- For node trust persistence DTO/repository/schema contracts and indexing-oriented query patterns, read [`node-trust-persistence-contracts.md`](./node-trust-persistence-contracts.md).
- For node trust application-layer enrollment/approval/revocation/heartbeat/query orchestration seams and hook ports, read [`node-trust-application-use-cases.md`](./node-trust-application-use-cases.md).
- For shared node-trust API/IPC request-response contracts, admin-vs-internal DTO boundaries, and schema validation adapters, read [`node-trust-transport-contracts.md`](./node-trust-transport-contracts.md).
- For internal CA domain contracts, certificate lifecycle boundaries, and trust-material metadata seams, read [`internal-ca-foundation.md`](./internal-ca-foundation.md).
- For transport security domain/application contracts, fail-closed channel policy semantics, and host adapter integration guidance, read [`transport-security-foundation.md`](./transport-security-foundation.md).
- For secret and key management domain/application contracts, scope ownership invariants, and auditable access-decision seams, read [`secrets-foundation.md`](./secrets-foundation.md).
- For secret repository SQLite schema, secret-version material separation, and idempotent persistence adapter behavior, read [`secrets-persistence-contracts.md`](./secrets-persistence-contracts.md).
- For envelope encryption design, master-key handling seams, and encrypted payload operational assumptions, read [`secrets-envelope-encryption.md`](./secrets-envelope-encryption.md).
- For create-secret and metadata-only retrieval application orchestration, key uniqueness validation, and metadata redaction behavior, read [`secrets-creation-and-metadata-use-cases.md`](./secrets-creation-and-metadata-use-cases.md).
- For explicit scope-owner validation and deterministic policy-driven secret key resolution behavior, read [`secrets-scope-resolution-rules.md`](./secrets-scope-resolution-rules.md).
- For authoritative server runtime secret-service composition, host dependency wiring, and startup configuration posture, read [`secrets-service-composition.md`](./secrets-service-composition.md).
- For runtime service-to-service secret credential consumption adapters and formal retrieval dependency patterns, read [`secrets-service-consumption-adapters.md`](./secrets-service-consumption-adapters.md).
- For contributor extension rules that keep new secret-backed modules on formal retrieval/audit/redaction paths, read [`secrets-feature-extension-guidance.md`](./secrets-feature-extension-guidance.md).
- For secret rotation versioning, activation preconditions, and race-safe activation semantics, read [`secrets-rotation-and-version-activation-workflows.md`](./secrets-rotation-and-version-activation-workflows.md).
- For secret operation authorization governance, runtime-vs-human access rules, and non-leaky denial posture, read [`secrets-authorization-policies.md`](./secrets-authorization-policies.md).
- For internal secret metadata management API contracts, request-validation behavior, and metadata-only response posture, read [`secrets-metadata-management-internal-apis.md`](./secrets-metadata-management-internal-apis.md).
- For seeded secret classifications, naming-prefix conventions, metadata-label requirements, and classification validation boundaries, read [`secrets-classification-and-metadata-conventions.md`](./secrets-classification-and-metadata-conventions.md).
- For master-key change re-encryption workflow behavior, restartable operation tracking, and failure recovery posture, read [`../secret-master-key-reencryption-operations.md`](../secret-master-key-reencryption-operations.md).
- For node-local bootstrap identity/trust-material operations and enrollment payload bootstrap metadata, read [`../node-bootstrap-identity-operations.md`](../node-bootstrap-identity-operations.md).
- For workspace tenancy domain aggregates, membership/role/invitation invariants, and reusable ownership metadata patterns, read [`workspace-foundation.md`](./workspace-foundation.md).
- For managed storage domain entities, lifecycle/access/replication/policy invariants, and audit attribution contracts, read [`storage-foundation.md`](./storage-foundation.md).
- For managed storage application ports, lifecycle/policy/provisioning seams, and use-case command/query contracts, read [`storage-application-ports.md`](./storage-application-ports.md).
- For managed storage persistence schema, mapper/repository behavior, and migration semantics, read [`storage-persistence-contracts.md`](./storage-persistence-contracts.md).
- For local server-managed storage backend provisioning/capability adapter behavior and operational assumptions, read [`storage-local-backend-adapter.md`](./storage-local-backend-adapter.md).
- For shared mounted/network storage backend binding/validation behavior and target capability contracts, read [`storage-shared-backend-adapter.md`](./storage-shared-backend-adapter.md).
- For synchronized storage eligibility/state seam behavior, deployment-availability posture, and replication sync metadata projection, read [`storage-sync-backend-adapter.md`](./storage-sync-backend-adapter.md).
- For centralized backend selection, create-storage provisioning orchestration, and failed-state persistence behavior, read [`storage-provisioning-orchestration.md`](./storage-provisioning-orchestration.md).
- For shared storage transport DTOs, schema validation contracts, and sensitive redaction projection rules, read [`storage-transport-contracts.md`](./storage-transport-contracts.md).
- For storage permission surfaces, action-level access summaries, and policy-restricted capability semantics, read [`storage-access-semantics.md`](./storage-access-semantics.md).
- For authorization domain contracts covering RBAC, visibility, sharing, actor/resource policy context, and policy-decision models, read [`authorization-foundation.md`](./authorization-foundation.md).
- For canonical authorization permission naming, resource/action matrix definitions, and permission lookup usage, read [`authorization-permission-catalog.md`](./authorization-permission-catalog.md).
- For workspace role definitions, baseline role-to-permission mappings, and deployment profile override seams, read [`authorization-role-reference.md`](./authorization-role-reference.md).
- For reusable protected-resource visibility metadata, explicit sharing targets, and resource-authorization adaptation guidance, read [`authorization-visibility-sharing-contracts.md`](./authorization-visibility-sharing-contracts.md).
- For authorization application ports, policy evaluator seams, and adapter expectations for context loading/event recording, read [`authorization-application-ports.md`](./authorization-application-ports.md).
- For shared authorization payload schemas, boundary validation contracts, and schema-vs-domain guidance, read [`authorization-schema-validation-contracts.md`](./authorization-schema-validation-contracts.md).
- For authorization persistence DTO/repository contracts, idempotent mutation semantics, and migration-ready lifecycle fields, read [`authorization-persistence-contracts.md`](./authorization-persistence-contracts.md).
- For the end-to-end Feature 4 / Epic 4.1 authorization implementation baseline and extension guidance, read [`authorization-feature-4-epic-4.1-baseline.md`](./authorization-feature-4-epic-4.1-baseline.md).
- For the Feature 4 / Epic 4.2 effective-permission resolution baseline and deterministic precedence model, read [`authorization-feature-4-epic-4.2-policy-evaluation-engine-and-authorization-persistence.md`](./authorization-feature-4-epic-4.2-policy-evaluation-engine-and-authorization-persistence.md).
- For Feature 4 / Epic 4.3 transport/runtime enforcement adapters and consistent HTTP/WebSocket/IPC authorization mapping, read [`authorization-feature-4-epic-4.3-protected-resource-enforcement-and-runtime-integration.md`](./authorization-feature-4-epic-4.3-protected-resource-enforcement-and-runtime-integration.md).
- For route/handler/resource-module/UI/async extension rules that keep enforcement centralized, read [`authorization-enforcement-integration-patterns.md`](./authorization-enforcement-integration-patterns.md).
- For the consolidated Feature 4 production baseline and extension checklist, read [`authorization-feature-4-final-baseline.md`](./authorization-feature-4-final-baseline.md).
- For admin/user sharing-management and access-review operations guidance, read [`../authorization-sharing-management-and-access-review.md`](../authorization-sharing-management-and-access-review.md).
- For workspace administration audit hook seams and integration boundaries, read [`workspace-administration-audit-hooks.md`](./workspace-administration-audit-hooks.md).
- For Feature 1 completion baseline and downstream dependency notes (trusted device, workspace membership, authorization), read [`identity-feature-1-final-baseline.md`](./identity-feature-1-final-baseline.md).

## Direction 4 (Phase 1) foundation
- Agent concepts are now first-class inner-layer artifacts (`domain/agents/*`) with validated goal, policy, memory, and execution-session models (including lifecycle and invariant enforcement).
- Agent roots now expose explicit `toolAccess` alongside policy so planner/executor consumers use a stable contract without reinterpreting nested policy structure.
- Agent memory configuration is explicitly asset-based (`AssetId` references + memory types + typed retrieval configuration + revision), aligned with Direction 2 lineage/versioning.
- Agent execution now has a bounded mapping seam into the unified execution backbone (`application/agents/contracts/AgentExecutionMapping.ts`) that yields `ExecutionPlan` units plus per-unit payload correlation data, rather than introducing a second runtime model.
- This remains a foundation slice only: no studio UI, no autonomous replanning loop, and no parallel orchestration stack.

- Direction 4 (Phase 2 inner-foundation slice) now includes an execution-oriented agent planning contract: validated dependency-aware plan/step models in `domain/agents/AgentPlan.ts`, planning strategy contracts in `application/agents/contracts/AgentPlanningStrategy.ts` + `application/agents/services/DeterministicAgentPlanningStrategy.ts`, and bounded evaluation/replan signal contracts in `application/agents/contracts/AgentPlanningLoop.ts`.
- Agent/execution bridging remains unified-engine-native via `application/agents/contracts/AgentExecutionMapping.ts`, including direct mapping from `AgentPlan` into `ExecutionPlan` units plus per-unit payload metadata (asset inputs and step-output references).
- Direction 4 (Phase 3 inner slice) adds asset-driven memory seams for agents without introducing a second runtime:
  - typed memory retrieval seam (`application/agents/contracts/AgentMemoryRetrieval.ts`, `application/agents/services/AgentMemoryRetrievalService.ts`);
  - bounded session working-memory model (`domain/agents/AgentWorkingMemory.ts`, `application/agents/services/AgentWorkingMemoryService.ts`);
  - bounded memory write pipeline (`application/agents/services/AgentMemoryWriteService.ts`);
  - explicit memory policy controls on agent memory config (`domain/agents/AgentMemory.ts`) for retrieval/write/retention behavior.
  - retrieval now remains deterministic and asset-version-backed while honoring policy/type/tag/metadata/recency constraints (and excluding session-only types from durable retrieval paths).
  - execution read models now include bounded working-memory snapshots and memory-write outcomes so later evaluation/replanning layers can consume session context without introducing a second orchestration model.
  - memory policy retention is now operationally enforced in the write pipeline via bounded durable-capacity gating.

- Direction 4 (Phase 4, MCP tool integration inner slice) now keeps MCP as the external tool-protocol boundary while remaining execution-native: agent policy carries canonical MCP bindings, agent mapping emits `mcp-tool-invocation` execution units, and plan/execute-time MCP governance checks reuse existing registry/trust services instead of introducing a parallel agent runtime.
- Direction 4 (Phase 4 completion + Phase 5 inner foundations) now introduces a reusable planner/tool compatibility seam (`AgentPlanToolSelectionService`), richer deterministic MCP governance outcomes (explicit unavailable/approval-required/denied/incompatible semantics), and a bounded inner runtime coordinator (`AgentRunnerService`) that composes planning, governance, execution, and memory while emitting structured runtime progress events and applying bounded retry/failure policies.
- Phase 5 hardening now keeps retry/partial-execution truth explicit in inner contracts:
  - terminal failures can explicitly signal retry exhaustion (`retryExhausted`);
  - execution sessions persist per-step outcomes and optional output-asset diagnostics;
  - execution sessions now carry explicit terminal-state truth (`reason`: `completed` | `failed` | `cancelled` | `blocked`) plus bounded partial-progress summary (`hadPartialProgress`, completed/attempted step counts);
  - runner/session persistence now records lifecycle transitions from first persisted `pending` state through `ready`/`running` and terminal status, so transition history is complete instead of terminal-only;
  - SQLite session persistence now stores structured terminal/progress columns (`terminal_reason`, `had_partial_progress`, `completed_step_count`, `attempted_step_count`, `step_outcome_count`) in addition to canonical session JSON;
  - transition-history reads are part of the session repository port (`IAgentExecutionSessionRepository`).
- Phase 6 inner authoring foundation now adds real backend-ready seams without UI coupling:
  - persistence: `IAgentRepository` with concrete `SqliteAgentRepository`;
  - CRUD/lifecycle use cases: create/update/get/list/delete/archive;
  - CRUD failure modes now surface typed application errors (`agent-conflict`, `agent-not-found`, `agent-invalid-request`) so API/IPC adapters map contracts deterministically;
  - bounded structured configuration use cases: goals/policy/tools/memory/strategy;
  - configuration use cases now share typed failure semantics (`agent-not-found`, `agent-invalid-request`, `validation-failed`) instead of message-derived mapping;
  - cohesive cross-field validation seam: `AgentConfigurationValidationService` + `ValidateAgentConfigurationUseCase` (deterministic issue codes for goal/tool/memory/policy/strategy coherence, plus domain-level fallback validation);
  - SQLite agent persistence now also records structured authoring/query fields (`strategy_id`, `strategy_mode`, `goal_count`, `allowed_tool_count`) while preserving aggregate round-trip truth in `agent_json`.
  - memory configuration is now contract-hardened (canonical asset refs, retrieval compatibility, writable/retrievable/session-only coherence, retention/session-only contradiction checks).
  - strategy configuration is now explicitly bounded to supported descriptors (`deterministic@deterministic-linear` in this slice), with unsupported configs rejected deterministically.
  - whole-agent validation output now includes machine-friendly sectioned issues (`code`, `path`, `section`, `severity`, `message`) and is reused by CRUD/configuration/API seams through `AgentConfigurationValidationError`.
  - backend authoring transport now exposes thin desktop IPC endpoints (`ai-loom-desktop-agents:*`) via `AgentAuthoringBackendApi` for CRUD/configuration/validation without transport-layer business logic.
  - `AgentAuthoringBackendApi` error mapping is now type-based only (`AgentAuthoringError` + `AgentConfigurationValidationError`); unknown failures map to `internal` without substring heuristics.

## Shared composition taxonomy foundation

- A compact taxonomy descriptor now exists in `domain/taxonomy/CompositionTaxonomy.ts` with explicit `structuralKind`, `semanticRole`, and `behaviorKind`.
- Classification seams for existing concepts live in `application/taxonomy/CompositionTaxonomyClassifier.ts`.
- Workflow and agent adapter seams (`application/workflows/WorkflowTaxonomy.ts`, `application/agents/contracts/AgentTaxonomy.ts`) explicitly align with the same composition model.
- Canonical identities now persist taxonomy metadata and canonical asset query criteria supports taxonomy-aware filters (`structuralKinds`, `semanticRoles`, `behaviorKinds`).
- Canonical asset summary/detail read use cases include taxonomy descriptors through identity metadata with bounded fallback mapping.
- See `shared-composition-taxonomy.md` for scope, boundaries, and current-state mapping details.
- Shared asset contracts now complement taxonomy through a compact inner-layer model (`domain/contracts/AssetContract.ts`) and adapter seam (`application/contracts/CompositionAssetContractResolver.ts`), with canonical operational reads surfacing both where available; see `shared-asset-contracts.md`.

## TODO

- The repository still contains **two composition stories**: the generic DI bootstrap in `infrastructure/composition/` and the renderer-specific manual composition in `ui/composition/createUiDependencies.ts`. Execution-engine wiring, execution-run persistence, MCP server-operation handler registration, and execution-history/detail projection services now share more of the same outer-layer path across those roots, but broader composition convergence is still future work.
- The product intent appears desktop-first, yet a meaningful amount of durability and orchestration still routes through browser-style adapters. That is practical, but the desired "source of truth" between desktop-native persistence and browser fallback should be documented in product terms more explicitly.

## Direction 5 update: Exchange (Epic 10) status snapshot

- Exchange now has a first-class local-first publish/package/import stack across `domain/exchange/*`, `application/exchange/*`, and `infrastructure/api/exchange/*`.
- Implemented now: bundle + manifest + dependency snapshot modeling, format compatibility/versioning, validation + deterministic serialization/deserialization, atomic/composite/system export/import services, exchange access control, publishable package lifecycle, local catalog abstraction, publish workflow, and public exchange SDK DTO mappings.
- End-to-end coherence coverage is now present for export -> validate/deserialize -> publish/catalog -> import (including provenance/lineage, access-denial, and conflict outcomes) in `application/exchange/tests/ExchangeEndToEndLifecycle.integration.test.ts`.
- Boundary clarity is explicit: exchange artifacts remain distinct from runtime execution state, deployment execution state, and studio-handoff artifacts.
- Future-oriented but not implemented in this slice: distributed/LAN repository sharing and distributed packaging/execution behaviors; current abstractions keep that path open without claiming support today.

## AI Loom image manipulation update: template completeness + wiring/storage contract validation (stories 10.1-10.4)

- Added a dedicated completeness validation seam in `application/system-studio/ImageManipulationSystemCompletenessValidationService.ts` that emits structured category/code/severity/path/metadata issues and an `AssetValidationResult` projection.
- Validation now covers system asset presence, page wiring references, workflow template references, property schema defaults, runtime metadata, dataset bindings, storage-instance logical binding references, and execution-adapter references.
- Added focused end-to-end page/workflow/runtime wiring checks (story 10.3) for execution action binding, schema-field to mapping alignment, workflow override mapping coverage, output-target dataset/storage alignment, and preview/gallery contract compatibility.
- Added shared-storage compatibility checks (story 10.4) for logical storage references, cross-system shared-storage provisioning compatibility, and rejection of system-owned/raw-path storage assumptions in template/workflow contracts.
- Runnable-default checks now enforce execution-critical defaults (workflow parameter defaults and property-schema defaults), ensure required dataset provisioning bindings are included by default, and reject raw filesystem path dependencies in logical dataset/storage contracts.
- Build-template bootstrap now enforces runnable-default completeness in `application/system-studio/SystemBuildTemplateCatalog.ts` and stores an inspectable completeness result on each catalog entry.

## AI Loom image manipulation update: runtime dependency readiness + runnable smoke coverage (stories 10.5-10.6)

- Comfy image-manipulation readiness validation now classifies runtime dependency failures with machine-readable semantics (`required-missing-dependency`, `optional-missing-dependency`, `incompatible-dependency`, `unresolved-dependency-reference`) and includes structured metadata for model/custom-node/runtime diagnostics surfacing.
- Readiness now composes runtime-installation requirement contracts with optional runtime installer diagnostics, covering both default non-FaceID and FaceID-capable paths without introducing path-based checks in higher layers.
- Template completeness validation now includes runtime-dependency-readiness checks for both default execution profiles, so partially configured defaults fail catalog runnable validation instead of passing until runtime.
- Added vertical-slice smoke coverage through `StudioShellBackendApi` that materializes the default template from catalog seed, provisions shared storage/dataset bindings, persists a run result, and verifies output-gallery/run-history retrieval contracts end-to-end.

## AI Loom image manipulation update: runnable-template contract docs + regression hardening (stories 10.9-10.10)

- Runnable template contract is now explicit: a system template is runnable only when completeness validation is valid, execution-readiness checks are valid for default execution path assumptions, and seeded build-template content resolves the required page/workflow/runtime wiring with no manual post-seed edits.
- Completeness/readiness rules for Epic 10 are documented as contract-level gates:
  - system/page/workflow/property-schema/runtime assets are present and canonically bound,
  - required runnable defaults are present for schema and workflow execution parameters,
  - page/workflow/runtime wiring is consistent for run action, mapping, output dataset/storage, and preview/gallery contracts,
  - runtime dependency readiness is satisfied for required model/custom-node/runtime assumptions.
- Shared storage model is now documented as first-class direction:
  - storage instances are provisioned by the platform/runtime flow, not user path configuration,
  - storage instances are shareable across systems and embedded subsystems,
  - workflows and UI bind via logical dataset/storage references (for example `dataset-instance-ref:*`, `storage-instance://*`) instead of raw filesystem paths,
  - conceptual storage layout follows `/storage/{instanceId}/input|output|reference` while `/systems/{systemId}` remains system files/metadata territory.
- The default image manipulation template remains a no-extra-setup vertical slice: after normal runtime/install flow, default seeded template execution can run end-to-end without additional user configuration of paths/storage bindings.
- Asset relationship expectations are explicit and layered:
  - system asset composes page asset + workflow template + runtime metadata contracts,
  - page asset executes against property schema and workflow bindings,
  - workflow template defines dataset/storage/output/runtime execution metadata contracts,
  - dataset/storage bindings stay logical and shareable,
  - readiness validation is the final gate before treating template defaults as runnable.
- Regression coverage now protects these guarantees through contract-focused suites in:
  - `application/system-studio/tests/ImageManipulationRunnableTemplateContract.regression.test.ts`,
  - existing completeness/readiness/smoke/failure-path suites under `application/system-studio/tests/*` and `infrastructure/api/studio-shell/tests/*`.



