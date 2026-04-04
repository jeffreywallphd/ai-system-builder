# Layers and Boundaries

This document explains the intended clean-architecture boundaries in AI Loom Studio and how those boundaries are realized in the current implementation.

## Dependency rule

The codebase mostly follows the classic dependency direction:

- `domain/` should not know about application services, UI, Electron, browser storage, or Python runtime adapters.
- `application/` can depend on `domain/`, but should depend on external systems only through ports/interfaces.
- `infrastructure/` implements those ports and composes concrete adapters.
- `ui/` and `electron/` sit at the outside edge and drive the system.

In other words: **policy points inward, detail points outward**.

## Domain layer responsibilities

The domain layer holds the durable product concepts and validation rules.

### What belongs here
- immutable-style aggregates and value objects
- workflow graph semantics
- model compatibility logic
- connection and node validation rules
- service compatibility rules
- tuning dataset domain policies and release semantics

### Example: workflow aggregate
`domain/workflows/Workflow.ts` models the workflow as the root aggregate. It owns metadata, status, runtime profile, execution policy, nodes, and connections, and exposes mutation methods that return updated workflow instances rather than mutating internal state in place.

That design matters because it gives the rest of the system a stable business object independent from storage, rendering, or runtime implementation.

### Example: workflow validation
`domain/services/WorkflowValidator.ts` performs layered validation over the workflow graph, nodes, connections, runtime policy, and execution policy. This is important architecturally because the rules for whether a workflow is valid live in the domain/service layer rather than inside UI components or infrastructure adapters.

## Application layer responsibilities

The application layer translates user/system intent into domain operations.

### What belongs here
- explicit use cases
- application services
- DTOs and request/response objects
- projection/translation helpers
- ports/interfaces that describe required external capabilities

### Example: use-case orchestration
`application/workflows/ExecuteWorkflowUseCase.ts` does not execute workflows itself. Instead, it:
- applies property overrides
- optionally validates the workflow
- resolves workflow context metadata
- delegates execution to an `IWorkflowExecutor`

This is a textbook application-layer role: orchestrate policy and external dependencies without becoming an infrastructure adapter.

### Example: tools as projected workflows
The tool system in `application/tools/RunToolUseCase.ts` and `application/projection/WorkflowToolProjectionService.ts` is especially important architecturally. The code treats a published workflow as a workflow-first artifact that can also be projected into a tool surface. That keeps the core authoring model centered on workflows rather than inventing a second disconnected execution model for tools.

## Infrastructure layer responsibilities

Infrastructure contains the "how" of the system.

### What belongs here
- repositories backed by filesystem, SQLite, browser storage, or bridges
- runtime clients and network adapters
- Python and MCP integration
- execution strategies
- dependency registration and object graphs
- node implementation registries

### Example: repositories
The same application port can be implemented several ways:
- `infrastructure/filesystem/LocalWorkflowRepository.ts`
- `infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`
- `infrastructure/browser/workflows/SqliteBackedWorkflowRepository.ts`

The application sees `IWorkflowRepository`; the host/runtime decides which implementation is active.

### Example: runtime strategies
Execution is split into explicit strategy objects:
- `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`

That is a strong architectural decision because it keeps runtime selection outside the core use case and makes degraded behavior explicit.

## Presentation/host responsibilities

The outer layers are split between the renderer and the desktop host.

### UI (`ui/`)
The UI layer contains:
- React components and routes
- stores for view state and asynchronous orchestration
- UI-facing service wrappers around use cases
- runtime-aware composition helpers

The UI is not purely passive. It owns meaningful orchestration through stores and UI services, but those services usually delegate downward into application-layer use cases.

### Electron (`electron/`)
The Electron host provides:
- desktop bootstrap and runtime discovery
- preload contracts
- durable storage bridge
- workflow persistence bridge
- model file bridge
- service-supervisor lifecycle wiring

This lets the renderer stay mostly web-like while still accessing native/local capabilities through a controlled boundary.

## Boundary examples that are implemented well

### Good boundary: application ports
The `application/ports/interfaces/` directory provides a clear seam between orchestration and implementation. Examples include:
- `IWorkflowRepository`
- `IWorkflowExecutor`
- `IMcpToolCatalog`
- `IContextPackageRepository`
- `IModelInstaller`

These interfaces make the codebase much easier to evolve per host/runtime.

### Good boundary: domain validation vs UI validation
Validation logic lives primarily in domain/application services rather than React components. That keeps workflow correctness rules reusable across UI, tests, and future host surfaces.

