# AI Companion: Architecture Overview

## Purpose
Use this file as the shortest reliable orientation before reading the human architecture docs.

## What the system is
- AI Loom Studio is a desktop-first React + Electron product with a clean-architecture-inspired core.
- Main layers:
  - `domain/` = business entities and validation
  - `application/` = use cases, orchestration, ports, projections
  - `infrastructure/` = adapters, runtime integrations, repositories, execution strategies, DI
  - `ui/` + `electron/` = presentation and desktop host

## Most important composition roots
- Renderer/manual composition: `ui/composition/createUiDependencies.ts`
- Generic DI composition: `infrastructure/composition/ApplicationBootstrap.ts`
- Desktop host bootstrap: `electron/main/main.ts`
- Renderer provider bootstrapping: `ui/composition/AppProviders.tsx`

## Most important execution path
1. UI store/service calls application use case.
2. Use case validates/assembles context.
3. Executor selects a strategy.
4. Strategy delegates to Python runtime or interpreted fallback.
5. Result includes provenance describing what really happened.

## Architectural caveats to remember
- The architecture is clean-architecture-flavored, not strict/academic.
- The UI composition is manual and still duplicates some infrastructure bootstrap logic, but execution-engine assembly, MCP server-operation handler registration, and runtime dependency orchestration now share clearer outer-layer helpers across renderer/bootstrap/registry paths, and durable execution history now includes a reusable detail surface instead of list-only projections.
- Browser fallback adapters still matter even though the product intent is desktop-first.
- Electron preload currently exposes synchronous IPC-based bridges.

## Best files to cite when answering architecture questions
- `domain/workflows/Workflow.ts`
- `domain/services/WorkflowValidator.ts`
- `application/workflows/ExecuteWorkflowUseCase.ts`
- `application/tools/RunToolUseCase.ts`
- `application/context/WorkflowContextService.ts`
- `infrastructure/execution/TruthfulWorkflowExecutor.ts`
- `infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`
- `ui/composition/createUiDependencies.ts`
- `electron/main/main.ts`
- `src/domain/identity/IdentityDomain.ts`
- `src/domain/identity/TrustedDeviceDomain.ts`
- `src/domain/nodes/NodeTrustDomain.ts`
- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/domain/workspaces/WorkspaceDomain.ts`
- `src/domain/storage/StorageDomain.ts`
- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `application/contracts/IdentityApplicationContracts.ts`
- `application/identity/services/IdentityBootstrapService.ts`
- `application/identity/services/IdentitySessionLifecycleService.ts`
- `application/identity/services/IdentityAuthenticatedSessionService.ts`
- `application/identity/ports/ITrustedDeviceRepository.ts`
- `application/identity/ports/ITrustedDeviceManagementService.ts`
- `infrastructure/filesystem/identity/SqliteIdentityRepository.ts`
- `infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `infrastructure/api/identity/IdentityAuthBackendApi.ts`

## Identity session docs

