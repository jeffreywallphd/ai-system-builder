# Architecture Overview

AI Loom Studio is organized around a clean-architecture-style core for desktop-first tooling. The codebase separates **business meaning**, **application orchestration**, **host/runtime adapters**, and **UI delivery** so that workflows, tools, context packages, model management, and managed runtimes can evolve without forcing all concerns into the renderer or the Electron host.

This documentation describes the architecture **as implemented today**, not as an idealized target. Where the implementation appears to drift from the product's core intentions, each document includes a **TODO** section so the current state is transparent.

## Canonical architecture root

`src/` is the canonical root for actively maintained clean-architecture host/control-plane composition and migrated infrastructure slices. New architecture work should be documented and implemented under `src/` (for example: `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ui/`, `src/shared/`, and `src/hosts/`), not root-level legacy mirrors.

## Import aliases

Use path aliases for cross-layer imports and examples in architecture docs:

- `@application/*` -> `src/application/*`
- `@domain/*` -> `src/domain/*`
- `@infrastructure/*` -> `src/infrastructure/*`
- `@ui/*` -> `src/ui/*`
- `@shared/*` -> `src/shared/*`
- `@hosts/*` -> `src/hosts/*`
- `@src/*` -> `src/*`

## Core architectural intent

At a high level, the system aims to provide:

- A stable **domain core** for workflows, nodes, models, assets, context packages, tools, managed services, and tuning datasets.
- An **application layer** that exposes explicit use cases and service orchestration over domain models and ports.
- An **infrastructure layer** that binds those ports to concrete implementations such as filesystem storage, browser storage, Electron bridges, Python runtime clients, MCP runtime adapters, and execution engines.
- A **presentation/host layer** that delivers the product through a React renderer and an Electron desktop shell.
- A runtime model that can truthfully distinguish between **delegated execution** and **fallback/interpreted execution**, rather than pretending every run used the same engine.

## The main architectural layers

### 1. Domain
The `src/domain/` tree contains the business model and validation logic. It defines the language of the product: workflows, nodes, connections, model compatibility, workflow validation, managed services metadata, tuning-dataset entities, and more. The domain is intentionally free of Electron, browser, and storage details.

Representative files:
- `src/domain/workflows/Workflow.ts`
- `src/domain/services/WorkflowValidator.ts`
- `src/domain/services/NodeCompatibilityService.ts`
- `src/domain/models/Model.ts`
- `src/domain/tuning-datasets/TuningDatasetEntities.ts`

### 2. Application
The `src/application/` tree defines use cases, application services, DTOs, projection services, and ports/interfaces. This is the layer that answers questions like:
- "How do we execute a workflow?"
- "How do we run a published workflow as a tool?"
- "How do we preview workflow context?"
- "How do we install or search models?"

It depends inward on the domain and outward only through interfaces/ports.

Representative files:
- `src/application/workflows/ExecuteWorkflowUseCase.ts`
- `src/application/tools/RunToolUseCase.ts`
- `src/application/context/WorkflowContextService.ts`
- `src/application/ports/interfaces/*`
- `src/application/projection/*`

### 3. Infrastructure
The `src/infrastructure/` tree implements the concrete adapters that make the application layer usable in real environments. This includes:
- filesystem repositories
- browser-storage repositories
- desktop bridge repositories
- Python runtime adapters
- MCP integration
- execution strategies
- dependency registration/composition