### Good boundary: desktop bridge contracts
`electron/shared/DesktopContracts.ts` defines the renderer-visible contract separately from the Electron main process implementation. That is cleaner than scattering IPC string knowledge through the UI.

## Boundary areas that are more pragmatic than pure

### UI services sometimes work directly with domain objects
`ui/services/WorkflowService.ts` and `ui/services/NodeService.ts` contain convenience operations such as renaming workflows, changing node properties, moving nodes, and removing nodes by directly manipulating domain aggregates. This is convenient and not inherently wrong, but it means some application-style behavior is living in the UI layer rather than as dedicated application use cases.

### Two separate composition styles
The system has:
- a reusable dependency container and bootstrap in `infrastructure/composition/`
- a large manual renderer composition function in `ui/composition/createUiDependencies.ts`

That means the architectural boundaries are conceptually clean, but object construction is not fully centralized.

## Practical rule of thumb for contributors

When adding or changing behavior:

- Put **business rules** in `domain/`.
- Put **user/system operations** in `application/`.
- Put **storage/runtime/API adapters** in `infrastructure/`.
- Put **rendering, store orchestration, and route/page behavior** in `ui/`.
- Put **desktop-specific host wiring** in `electron/`.

If a change needs data from the outside world, prefer adding or using an **application port** rather than importing infrastructure directly into a use case.

## Direction 4 boundary note (Phase 1)
- Agent business meaning is now in `domain/agents/` (goals, policies, asset-backed memory configuration, execution sessions with validated lifecycle transitions).
- Application-level mapping to runtime execution lives in `application/agents/contracts/AgentExecutionMapping.ts`, which maps agent steps onto `ExecutionPlan` units and exposes bounded per-unit execution payload contracts.
- No agent runtime adapters or UI pages were added in this phase; infrastructure and UI remain outer-layer concerns for later slices.

- Direction 4 Phase 2 now starts at the inner layers only: planning structures are domain/application contracts (`domain/agents/AgentPlan.ts`, `application/agents/contracts/AgentPlanningStrategy.ts` + `application/agents/services/DeterministicAgentPlanningStrategy.ts`, `application/agents/contracts/AgentPlanningLoop.ts`) and intentionally do not introduce a second runtime, orchestration stack, or UI loop.
- Direction 4 Phase 3 continues inner-layer-first: memory retrieval/write/session behavior is now modeled as domain/application seams (`domain/agents/AgentMemory.ts`, `domain/agents/AgentWorkingMemory.ts`, `application/agents/contracts/AgentMemoryRetrieval.ts`, `application/agents/services/AgentMemoryRetrievalService.ts`, `application/agents/services/AgentMemoryWriteService.ts`, `application/agents/services/AgentWorkingMemoryService.ts`) and remains asset-backed rather than transcript/chat-wrapper-driven.
- The Phase 3 implementation now enforces policy at runtime (retrievable/writable/session-only/retention limits) in those same inner-layer services rather than leaving policy as configuration-only metadata.