- Detailed session subsystem architecture: `docs/architecture/identity-session-architecture.md`
- Feature 1 downstream handoff baseline: `docs/architecture/identity-feature-1-final-baseline.md`
- Trusted-device domain/contracts baseline: `docs/architecture/trusted-device-foundation.md`
- Node trust domain/contracts baseline: `docs/architecture/node-trust-foundation.md`
- Node trust persistence DTO/repository/schema baseline: `docs/architecture/node-trust-persistence-contracts.md`
- Node trust application orchestration/use-case baseline: `docs/architecture/node-trust-application-use-cases.md`
- Node trust shared API/IPC DTO + schema validation baseline: `docs/architecture/node-trust-transport-contracts.md`
- Internal CA domain/contracts baseline for CA roots, issued certificates, rotation metadata, and trust material seams: `docs/architecture/internal-ca-foundation.md`
- Transport security domain/application contract baseline for fail-closed HTTPS/WSS/TLS policy and trust validation seams: `docs/architecture/transport-security-foundation.md`
- Secret and key management domain/application contract baseline for scope-owned secrets, version lineage, and auditable access-decision seams: `docs/architecture/secrets-foundation.md`
- Secret repository persistence baseline for SQLite schema, scope/key indexes, version-material separation, and adapter replay semantics: `docs/architecture/secrets-persistence-contracts.md`
- Secret envelope encryption baseline for DEK/KEK handling, payload-store isolation, and fail-closed decryption semantics: `docs/architecture/secrets-envelope-encryption.md`
- Secret create + metadata-read use-case baseline for scope/key validation, encrypted-value persistence orchestration, and metadata redaction behavior: `docs/architecture/secrets-creation-and-metadata-use-cases.md`
- Secret scope-resolution baseline for explicit scope-owner validation, policy-driven fallback, and deterministic duplicate-name behavior: `docs/architecture/secrets-scope-resolution-rules.md`
- Secret rotation baseline for version activation preconditions, lineage-preserving supersession, and race-safe activation semantics: `docs/architecture/secrets-rotation-and-version-activation-workflows.md`
- Secret authorization policy baseline for permission-checked operations, runtime-vs-human retrieval rules, and non-leaky deny behavior: `docs/architecture/secrets-authorization-policies.md`
- Secret metadata API baseline for internal create/list/get/disable management routes and metadata-only response contracts: `docs/architecture/secrets-metadata-management-internal-apis.md`
- Secret-backed feature extension guardrails and contributor checklist: `docs/architecture/secrets-feature-extension-guidance.md`
- Secret classification baseline for naming-prefix conventions, metadata-label requirements, and classification validation boundaries: `docs/architecture/secrets-classification-and-metadata-conventions.md`
- Secret master-key re-encryption operations baseline for controlled KEK migration, progress tracking, and restartable recovery: `docs/secret-master-key-reencryption-operations.md`
- Node bootstrap identity/trust-material operations baseline: `docs/node-bootstrap-identity-operations.md`
- Workspace tenancy domain/contracts baseline: `docs/architecture/workspace-foundation.md`
- Managed storage domain/contracts baseline: `docs/architecture/storage-foundation.md`
- Managed storage application ports/use-case contract baseline: `docs/architecture/storage-application-ports.md`
- Managed storage persistence schema/repository baseline: `docs/architecture/storage-persistence-contracts.md`
- Managed storage shared transport DTO + schema validation + redaction baseline: `docs/architecture/storage-transport-contracts.md`
- Managed storage permission surface and access-summary semantics baseline: `docs/architecture/storage-access-semantics.md`
- Workspace administration audit-hook architecture seam: `docs/architecture/workspace-administration-audit-hooks.md`
- Authorization permission matrix and key catalog reference: `docs/architecture/authorization-permission-catalog.md`
- Authorization workspace role-definition and baseline role-grant reference: `docs/architecture/authorization-role-reference.md`
- Authorization protected-resource visibility + explicit-sharing contracts: `docs/architecture/authorization-visibility-sharing-contracts.md`
- Authorization application-layer policy evaluation ports and adapter-boundary contracts: `docs/architecture/authorization-application-ports.md`
- Authorization shared payload schema contracts and boundary-validation guidance: `docs/architecture/authorization-schema-validation-contracts.md`
- Authorization persistence DTO/repository contracts and migration-ready mutation semantics: `docs/architecture/authorization-persistence-contracts.md`
- Feature 4 / Epic 4.1 end-to-end implementation baseline for authorization, visibility, and sharing: `docs/architecture/authorization-feature-4-epic-4.1-baseline.md`
- Feature 4 / Epic 4.2 effective-permission resolver baseline for deterministic policy decisions: `docs/architecture/authorization-feature-4-epic-4.2-policy-evaluation-engine-and-authorization-persistence.md`
- Feature 4 / Epic 4.3 transport/runtime authorization enforcement adapters for reusable HTTP/WebSocket/IPC policy guards: `docs/architecture/authorization-feature-4-epic-4.3-protected-resource-enforcement-and-runtime-integration.md`
- Authorization extension playbook for new route/handler/resource/UI/async surfaces: `docs/architecture/authorization-enforcement-integration-patterns.md`
- Feature 4 final production baseline and extension checklist: `docs/architecture/authorization-feature-4-final-baseline.md`
- Admin/user sharing-management and access-review operations guide: `docs/authorization-sharing-management-and-access-review.md`