Representative files:
- `src/infrastructure/composition/ApplicationBootstrap.ts`
- `src/infrastructure/composition/InfrastructureRegistry.ts`
- `src/infrastructure/filesystem/LocalWorkflowRepository.ts`
- `src/infrastructure/browser/workflows/DesktopBridgeWorkflowRepository.ts`
- `src/infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `src/infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`

### 4. Presentation and hosts
The system has two delivery surfaces working together:

- **React renderer (`src/ui/`)**: pages, stores, UI services, composition helpers, and components.
- **Electron desktop host (`electron/`)**: main-process startup, preload bridge, local storage/bootstrap services, and desktop-only capabilities.

The host decides what capabilities exist; the UI composes the dependencies it needs for the current runtime mode.

Representative files:
- `src/ui/composition/createUiDependencies.ts`
- `src/ui/composition/AppProviders.tsx`
- `src/ui/routes/AppRouter.tsx`
- `electron/main/main.ts`
- `electron/preload.ts`
- `electron/src/shared/DesktopContracts.ts`

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
- For canonical run identity/lifecycle/queue-assignment semantics and orchestration ownership boundaries, read [`run-orchestration-domain-foundation.md`](./run-orchestration-domain-foundation.md).
- For shared run submission/mutation/status transport contracts, queue-read contracts, and lifecycle-update event envelopes, read [`run-orchestration-transport-contracts.md`](./run-orchestration-transport-contracts.md).
- For persistent queue admission, durable assignment-ready ordering, and reservation-backed claim semantics used by authoritative dispatch selection, read [`run-orchestration-queue-assignment-selection.md`](./run-orchestration-queue-assignment-selection.md).
- For authoritative node capability matching, run assignment requirement derivation, and assignment precondition evaluation boundaries, read [`run-orchestration-node-capability-matching.md`](./run-orchestration-node-capability-matching.md).
- For canonical scheduling policy inputs, role-priority and hybrid-local-use protections, explainable decision outcomes, and the scheduling-vs-dispatch boundary, read [`run-orchestration-scheduling-policy-domain-model.md`](./run-orchestration-scheduling-policy-domain-model.md).
- For shared scheduling snapshot/result contracts, candidate reasoning summaries, and schema-backed policy-evaluation payload validation, read [`run-orchestration-scheduling-policy-shared-contracts.md`](./run-orchestration-scheduling-policy-shared-contracts.md).
- For ordered scheduling rule-pipeline evaluation, modular baseline production policy rules, and authoritative scheduling decision-bundle selection behavior, read [`run-orchestration-scheduling-policy-framework-and-rule-pipeline.md`](./run-orchestration-scheduling-policy-framework-and-rule-pipeline.md).
- For first-release role-priority scheduling arbitration behavior, deterministic tie-break semantics, and explicit arbitration visibility outputs, read [`run-orchestration-scheduling-role-priority-first-release.md`](./run-orchestration-scheduling-role-priority-first-release.md).
- For hybrid-node local interactive protection signals, authoritative policy gating behavior, and documented telemetry/limitation posture, read [`run-orchestration-scheduling-hybrid-node-local-interactive-protection.md`](./run-orchestration-scheduling-hybrid-node-local-interactive-protection.md).
- For required-capability eligibility enforcement and basic affinity-aware candidate preference handling before arbitration, read [`run-orchestration-scheduling-required-capability-affinity-eligibility.md`](./run-orchestration-scheduling-required-capability-affinity-eligibility.md).
- For explainable scheduling decision capture, structured defer/exclusion/selection reason summaries, and application-layer outcome-recording seams, read [`run-orchestration-scheduling-decision-reason-capture.md`](./run-orchestration-scheduling-decision-reason-capture.md).
- For scheduling governance visibility hooks covering priority placement decisions, defer/no-placement outcomes, reservation conflicts, and sanitized audit/operational event emission boundaries, read [`run-orchestration-scheduling-audit-operational-hooks.md`](./run-orchestration-scheduling-audit-operational-hooks.md).
- For the consolidated scheduling architecture baseline, current production rule limits, scheduling-vs-dispatch separation, and future policy extension workflow (quotas/reservations/affinity/deployment-profile/resource arbitration), read [`run-orchestration-scheduling-architecture-extension-guidance.md`](./run-orchestration-scheduling-architecture-extension-guidance.md).
- For scheduler-authoritative queue lease selection, policy-evaluated assignment materialization, explicit no-placement outcomes, reservation/hold release invariants, and dispatch-outcome settlement seams, read [`run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`](./run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md).
- For scheduler reservation-aware node arbitration and temporary placement hold lifecycle semantics (acquire/conflict/expiry/release) during assignment materialization, read [`run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md`](./run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md).
- For deterministic scheduler tie-break behavior, centralized candidate arbitration ordering, and explainable equal-candidate selection metadata, read [`run-orchestration-scheduling-deterministic-candidate-arbitration.md`](./run-orchestration-scheduling-deterministic-candidate-arbitration.md).
- For authoritative defer/backoff/no-placement handling of unschedulable queued runs, structured reason capture, and repeated-evaluation anti-thrash behavior, read [`run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md`](./run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md).
- For scheduler node-availability/eligibility refresh handling, heartbeat freshness enforcement, and stale/unavailable/revoked-node denial semantics in queue evaluation, read [`run-orchestration-scheduling-node-availability-and-eligibility-refresh.md`](./run-orchestration-scheduling-node-availability-and-eligibility-refresh.md).
- For scheduling-aware dispatch outcome reservation release/requeue policy integration after accepted and failed-start dispatch attempts, read [`run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md`](./run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md).
- For authoritative queued-run node claim handling, durable dispatch-preparation attempt records, and controlled duplicate-claim conflict semantics, read [`run-orchestration-node-claim-dispatch-preparation.md`](./run-orchestration-node-claim-dispatch-preparation.md).
- For the consolidated queue -> assignment -> claim -> dispatch -> progress-ingestion -> finalization control-plane architecture and scheduler integration boundaries, read [`run-orchestration-queue-assignment-dispatch-control-plane.md`](./run-orchestration-queue-assignment-dispatch-control-plane.md).
- For authoritative run cancellation workflows, lifecycle-position state-matrix behavior, queue-aware claim coordination, and backend signaling seams, read [`run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md`](./run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md).
- For authoritative run retry/rerun eligibility policy, immutable source-run lineage rules, and canonical resubmission workflow boundaries, read [`run-orchestration-authoritative-retry-rerun-workflow-and-lineage.md`](./run-orchestration-authoritative-retry-rerun-workflow-and-lineage.md).
- For startup-time orchestration recovery/reconciliation behavior covering stale claims, interrupted dispatch progression, stale assignment/running timeout handling, and manual-follow-up boundaries, read [`run-orchestration-startup-recovery-reconciliation.md`](./run-orchestration-startup-recovery-reconciliation.md).
- For operational run/queue read-model projections (queue position, action eligibility, authoritative timeline/history, user-safe failure summaries, and admin-gated diagnostics), read [`run-orchestration-operational-visibility-projections.md`](./run-orchestration-operational-visibility-projections.md).
- For authoritative run/queue realtime event publication categories, payload boundaries, and control-plane emission seams, read [`run-orchestration-realtime-event-publication.md`](./run-orchestration-realtime-event-publication.md).
- For run submission governance audit hooks covering denied/accepted submissions and initial lifecycle transition emission, read [`run-submission-lifecycle-audit-hooks.md`](./run-submission-lifecycle-audit-hooks.md).
- For end-to-end authoritative submission flow, extension seams for future backends/policies/scheduling work, and prohibited architecture shortcuts, read [`run-submission-pipeline-extension-guardrails.md`](./run-submission-pipeline-extension-guardrails.md).
- For contributor workflow when extending run submission behavior across contracts/use-cases/adapters/tests, read [`../run-submission-contributor-guide.md`](../run-submission-contributor-guide.md).
- For contributor workflow when extending scheduler policy, queue-reservation/arbitration integration, dispatch adapters, progress ingestion, and finalization behavior, read [`../run-orchestration-contributor-guide.md`](../run-orchestration-contributor-guide.md).
- For host/runtime composition and desktop delivery, read [`desktop-runtime-and-hosts.md`](./desktop-runtime-and-hosts.md).
- For explicit host runtime kinds, authoritative control-plane role contracts, and composition-root boundary expectations, read [`host-runtime-composition-boundaries.md`](./host-runtime-composition-boundaries.md).
- For shared host startup pipeline contracts, startup-context model, and contributor startup-sequence guidance, read [`host-bootstrap-pipeline.md`](./host-bootstrap-pipeline.md).
- For host-safe service registration rules, host-aware dependency composition, and authoritative control-plane service coverage requirements, read [`host-service-registration-composition-rules.md`](./host-service-registration-composition-rules.md).
- For the executable authoritative server host assembly, startup entrypoint, and startup lifecycle expectations, read [`authoritative-server-host-assembly.md`](./authoritative-server-host-assembly.md).
- For shared SQLite persistence bootstrap/runtime configuration, lifecycle cleanup behavior, and migration-hook coordination in authoritative startup, read [`persistence-bootstrap-and-lifecycle.md`](./persistence-bootstrap-and-lifecycle.md).
- For the executable desktop host assembly, startup entrypoint, and desktop-specific composition/lifecycle boundaries, read [`desktop-host-assembly.md`](./desktop-host-assembly.md).
- For the executable hybrid host assembly, capability-composition rules, and authoritative delegation mode, read [`hybrid-host-assembly.md`](./hybrid-host-assembly.md).
- For the executable web host assembly, thin-client delivery composition boundaries, and startup entrypoint expectations, read [`web-host-assembly.md`](./web-host-assembly.md).
- For the executable worker host assembly, runtime execution composition boundaries, and startup entrypoint expectations, read [`worker-host-assembly.md`](./worker-host-assembly.md).
- For Story 12.4.1 runtime-entrypoint migration notes that move active startup paths onto host assemblies, read [`entrypoint-host-composition-migration-12.4.1.md`](./entrypoint-host-composition-migration-12.4.1.md).
- For Story 12.4.2 development/test startup migration notes covering local scripts and harness startup through host assemblies, read [`development-host-startup-model-12.4.2.md`](./development-host-startup-model-12.4.2.md).
- For Story 12.4.3 host extension guardrails (architecture validation tests plus contributor host/layer decision guidance), read [`host-composition-extension-guardrails-12.4.3.md`](./host-composition-extension-guardrails-12.4.3.md).
- For UI composition and state flow, read [`presentation-and-state.md`](./presentation-and-state.md).
- For canonical multi-surface UI layering, page-shell boundaries, and shared-vs-host placement rules across desktop/thin-client/mobile-responsive surfaces, read [`multi-surface-ui-composition-foundation.md`](./multi-surface-ui-composition-foundation.md).
- For contributor extension workflow and prohibited-pattern guardrails when adding new admin/operational screens across converged surfaces, read [`multi-surface-ui-extension-guidance.md`](./multi-surface-ui-extension-guidance.md).
- For canonical responsive breakpoint/density/touch-target/stacking conventions across desktop and thin-client surfaces, read [`multi-surface-ui-responsive-conventions.md`](./multi-surface-ui-responsive-conventions.md).
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
- For transport security src/domain/application contracts, fail-closed channel policy semantics, and host adapter integration guidance, read [`transport-security-foundation.md`](./transport-security-foundation.md).
- For secret and key management src/domain/application contracts, scope ownership invariants, and auditable access-decision seams, read [`secrets-foundation.md`](./secrets-foundation.md).
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
- For encryption-at-rest domain policy vocabulary, inheritance/override invariants, and encrypted-material reference contracts, read [`encryption-at-rest-policy-foundation.md`](./encryption-at-rest-policy-foundation.md).
- For shared encryption-at-rest DTO/schema/contract boundaries across workspace/storage policy exchange and encrypted-material descriptor validation, read [`encryption-at-rest-policy-shared-contracts.md`](./encryption-at-rest-policy-shared-contracts.md).
- For application-layer encryption policy evaluation seams covering effective-policy resolution and reusable content/preview/worker decision contracts, read [`encryption-at-rest-policy-application-evaluation-ports.md`](./encryption-at-rest-policy-application-evaluation-ports.md).
- For policy-scoped key resolution seams and deterministic server/workspace/storage key-orchestration behavior, read [`encryption-at-rest-key-resolution-and-scope-orchestration.md`](./encryption-at-rest-key-resolution-and-scope-orchestration.md).
- For protected-value encryption/decryption primitive ports, versioned payload descriptor contracts, and infrastructure AES-GCM adapter behavior, read [`encryption-at-rest-protected-value-encryption-ports.md`](./encryption-at-rest-protected-value-encryption-ports.md).
- For master-key change re-encryption workflow behavior, restartable operation tracking, and failure recovery posture, read [`../secret-master-key-reencryption-operations.md`](../secret-master-key-reencryption-operations.md).
- For node-local bootstrap identity/trust-material operations and enrollment payload bootstrap metadata, read [`../node-bootstrap-identity-operations.md`](../node-bootstrap-identity-operations.md).
- For workspace tenancy domain aggregates, membership/role/invitation invariants, and reusable ownership metadata patterns, read [`workspace-foundation.md`](./workspace-foundation.md).
- For managed storage domain entities, lifecycle/access/replication/policy invariants, and audit attribution contracts, read [`storage-foundation.md`](./storage-foundation.md).
- For protected logical asset domain entities, ownership/visibility/versioning invariants, and path-safe storage reference semantics, read [`logical-asset-domain-foundation.md`](./logical-asset-domain-foundation.md).
- For protected logical asset application ports, use-case request/result contracts, and shared transport/event DTO boundaries, read [`logical-asset-application-ports.md`](./logical-asset-application-ports.md).
- For managed storage application ports, lifecycle/policy/provisioning seams, and use-case command/query contracts, read [`storage-application-ports.md`](./storage-application-ports.md).
- For logical storage-reference access planning, authorization mapping, and backend adapter resolution boundaries, read [`storage-logical-access-resolution.md`](./storage-logical-access-resolution.md).
- For managed storage persistence schema, mapper/repository behavior, and migration semantics, read [`storage-persistence-contracts.md`](./storage-persistence-contracts.md).
- For local server-managed storage backend provisioning/capability adapter behavior and operational assumptions, read [`storage-local-backend-adapter.md`](./storage-local-backend-adapter.md).
- For shared mounted/network storage backend binding/validation behavior and target capability contracts, read [`storage-shared-backend-adapter.md`](./storage-shared-backend-adapter.md).
- For synchronized storage eligibility/state seam behavior, deployment-availability posture, and replication sync metadata projection, read [`storage-sync-backend-adapter.md`](./storage-sync-backend-adapter.md).
- For centralized backend selection, create-storage provisioning orchestration, and failed-state persistence behavior, read [`storage-provisioning-orchestration.md`](./storage-provisioning-orchestration.md).
- For shared storage transport DTOs, schema validation contracts, and sensitive redaction projection rules, read [`storage-transport-contracts.md`](./storage-transport-contracts.md).
- For storage permission surfaces, action-level access summaries, and policy-restricted capability semantics, read [`storage-access-semantics.md`](./storage-access-semantics.md).
- For storage backend extension rules, host-composition operational assumptions, and contributor regression expectations, read [`storage-feature-extension-guidance.md`](./storage-feature-extension-guidance.md).
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
- For cross-domain authoritative aggregate boundaries, write-vs-read persistence model ownership, and repository target baseline for Feature 13 foundation work, read [`persistent-platform-domain-boundaries.md`](./persistent-platform-domain-boundaries.md).
- For contributor extension rules and integration regression expectations for persistent platform services, read [`persistent-platform-service-extension-guidance.md`](./persistent-platform-service-extension-guidance.md).
- For Feature 1 completion baseline and downstream dependency notes (trusted device, workspace membership, authorization), read [`identity-feature-1-final-baseline.md`](./identity-feature-1-final-baseline.md).
- For Feature 14 / Epic 14.1 Story 14.1.1 client-surface inventory, migration calls, and shared contract-home convergence mapping across desktop/thin-client/API surfaces, read [`unified-api-convergence-plan.md`](./unified-api-convergence-plan.md).
- For Feature 14 / Epic 14.1 Story 14.1.8 authoritative API surface rules, prohibited pattern guardrails, extension workflow, and migration rules for remaining non-converged pathways, read [`unified-api-authoritative-surface.md`](./unified-api-authoritative-surface.md).
- For Feature 14 / Epic 14.2 Story 14.2.8 endpoint-level route-family mapping, shared contract traceability, auth expectations, and realtime topic model, read [`unified-api-endpoint-reference.md`](./unified-api-endpoint-reference.md).
- For contributor workflow on where to add shared contracts, schemas, transport adapters, and client integrations for converged API work, read [`../unified-api-contributor-guide.md`](../unified-api-contributor-guide.md).

## Direction 4 (Phase 1) foundation
- Agent concepts are now first-class inner-layer artifacts (`src/domain/agents/*`) with validated goal, policy, memory, and execution-session models (including lifecycle and invariant enforcement).
- Agent roots now expose explicit `toolAccess` alongside policy so planner/executor consumers use a stable contract without reinterpreting nested policy structure.
- Agent memory configuration is explicitly asset-based (`AssetId` references + memory types + typed retrieval configuration + revision), aligned with Direction 2 lineage/versioning.
- Agent execution now has a bounded mapping seam into the unified execution backbone (`src/application/agents/contracts/AgentExecutionMapping.ts`) that yields `ExecutionPlan` units plus per-unit payload correlation data, rather than introducing a second runtime model.
- This remains a foundation slice only: no studio UI, no autonomous replanning loop, and no parallel orchestration stack.

- Direction 4 (Phase 2 inner-foundation slice) now includes an execution-oriented agent planning contract: validated dependency-aware plan/step models in `src/domain/agents/AgentPlan.ts`, planning strategy contracts in `src/application/agents/contracts/AgentPlanningStrategy.ts` + `src/application/agents/services/DeterministicAgentPlanningStrategy.ts`, and bounded evaluation/replan signal contracts in `src/application/agents/contracts/AgentPlanningLoop.ts`.
- Agent/execution bridging remains unified-engine-native via `src/application/agents/contracts/AgentExecutionMapping.ts`, including direct mapping from `AgentPlan` into `ExecutionPlan` units plus per-unit payload metadata (asset inputs and step-output references).
- Direction 4 (Phase 3 inner slice) adds asset-driven memory seams for agents without introducing a second runtime:
  - typed memory retrieval seam (`src/application/agents/contracts/AgentMemoryRetrieval.ts`, `src/application/agents/services/AgentMemoryRetrievalService.ts`);
  - bounded session working-memory model (`src/domain/agents/AgentWorkingMemory.ts`, `src/application/agents/services/AgentWorkingMemoryService.ts`);
  - bounded memory write pipeline (`src/application/agents/services/AgentMemoryWriteService.ts`);
  - explicit memory policy controls on agent memory config (`src/domain/agents/AgentMemory.ts`) for retrieval/write/retention behavior.
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

- A compact taxonomy descriptor now exists in `src/domain/taxonomy/CompositionTaxonomy.ts` with explicit `structuralKind`, `semanticRole`, and `behaviorKind`.
- Classification seams for existing concepts live in `src/application/taxonomy/CompositionTaxonomyClassifier.ts`.
- Workflow and agent adapter seams (`src/application/workflows/WorkflowTaxonomy.ts`, `src/application/agents/contracts/AgentTaxonomy.ts`) explicitly align with the same composition model.
- Canonical identities now persist taxonomy metadata and canonical asset query criteria supports taxonomy-aware filters (`structuralKinds`, `semanticRoles`, `behaviorKinds`).
- Canonical asset summary/detail read use cases include taxonomy descriptors through identity metadata with bounded fallback mapping.
- See `shared-composition-taxonomy.md` for scope, boundaries, and current-state mapping details.
- Shared asset contracts now complement taxonomy through a compact inner-layer model (`src/domain/contracts/AssetContract.ts`) and adapter seam (`src/application/contracts/CompositionAssetContractResolver.ts`), with canonical operational reads surfacing both where available; see `shared-asset-contracts.md`.

## TODO

- The repository still contains **two composition stories**: the generic DI bootstrap in `src/infrastructure/composition/` and the renderer-specific manual composition in `src/ui/composition/createUiDependencies.ts`. Execution-engine wiring, execution-run persistence, MCP server-operation handler registration, and execution-history/detail projection services now share more of the same outer-layer path across those roots, but broader composition convergence is still future work.
- The product intent appears desktop-first, yet a meaningful amount of durability and orchestration still routes through browser-style adapters. That is practical, but the desired "source of truth" between desktop-native persistence and browser fallback should be documented in product terms more explicitly.

## Direction 5 update: Exchange (Epic 10) status snapshot

- Exchange now has a first-class local-first publish/package/import stack across `src/domain/exchange/*`, `src/application/exchange/*`, and `src/infrastructure/api/exchange/*`.
- Implemented now: bundle + manifest + dependency snapshot modeling, format compatibility/versioning, validation + deterministic serialization/deserialization, atomic/composite/system export/import services, exchange access control, publishable package lifecycle, local catalog abstraction, publish workflow, and public exchange SDK DTO mappings.
- End-to-end coherence coverage is now present for export -> validate/deserialize -> publish/catalog -> import (including provenance/lineage, access-denial, and conflict outcomes) in `src/application/exchange/tests/ExchangeEndToEndLifecycle.integration.test.ts`.
- Boundary clarity is explicit: exchange artifacts remain distinct from runtime execution state, deployment execution state, and studio-handoff artifacts.
- Future-oriented but not implemented in this slice: distributed/LAN repository sharing and distributed packaging/execution behaviors; current abstractions keep that path open without claiming support today.

## AI Loom image manipulation update: template completeness + wiring/storage contract validation (stories 10.1-10.4)

- Added a dedicated completeness validation seam in `src/application/system-studio/ImageManipulationSystemCompletenessValidationService.ts` that emits structured category/code/severity/path/metadata issues and an `AssetValidationResult` projection.
- Validation now covers system asset presence, page wiring references, workflow template references, property schema defaults, runtime metadata, dataset bindings, storage-instance logical binding references, and execution-adapter references.
- Added focused end-to-end page/workflow/runtime wiring checks (story 10.3) for execution action binding, schema-field to mapping alignment, workflow override mapping coverage, output-target dataset/storage alignment, and preview/gallery contract compatibility.
- Added shared-storage compatibility checks (story 10.4) for logical storage references, cross-system shared-storage provisioning compatibility, and rejection of system-owned/raw-path storage assumptions in template/workflow contracts.
- Runnable-default checks now enforce execution-critical defaults (workflow parameter defaults and property-schema defaults), ensure required dataset provisioning bindings are included by default, and reject raw filesystem path dependencies in logical dataset/storage contracts.
- Build-template bootstrap now enforces runnable-default completeness in `src/application/system-studio/SystemBuildTemplateCatalog.ts` and stores an inspectable completeness result on each catalog entry.

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
  - `src/application/system-studio/tests/ImageManipulationRunnableTemplateContract.regression.test.ts`,
  - existing completeness/readiness/smoke/failure-path suites under `src/application/system-studio/tests/*` and `src/infrastructure/api/studio-shell/tests/*`.