- Direction 4 Phase 4 extends those same inner boundaries: canonical MCP tool identity/binding, execution-native MCP invocation units, and deterministic agent-side MCP governance (permission/approval/sandbox/schema checks) now live in domain/application seams and reuse existing MCP registry/trust services.
- Direction 4 Phase 5 keeps runtime coordination in the application layer via `AgentRunnerService`, with deterministic progress/failure/retry/session lifecycle contracts in `application/agents/contracts/*` and persistence exclusively through the `IAgentExecutionSessionRepository` port (implemented by a concrete SQLite repository at the infrastructure edge).
- Direction 4 Phase 5 hardening now keeps partial execution truth inside that same boundary: per-step outcomes are persisted on execution-session records, retry exhaustion is explicit in terminal failure contracts, and transition-history reads are exposed through the same session repository port.
- Direction 4 Phase 6 inner architecture now extends the same split:
  - domain invariants remain in `domain/agents/*`
  - application adds bounded authoring use cases (CRUD + goal/policy/tool/memory/strategy configuration + whole-config validation)
  - CRUD failure semantics are now explicit application contracts (`AgentConflictError`, `AgentNotFoundError`, `AgentInvalidRequestError`) so outer transport adapters map errors by type, not brittle message parsing.
  - goal authoring operations (`add`/`update`/`remove`/`reorder`) now enforce deterministic coherence through `AgentGoalConfiguration` at the use-case/domain boundary (unique ids, canonical required tool refs, contiguous ordering from 1, and explicit missing-goal failures).
  - policy authoring updates are centralized through `AgentPolicyConfiguration` operations (tool-access, approvals/sandbox safety, cost limits, and execution limits), avoiding ad hoc mutation logic across application services.
  - tool authoring updates are now canonical-first through `AgentPolicy.toolAccess` (no parallel tool-config surface), including strict tool-id normalization, MCP binding consistency checks against allowed ids, and scope-constraint integrity checks before persistence.
  - any new agent-facing artifacts/read models must reuse shared composition seams (`CompositionTaxonomyClassifier` classification or `CompositionAssetContractResolver` projection) instead of introducing agent-only presentation semantics.
  - persistence remains outer-layer through `IAgentRepository`/`IAgentExecutionSessionRepository` with concrete SQLite adapters (`SqliteAgentRepository`, `SqliteAgentExecutionSessionRepository`).
  - `SqliteAgentRepository` now opens SQLite through a small compatibility seam (`infrastructure/filesystem/sqlite/SqliteCompat.ts`) so the same repository contract runs with `better-sqlite3` (Node/Electron host) and `bun:sqlite` (Bun test/runtime environments) without changing application/domain ports.
  - `SqliteAgentRepository` now rehydrates persisted JSON snapshots through domain normalization on reads (rather than raw cast-only deserialization), so full aggregate round-trip stays truthy for memory asset refs, goal/policy/tool config, and planning/execution config.
  - malformed persisted agent snapshots now fail fast with explicit field-level errors (for example missing policy/planning/execution objects) instead of yielding partial aggregates.
  - memory authoring contracts are now fully structured/validated at the inner layer (asset-backed refs, retrieval config, writable/retrievable/session-only type coherence, retention/session-only contradictions, canonical asset/id format checks).
  - memory validation now emits explicit structured issue codes for malformed/non-canonical asset refs, duplicate asset refs, malformed asset-version ids, invalid semantic/recency settings, and retention/policy contradictions so API/UI consumers do not rely only on generic fallback errors.
  - canonical agent tool identity parsing/normalization now uses a shared domain seam (`domain/agents/AgentToolIdentity.ts`) across goals, plans, policy normalization, and validation so tool semantics remain centralized in inner layers.
  - planning strategy authoring is now explicitly bounded to supported strategy descriptors (currently deterministic only), with unsupported id/mode combinations rejected before persistence.
  - strategy validation now includes explicit structured issues for missing strategy id and unsupported id/mode combinations.
  - whole-agent validation is now reusable across CRUD/configuration/API seams via `AgentConfigurationValidationService` + structured issue payloads (`code`, `path`, `section`, `severity`, `message`) and a deterministic `AgentConfigurationValidationError`.
  - validation now supports explicit create vs update pathways (`mode: create|update`) with update-time immutable-id validation semantics.
  - policy/sandbox/trust contradiction checks now return explicit issue codes (required-vs-denied permission conflicts, sandbox denial vs required approval conflicts, and tool-scope approval coherence) in the reusable validation output.
  - backend transport now stays thin over those use cases through desktop IPC agent-authoring handlers and DTO mapping (`ai-loom-desktop-agents:*`) instead of transport-layer business logic.
  - configuration use cases now emit typed authoring failures (`AgentNotFoundError` / `AgentInvalidRequestError`) instead of generic message-thrown errors, keeping deterministic contracts at the application boundary.
  - `AgentAuthoringBackendApi` now maps transport errors only from typed authoring/validation contracts; unknown exceptions map to `internal` without substring-based heuristics.
  - API-side read DTOs are now hardened to composition-native semantics (`agent` + taxonomy classification + optional contract projection) so transport does not invent agent-only read-model semantics.
  - focused agent authoring coverage now includes SQLite-backed integration tests across CRUD + goal/policy/tool/memory/strategy updates and API-layer mapping/error-path tests so backend behavior is validated over real seams, not only in-memory repository doubles.
  - Phase 8.2/8.3 renderer wiring now stays an outer-layer shell (`ui/pages/AgentStudioPage.tsx` + `ui/services/AgentStudioService.ts` + panel components) that consumes those IPC/backend contracts directly for list/load/create/launch/session/cancel and configuration updates.
  - authoring UX surfaces (goals/policy/tools/memory/strategy) do not add client-side business validation; backend use cases and validation contracts remain source-of-truth and UI only displays returned errors/issues.
  - agent-facing read artifacts consumed by UI remain composition-native (`agent` + taxonomy classification + optional contract projection) rather than agent-only semantics, preserving `CompositionTaxonomyClassifier` / `CompositionAssetContractResolver` boundaries.