## Direction 4 (Phase 1) foundation
- Agent concepts are now first-class inner-layer artifacts (`domain/agents/*`) with validated goal, policy, memory, and execution-session models (including lifecycle and invariant enforcement).
- Agent roots now expose explicit `toolAccess` alongside policy so planner/executor consumers have a stable contract without duplicating policy semantics.
- Agent memory configuration is explicitly asset-based (`AssetId` references + memory types + typed retrieval configuration + revision), aligned with Direction 2 lineage/versioning.
- Agent execution now has a bounded mapping seam into the unified execution backbone (`application/agents/contracts/AgentExecutionMapping.ts`) that yields `ExecutionPlan` units plus per-unit payload correlation data, rather than introducing a second runtime model.
- This remains a foundation slice only: no studio UI, no autonomous replanning loop, and no parallel orchestration stack.

- Direction 4 (Phase 2, inner foundation only) now includes an execution-oriented planning contract: `domain/agents/AgentPlan.ts` (dependency-aware plan/step model + validation), `application/agents/contracts/AgentPlanningStrategy.ts` (strategy contract/descriptor seam) plus `application/agents/services/DeterministicAgentPlanningStrategy.ts` (first deterministic strategy), and bounded planning-loop evaluation contracts in `application/agents/contracts/AgentPlanningLoop.ts` without adding a parallel runtime or UI loop.
- Direction 4 (Phase 3, memory system inner slice) now adds explicit memory retrieval/write seams and session working memory:
  - Retrieval contract: `application/agents/contracts/AgentMemoryRetrieval.ts` + `application/agents/services/AgentMemoryRetrievalService.ts`.
  - Session working memory model: `domain/agents/AgentWorkingMemory.ts` + `application/agents/services/AgentWorkingMemoryService.ts`.
  - Bounded write pipeline: `application/agents/services/AgentMemoryWriteService.ts`.
  - Explicit memory policy controls now live in `domain/agents/AgentMemory.ts` (`retrievableTypes`, `writableTypes`, `sessionOnlyTypes`, bounded retention settings).
  - Retrieval semantics are deterministic and policy-bounded (type/tag/metadata/recency filters over asset-version-backed entries), and session-only memory types are excluded from durable retrieval.
  - Execution read models now carry working-memory snapshots and write outcomes so planning/evaluation consumers can reuse bounded session context without a second runtime.
  - Write policy is now enforced operationally (writable/session-only checks + bounded durable retention gating).