## TODO

- Several convenience mutations still live in UI services instead of dedicated application use cases. If the goal is a stricter clean architecture, those write operations should gradually move inward.
- The codebase would be easier to reason about if the manual renderer composition and the container-based infrastructure composition shared more of the same registration path or abstractions.
- Phase 7 inner contracts now expose authored-agent operations as application use cases (launch/session-read/run-control/trigger-binding) over existing `AgentRunnerService` + `IAgentExecutionSessionRepository` seams; no parallel runtime path was introduced.

## Direction 6 update: Identity domain foundation (story 1.1.1)

- Local identity inner-layer contracts now live in `src/domain/identity/IdentityDomain.ts` and explicitly separate:
  - identity lifecycle (`UserIdentity` + provider-link invariants),
  - credential lifecycle/policy (`CredentialPolicy`, `CredentialState`, password-rule validation),
  - session lifecycle (`Session`, issuance/rotation/revocation/expiry transitions).
- Provider semantics are intentionally provider-oriented (`AuthProvider` categories/kinds for local and external providers), so local-password support is first-class without hard-coding a local-only model that blocks future SSO/OIDC/SAML seams.
- The slice remains domain-pure: no transport, storage, hashing, or host/runtime dependencies were introduced in the identity model.

## Direction 6 update: Identity application ports foundation (story 1.1.2)

- Identity application boundaries are now explicit in `application/identity/ports/`:
  - `IIdentityLookupRepository`,
  - `IIdentityPersistenceRepository`,
  - `ICredentialMaterialRepository`,
  - `IIdentitySessionRepository`.
- Application orchestration dependencies for time and ID generation are now explicit seams (`IIdentityClock`, `IIdentityIdGenerator`) rather than implicit runtime calls.
- Shared identity DTO/query contracts now live in `application/contracts/IdentityApplicationContracts.ts` so registration/login/credential-update/session-issuance use cases can share stable payload shapes without coupling to persistence or framework choices.

## Direction 6 boundary note: Identity persistence adapters in src layer (story 1.1.4)

- Added `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts` as a concrete infrastructure adapter implementing identity repository ports while keeping domain/application identity semantics unchanged.
- Added explicit infrastructure mapping boundaries in `src/infrastructure/persistence/identity/IdentityPersistenceMapper.ts` so raw SQL row shapes do not leak above the infrastructure layer.
- Added `src`-layer SQLite compatibility + migration seams in `src/infrastructure/persistence/sqlite/SqliteCompat.ts` and `src/infrastructure/persistence/identity/SqliteIdentityPersistenceMigrations.ts`.

## Direction 6 boundary note: Identity policy and validation services (story 1.1.5)

- Pure identity validation and normalization policy now lives in `src/domain/identity/IdentityPolicy.ts` (username/email/profile normalization, provider-subject normalization, credential-policy evaluation, and status-transition evaluation) so rule logic is reusable outside transport/UI handlers.
- Application orchestration for identity conflicts now lives in `application/identity/services/IdentityPolicyService.ts`, where repository-backed uniqueness checks are centralized behind `IIdentityLookupRepository` instead of being duplicated across registration/login entry points.
- Structured issue/conflict outputs are now machine-friendly and deterministic (`issues` + ordered `username/email/provider-subject` conflicts), which keeps outer layers thin and transport-agnostic.

## Direction 6 boundary note: Seed-safe admin bootstrap initialization (story 1.1.6)

- First-run admin initialization now lives in a dedicated application service (`application/identity/services/IdentityBootstrapService.ts`) rather than being folded into generic registration logic.
- Bootstrap eligibility is enforced via an explicit application-port seam (`IIdentityLookupRepository.countUserIdentities()`), keeping bootstrap gating policy in application while storage detail remains in infrastructure adapters.
- Provider/policy/user/material bootstrap orchestration stays application-owned and uses existing identity ports (`lookup`, `persistence`, `credential material`, `clock`, `id generation`) without introducing UI or transport coupling.
- Infrastructure adapters (`src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`, `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`) now implement identity counting for deterministic first-run gating.

## Direction 6 boundary note: Identity architecture documentation (story 1.1.8)

- Added `docs/architecture/identity-foundation.md` and `docs/architecture/identity-foundation.ai.md` as the canonical architecture note pair for the identity foundation.
- The note documents concrete boundary ownership for identity domain/application/infrastructure seams and makes the trust split explicit:
  - local identity lifecycle remains in identity domain/application contracts,
  - device/runtime/tool trust remains in separate trust modules and is not embedded in identity entities.