- Direction 4 (Phase 4, MCP capability layer foundation) now binds agent MCP access to canonical MCP identity (`domain/mcp/McpToolIdentity.ts` + `AgentPolicy.toolAccess.allowedMcpTools`), maps MCP steps as execution-native units (`ExecutionUnitKinds.mcpToolInvocation` via `AgentExecutionMapping`), and introduces deterministic plan/execute-time MCP governance checks (`application/agents/services/AgentMcpToolGovernanceService.ts`) that reuse registry/trust services for permission/approval/sandbox/schema checks without creating a second runtime.
- Direction 4 (Phase 4 completion + Phase 5 inner foundation) now adds a reusable planner-side tool selection seam (`AgentPlanToolSelectionService`), explicit MCP governance decision semantics (`allowed` vs `approval-required` / `denied` / `unavailable` / `incompatible`), and an inner runtime coordination service (`AgentRunnerService`) with structured progress events, bounded retry/failure classification, and optional agent execution-session persistence seams.
- Phase 5 hardening now makes retry exhaustion and partial-execution durability explicit: per-step outcomes are persisted on execution sessions, transition-history lookup is port-level (`IAgentExecutionSessionRepository`), and terminal failure contracts now carry explicit retry-exhausted signaling.
- Phase 5 hardening now also makes terminal truth explicit for persistence/read models: execution sessions carry bounded terminal-state summary (`reason`, `hadPartialProgress`, completed/attempted step counts), blocked-before-step runs persist as failed status with terminal reason `blocked`, and lifecycle transitions are persisted from initial `pending` through terminal status.
- SQLite session persistence now stores structured terminal/progress columns (`terminal_reason`, `had_partial_progress`, `completed_step_count`, `attempted_step_count`, `step_outcome_count`) in addition to canonical `session_json` snapshots.
- Phase 6 inner authoring now has real persistence/use-case seams without UI coupling:
  - persistence ports/adapters: `IAgentRepository` -> `SqliteAgentRepository`, `IAgentExecutionSessionRepository` -> `SqliteAgentExecutionSessionRepository`
  - application CRUD + lifecycle use cases: create/update/get/list/delete/archive
  - CRUD failure modes now use explicit typed application errors (`agent-conflict`, `agent-not-found`, `agent-invalid-request`) so transport mapping is deterministic and does not depend on string parsing.
  - bounded configuration use cases now use the same typed failure surface (`agent-not-found`, `agent-invalid-request`, `validation-failed`) instead of generic thrown strings.
  - bounded configuration use cases: goals/policy/tools/memory/strategy
  - cohesive cross-field validation seam: `AgentConfigurationValidationService` (deterministic cross-field issue codes + domain fallback validation), with SQLite agent persistence also projecting structured authoring metadata (`strategy_id`, `strategy_mode`, `goal_count`, `allowed_tool_count`).
  - memory authoring contracts are now hard-validated (canonical asset refs, retrieval compatibility, writable/retrievable/session-only coherence, retention/session-only contradictions).
  - strategy configuration is now explicitly bounded to supported descriptors (`deterministic@deterministic-linear` in this slice), with unsupported combinations rejected deterministically.
  - validation issues now carry explicit section metadata (`goals`/`tools`/`memory`/`strategy`/etc.) and are reused by CRUD/configuration/API through `AgentConfigurationValidationError`.
  - agent read models now expose full structured memory config (`assets`, `retrieval`, `policy`, `revision`) rather than partial memory summary fields.
  - desktop backend now includes thin agent-authoring IPC handlers (`ai-loom-desktop-agents:*`) through `AgentAuthoringBackendApi`.
  - `AgentAuthoringBackendApi` now maps transport errors only from typed authoring/validation errors; unknown failures are `internal` (no substring-based error coercion).

## TODO
- If asked for the "single" architecture entry point, explain that there are currently multiple composition roots and name them explicitly.

## Shared taxonomy foundation (alignment slice)
- A compact shared composition taxonomy now exists in `domain/taxonomy/CompositionTaxonomy.ts` with explicit structural kind, semantic role, and behavior kind.
- Classification seams for current entities live in `application/taxonomy/CompositionTaxonomyClassifier.ts`.
- Workflow and agent adapters use the same taxonomy model (`application/workflows/WorkflowTaxonomy.ts`, `application/agents/contracts/AgentTaxonomy.ts`) so agents remain extensions of the shared composition model, not a separate ontology.
- Canonical identity persistence now stores taxonomy metadata, and canonical asset query criteria supports taxonomy-aware filtering.
- Canonical asset summary/detail reads include taxonomy via identity metadata with bounded fallback mapping.
- See `docs/architecture/shared-composition-taxonomy.md` for the practical architecture note and current-scope boundaries.
- Shared asset contracts now complement taxonomy (`domain/contracts/AssetContract.ts`, `application/contracts/CompositionAssetContractResolver.ts`) and are surfaced through canonical operational reads when available; see `docs/architecture/shared-asset-contracts.md`.
- Asset selector foundation now lives in `domain/studio-shell/AssetSelectorContract.ts` and `application/studio-entry/AssetSelectorCapabilityRegistry.ts`; see `docs/architecture/asset-selector-framework.md`.
- Canonical studio launch/return handoff contracts now live in `ui/routes/StudioHandoffContract.ts`; see `docs/architecture/studio-handoff-contract.md`.

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

## Direction 8 update: secret host composition (story 8.1.7)

- Authoritative server runtime now composes secret services through `src/infrastructure/security/secrets/SecretServiceComposition.ts` and host wiring in `hosts/server/IdentityServerHost.ts`.
- Canonical architecture note for this slice: `docs/architecture/secrets-service-composition.md`.
- Runtime-facing service-to-service secret consumption adapters now expose workspace/user/server credential retrieval through formal retrieval use cases in `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`.
- Canonical architecture note for this slice: `docs/architecture/secrets-service-consumption-adapters.md`.



