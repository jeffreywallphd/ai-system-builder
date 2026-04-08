# AI Companion: Architecture Overview

## Purpose
Use this file as the shortest reliable orientation before reading the human architecture docs.

## What the system is
- AI Loom Studio is a desktop-first React + Electron product with a clean-architecture-inspired core.
- Main layers:
  - `src/domain/` = business entities and validation
  - `src/application/` = use cases, orchestration, ports, projections
  - `src/infrastructure/` = adapters, runtime integrations, repositories, execution strategies, DI
  - `src/ui/` + `electron/` = presentation and desktop host

## Source root and aliases
- `src/` is the canonical architecture root; document and implement new core-layer work under `src/` paths.
- Use aliases for cross-layer imports/examples:
  - `@application/*` -> `src/application/*`
  - `@domain/*` -> `src/domain/*`
  - `@infrastructure/*` -> `src/infrastructure/*`
  - `@ui/*` -> `src/ui/*`
  - `@shared/*` -> `src/shared/*`
  - `@hosts/*` -> `src/hosts/*`
  - `@src/*` -> `src/*`

## Most important composition roots
- Renderer/manual composition: `src/ui/composition/createUiDependencies.ts`
- Generic DI composition: `src/infrastructure/composition/ApplicationBootstrap.ts`
- Desktop host bootstrap: `electron/main/main.ts`
- Renderer provider bootstrapping: `src/ui/composition/AppProviders.tsx`

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
- `src/domain/workflows/Workflow.ts`
- `src/domain/services/WorkflowValidator.ts`
- `src/application/workflows/ExecuteWorkflowUseCase.ts`
- `src/application/tools/RunToolUseCase.ts`
- `src/application/context/WorkflowContextService.ts`
- `src/infrastructure/execution/TruthfulWorkflowExecutor.ts`
- `src/infrastructure/python/execution/PythonDelegatedWorkflowExecutionStrategy.ts`
- `src/infrastructure/interpreted/execution/InterpretedWorkflowExecutionStrategy.ts`
- `src/ui/composition/createUiDependencies.ts`
- `electron/main/main.ts`
- `src/domain/identity/IdentityDomain.ts`
- `src/domain/identity/TrustedDeviceDomain.ts`
- `src/domain/nodes/NodeTrustDomain.ts`
- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/domain/workspaces/WorkspaceDomain.ts`
- `src/domain/storage/StorageDomain.ts`
- `src/domain/authorization/AuthorizationDomain.ts`
- `src/domain/authorization/AuthorizationPermissionCatalog.ts`
- `src/application/contracts/IdentityApplicationContracts.ts`
- `src/application/identity/services/IdentityBootstrapService.ts`
- `src/application/identity/services/IdentitySessionLifecycleService.ts`
- `src/application/identity/services/IdentityAuthenticatedSessionService.ts`
- `src/application/identity/ports/ITrustedDeviceRepository.ts`
- `src/application/identity/ports/ITrustedDeviceManagementService.ts`
- `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts`
- `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`
- `src/infrastructure/api/identity/IdentityAuthBackendApi.ts`

## Identity session docs

- Detailed session subsystem architecture: `docs/architecture/identity-session-architecture.md`
- Feature 1 downstream handoff baseline: `docs/architecture/identity-feature-1-final-baseline.md`
- Trusted-device src/domain/contracts baseline: `docs/architecture/trusted-device-foundation.md`
- Node trust src/domain/contracts baseline: `docs/architecture/node-trust-foundation.md`
- Node trust persistence DTO/repository/schema baseline: `docs/architecture/node-trust-persistence-contracts.md`
- Node trust application orchestration/use-case baseline: `docs/architecture/node-trust-application-use-cases.md`
- Node trust shared API/IPC DTO + schema validation baseline: `docs/architecture/node-trust-transport-contracts.md`
- Internal CA src/domain/contracts baseline for CA roots, issued certificates, rotation metadata, and trust material seams: `docs/architecture/internal-ca-foundation.md`
- Transport security src/domain/application contract baseline for fail-closed HTTPS/WSS/TLS policy and trust validation seams: `docs/architecture/transport-security-foundation.md`
- Secret and key management src/domain/application contract baseline for scope-owned secrets, version lineage, and auditable access-decision seams: `docs/architecture/secrets-foundation.md`
- Secret repository persistence baseline for SQLite schema, scope/key indexes, version-material separation, and adapter replay semantics: `docs/architecture/secrets-persistence-contracts.md`
- Secret envelope encryption baseline for DEK/KEK handling, payload-store isolation, and fail-closed decryption semantics: `docs/architecture/secrets-envelope-encryption.md`
- Secret create + metadata-read use-case baseline for scope/key validation, encrypted-value persistence orchestration, and metadata redaction behavior: `docs/architecture/secrets-creation-and-metadata-use-cases.md`
- Secret scope-resolution baseline for explicit scope-owner validation, policy-driven fallback, and deterministic duplicate-name behavior: `docs/architecture/secrets-scope-resolution-rules.md`
- Secret rotation baseline for version activation preconditions, lineage-preserving supersession, and race-safe activation semantics: `docs/architecture/secrets-rotation-and-version-activation-workflows.md`
- Secret authorization policy baseline for permission-checked operations, runtime-vs-human retrieval rules, and non-leaky deny behavior: `docs/architecture/secrets-authorization-policies.md`
- Secret metadata API baseline for internal create/list/get/disable management routes and metadata-only response contracts: `docs/architecture/secrets-metadata-management-internal-apis.md`
- Secret-backed feature extension guardrails and contributor checklist: `docs/architecture/secrets-feature-extension-guidance.md`
- Secret classification baseline for naming-prefix conventions, metadata-label requirements, and classification validation boundaries: `docs/architecture/secrets-classification-and-metadata-conventions.md`
- Encryption-at-rest policy foundation baseline for explicit policy vocabulary, inheritance/override contracts, and encrypted-material reference invariants: `docs/architecture/encryption-at-rest-policy-foundation.md`
- Encryption-at-rest shared policy DTO/schema/contract baseline for workspace/storage policy exchange and descriptor validation seams: `docs/architecture/encryption-at-rest-policy-shared-contracts.md`
- Encryption-at-rest application evaluation baseline for effective-policy service seams and reusable content/preview/worker decision contracts: `docs/architecture/encryption-at-rest-policy-application-evaluation-ports.md`
- Encryption-at-rest key-resolution baseline for deterministic server/workspace/storage key-scope orchestration and rotation-ready key reference contracts: `docs/architecture/encryption-at-rest-key-resolution-and-scope-orchestration.md`
- Encryption-at-rest protected-value encryption baseline for application encryption/decryption ports, versioned payload descriptors, and infrastructure AES-GCM/key-material adapters: `docs/architecture/encryption-at-rest-protected-value-encryption-ports.md`
- Secret master-key re-encryption operations baseline for controlled KEK migration, progress tracking, and restartable recovery: `docs/secret-master-key-reencryption-operations.md`
- Node bootstrap identity/trust-material operations baseline: `docs/node-bootstrap-identity-operations.md`
- Workspace tenancy src/domain/contracts baseline: `docs/architecture/workspace-foundation.md`
- Managed storage src/domain/contracts baseline: `docs/architecture/storage-foundation.md`
- Protected logical asset src/domain/contracts baseline: `docs/architecture/logical-asset-domain-foundation.md`
- Protected logical asset application ports/use-case + shared transport contract baseline: `docs/architecture/logical-asset-application-ports.md`
- Managed storage application ports/use-case contract baseline: `docs/architecture/storage-application-ports.md`
- Managed storage logical access resolution baseline for authorized logical-reference to backend-operation planning: `docs/architecture/storage-logical-access-resolution.md`
- Managed storage persistence schema/repository baseline: `docs/architecture/storage-persistence-contracts.md`
- Managed local server-backed storage adapter baseline: `docs/architecture/storage-local-backend-adapter.md`
- Managed shared mounted/network storage adapter baseline: `docs/architecture/storage-shared-backend-adapter.md`
- Managed synchronized storage eligibility/state adapter baseline: `docs/architecture/storage-sync-backend-adapter.md`
- Managed storage backend-selection + create provisioning orchestration baseline: `docs/architecture/storage-provisioning-orchestration.md`
- Managed storage shared transport DTO + schema validation + redaction baseline: `docs/architecture/storage-transport-contracts.md`
- Managed storage permission surface and access-summary semantics baseline: `docs/architecture/storage-access-semantics.md`
- Managed storage backend extension rules and operational composition assumptions baseline: `docs/architecture/storage-feature-extension-guidance.md`
- Host runtime composition-root and boundary contracts baseline (authoritative server, desktop, hybrid, web, worker): `docs/architecture/host-runtime-composition-boundaries.md`
- Shared host bootstrap pipeline and startup context baseline (canonical startup sequence + host customization seams): `docs/architecture/host-bootstrap-pipeline.md`
- Host-safe service registration and host-aware dependency composition rules baseline: `docs/architecture/host-service-registration-composition-rules.md`
- Authoritative server executable host assembly baseline (dedicated startup entrypoint + runtime lifecycle expectations): `docs/architecture/authoritative-server-host-assembly.md`
- Shared SQLite persistence bootstrap/runtime baseline for authoritative startup lifecycle and migration-hook coordination: `docs/architecture/persistence-bootstrap-and-lifecycle.md`
- Desktop executable host assembly baseline (dedicated startup entrypoint + desktop runtime lifecycle expectations): `docs/architecture/desktop-host-assembly.md`
- Offline local-mode authority boundary baseline for offline-capable resource classes, explicit local-vs-authoritative state ownership, queued mutation disclosure invariants, reconnect conflict categories, and prohibited shortcuts: `docs/architecture/offline-local-mode-authority-boundaries.md`
- Shared offline synchronization contract/DTO/schema baseline and transition semantics: `docs/architecture/offline-sync-shared-contracts.md`
- Offline transition/reconnect audit + operational hook baseline for structured outcome visibility and sanitized payload publication: `docs/architecture/offline-local-mode-audit-operational-hooks.md`
- Contributor workflow for offline/local-mode extensions (resource classification, local draft/queue semantics, reconnect policy, and guardrails): `docs/offline-local-mode-contributor-guide.md`
- Hybrid executable host assembly baseline (hybrid capability composition rules + authoritative delegation mode): `docs/architecture/hybrid-host-assembly.md`
- Web executable host assembly baseline (thin-client delivery composition boundaries + startup entrypoint expectations): `docs/architecture/web-host-assembly.md`
- Worker executable host assembly baseline (runtime execution composition boundaries + startup entrypoint expectations): `docs/architecture/worker-host-assembly.md`
- Story 12.4.1 runtime-entrypoint migration notes (active entrypoints now delegating through host assemblies): `docs/architecture/entrypoint-host-composition-migration-12.4.1.md`
- Story 12.4.2 development/test startup migration notes (local scripts and harnesses now running through host assemblies): `docs/architecture/development-host-startup-model-12.4.2.md`
- Story 12.4.3 host extension guardrails (architecture tests + contributor host/layer workflow): `docs/architecture/host-composition-extension-guardrails-12.4.3.md`
- Workspace administration audit-hook architecture seam: `docs/architecture/workspace-administration-audit-hooks.md`
- Canonical audit domain model/event taxonomy/invariants and audit-vs-operational boundary guidance: `docs/architecture/audit-domain-foundation.md`
- Canonical shared audit event envelopes, category payload contracts, redacted summary/detail views, and schema-backed query/write validation: `docs/architecture/audit-shared-event-contracts.md`
- Shared actor/workspace/resource/session/device/node reference normalization and authoritative recording integration: `docs/architecture/audit-reference-normalization-layer.md`
- Authoritative application-layer audit recording service behavior, source-oriented recording ports, and baseline cross-feature adapter wiring: `docs/architecture/audit-authoritative-recording-service-and-ports.md`
- Audit taxonomy extension workflow, capture boundaries, prohibited patterns, and prohibited ledger-content rules: `docs/architecture/audit-taxonomy-capture-boundaries-and-extension-rules.md`
- Durable canonical audit ledger persistence schema/repository behavior and append-oriented replay-safe query indexing posture: `docs/architecture/audit-durable-ledger-persistence-and-repositories.md`
- Canonical audit write/read architecture with append invariants, access-control enforcement, redacted detail projection, linkage/correlation retrieval, and retention-lifecycle metadata seams: `docs/architecture/audit-ledger-persistence-query-and-access-control-architecture.md`
- Contributor workflow for adding/extending canonical audit events: `docs/audit-governance-contributor-guide.md`
- Cross-domain authoritative aggregate boundaries and repository target baseline for Feature 13: `docs/architecture/persistent-platform-domain-boundaries.md`
- Contributor extension rules and integration-regression expectations for Feature 13 persistent platform services: `docs/architecture/persistent-platform-service-extension-guidance.md`
- Authorization permission matrix and key catalog reference: `docs/architecture/authorization-permission-catalog.md`
- Authorization workspace role-definition and baseline role-grant reference: `docs/architecture/authorization-role-reference.md`
- Feature 20 shared deployment-profile policy contract/read-write/schema baseline: `docs/architecture/deployment-profile-policy-shared-contracts.md`
- Feature 20 first-production deployment policy taxonomy + canonical configuration registry baseline: `docs/architecture/deployment-profile-policy-taxonomy-registry.md`
- Feature 20 built-in home/classroom/organization preset definitions + explainable defaults baseline: `docs/architecture/deployment-profile-policy-preset-definitions.md`
- Feature 20 centralized effective-policy resolver + persisted override validation/provenance baseline: `docs/architecture/deployment-profile-policy-effective-resolution-and-overrides.md`
- Feature 20.2 durable deployment-policy persistence baseline for active profile selection, override history/provenance, effective metadata, and repository seams: `docs/architecture/deployment-profile-policy-persistence-and-repositories.md`
- Feature 20 application-facing policy evaluation seam baseline for authorization/storage/scheduling/security consumers: `docs/architecture/deployment-profile-policy-evaluation-seams.md`
- Feature 20.2 startup/bootstrap deployment-policy resolution baseline for authoritative host composition and deterministic policy seam initialization: `docs/architecture/deployment-profile-policy-startup-bootstrap-resolution.md`
- Feature 20.2 authoritative policy-read API baseline for active profile/effective state visibility, canonical catalog metadata discovery, and override provenance inspection: `docs/architecture/deployment-profile-policy-authoritative-read-apis.md`
- Feature 20.2 authoritative policy-write API baseline for active profile mutation, typed override administration, and canonical write-response semantics: `docs/architecture/deployment-profile-policy-authoritative-write-apis.md`
- Feature 20.3 admin policy-inspection read-model + production UI composition baseline for active profile state, preset comparison, grouped policy browsing, and effective-value provenance clarity: `docs/architecture/deployment-profile-policy-admin-ui-read-models.md`
- Feature 20.3.3 policy explainability metadata baseline for family impact summaries, controlled-feature visibility, and governance-sensitivity warnings in admin surfaces: `docs/architecture/deployment-profile-policy-explainability-and-impact-summaries.md`
- Feature 20.2 integrated bootstrap/read/write/validation/audit/consumption baseline plus explicit deferred-integration limits: `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md`
- Feature 20.2 deployment-policy governance hook baseline for audit/operational event capture and sink boundaries: `docs/architecture/deployment-profile-policy-audit-operational-governance-hooks.md`
- Feature 20 deployment-profile philosophy, policy-family invariants, preset-vs-override rules, and prohibited branching patterns: `docs/architecture/deployment-profile-policy-invariants-and-extension-rules.md`
- Feature 20 contributor extension workflow for new policy families and feature evaluation seams: `docs/deployment-profile-policy-contributor-guide.md`
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
- Feature 14 / Epic 14.1 Story 14.1.1 convergence inventory and migration plan across desktop IPC, thin-client HTTP/WSS, and shared contract homes: `docs/architecture/unified-api-convergence-plan.md`
- Feature 14 / Epic 14.1 Story 14.1.8 authoritative API surface baseline, prohibited pattern rules, extension workflow, and legacy-path migration guidance: `docs/architecture/unified-api-authoritative-surface.md`
- Feature 14 / Epic 14.2 Story 14.2.8 endpoint-level route-family map, shared contract/client traceability, auth expectations, and realtime topic model: `docs/architecture/unified-api-endpoint-reference.md`
- Canonical multi-surface UI layering and composition rules (desktop/thin-client/mobile-responsive): `docs/architecture/multi-surface-ui-composition-foundation.md`
- Canonical contributor extension workflow + prohibited-pattern guardrails for new admin/operational screens on converged surfaces: `docs/architecture/multi-surface-ui-extension-guidance.md`
- Canonical multi-surface responsive interaction rules for breakpoints/density/touch-target/stacking: `docs/architecture/multi-surface-ui-responsive-conventions.md`
- Contributor implementation checklist for converged API additions (shared contracts/schemas/backend/transport/client wiring): `docs/unified-api-contributor-guide.md`
- Feature 16 / Epic 16.1 Story 16.1.1 canonical run identity/lifecycle model, transition rules, and orchestration boundary ownership map: `docs/architecture/run-orchestration-domain-foundation.md`
- Feature 16 / Epic 16.1 Story 16.1.2 shared run submission/mutation/status transport baseline and schema-validation contract maps: `docs/architecture/run-orchestration-transport-contracts.md`
- Feature 16 / Epic 16.2 Story 16.2.1 persistent queue admission, assignment-ready ordering, and reservation-backed claim selection baseline: `docs/architecture/run-orchestration-queue-assignment-selection.md`
- Feature 16 / Epic 16.2 Story 16.2.2 node capability matching, assignment requirement derivation, and policy precondition evaluation baseline: `docs/architecture/run-orchestration-node-capability-matching.md`
- Feature 17 / Epic 17.1 Story 17.1.1 canonical scheduling policy model (inputs, role-priority, hybrid local-use protections, explainable decisions, and decision-pipeline boundaries): `docs/architecture/run-orchestration-scheduling-policy-domain-model.md`
- Feature 17 / Epic 17.1 Story 17.1.2 shared scheduling contracts and schema-backed policy-evaluation result shapes (snapshot metadata, queue summaries, candidate reasoning, and reservation/priority explainability): `docs/architecture/run-orchestration-scheduling-policy-shared-contracts.md`
- Feature 17 / Epic 17.1 Story 17.1.3 scheduling policy framework baseline with pluggable ordered rule evaluation, modular baseline policy rules, and deterministic assignment recommendation selection: `docs/architecture/run-orchestration-scheduling-policy-framework-and-rule-pipeline.md`
- Feature 17 / Epic 17.1 Story 17.1.4 first-release role-priority scheduling arbitration with deterministic tie-break semantics and explicit decision-level visibility signals: `docs/architecture/run-orchestration-scheduling-role-priority-first-release.md`
- Feature 17 / Epic 17.1 Story 17.1.5 hybrid-node local interactive protection rules with explicit capacity/window signals, explainable eligibility gating, and documented limitations: `docs/architecture/run-orchestration-scheduling-hybrid-node-local-interactive-protection.md`
- Feature 17 / Epic 17.1 Story 17.1.6 required-capability eligibility plus basic affinity-aware candidate preference handling in the authoritative scheduler pipeline: `docs/architecture/run-orchestration-scheduling-required-capability-affinity-eligibility.md`
- Feature 17 / Epic 17.1 Story 17.1.7 explainable scheduling outcome capture with structured decision-reason summaries and application-layer outcome recording seam: `docs/architecture/run-orchestration-scheduling-decision-reason-capture.md`
- Feature 17 / Epic 17.3 Story 17.3.1 scheduling visibility projections for run list/detail/status/queue surfaces, including effective-priority context, defer rationale, placement outcomes, and admin-safe summary counters: `docs/architecture/run-orchestration-scheduling-visibility-projections.md`
- Feature 17 / Epic 17.3 Story 17.3.2 limited scheduling admin controls for deferred-run re-evaluation and stale-reservation visibility/release, with `run.manage` gating and explicit audit hooks: `docs/architecture/run-orchestration-scheduling-admin-controls.md`
- Feature 17 / Epic 17.2 Story 17.2.7 scheduling governance audit/operational hooks for priority-placement selection, defer/no-placement outcomes, reservation conflicts, and sanitized application-layer event publication: `docs/architecture/run-orchestration-scheduling-audit-operational-hooks.md`
- Feature 17 / Epic 17.3 Story 17.3.3 realtime scheduling and queue-arbitration event publication for priority placement, defer/no-placement, reservation conflict, assignment materialization, and requeue outcomes: `docs/architecture/run-orchestration-scheduling-realtime-event-publication.md`
- Feature 17 / Epic 17.3 Story 17.3.4 production scheduler observability diagnostics with structured logs, decision counters/metrics, defer-no-placement and conflict markers, and centralized sensitive-detail redaction: `docs/architecture/run-orchestration-scheduling-observability-metrics-and-redaction.md`
- Feature 17 / Epic 17.3 Story 17.3.6 deployment-profile scheduler policy seams for profile-context resolution and profile-aware rule-set construction without placeholder toggles: `docs/architecture/run-orchestration-scheduling-deployment-profile-policy-seams.md`
- Feature 17 / Epic 17.1 Story 17.1.8 consolidated scheduling architecture baseline, current production policy limits, scheduling-vs-dispatch separation, and extension rules for quotas/reservations/affinity/deployment-profile/resource arbitration: `docs/architecture/run-orchestration-scheduling-architecture-extension-guidance.md`
- Feature 17 / Epic 17.2 Story 17.2.1 scheduler-authoritative queue selection and assignment materialization integration through scheduling decision pipeline + claim-safe assignment gateway seams: `docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`
- Feature 17 / Epic 17.2 Story 17.2.8 documentation baseline for queue integration, explicit no-placement outcomes, reservation/placement-hold release invariants, and dispatch outcome settlement seams: `docs/architecture/run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md`
- Feature 17 / Epic 17.2 Story 17.2.2 reservation-aware node arbitration with temporary placement-hold lifecycle semantics (acquire/conflict/expiry/release) during assignment materialization: `docs/architecture/run-orchestration-scheduling-reservation-aware-node-arbitration-and-placement-holds.md`
- Feature 17 / Epic 17.2 Story 17.2.3 deterministic scheduling arbitration baseline with centralized tie-break comparator stages, order-stable candidate ranking, and explainable equal-candidate selection details: `docs/architecture/run-orchestration-scheduling-deterministic-candidate-arbitration.md`
- Feature 17 / Epic 17.2 Story 17.2.4 defer/backoff/no-placement handling for unschedulable queued runs, explicit no-placement metadata capture, and repeated-evaluation anti-thrash queue behavior: `docs/architecture/run-orchestration-scheduling-unschedulable-defer-backoff-and-no-placement-handling.md`
- Feature 17 / Epic 17.2 Story 17.2.5 node-availability and eligibility refresh in scheduling loop with heartbeat freshness checks and stale/unavailable/revoked denial semantics: `docs/architecture/run-orchestration-scheduling-node-availability-and-eligibility-refresh.md`
- Feature 17 / Epic 17.2 Story 17.2.6 scheduling-aware dispatch outcome queue settlement with explicit reservation release, retryable failed-start requeue, and terminal finalization fallback behavior: `docs/architecture/run-orchestration-scheduling-dispatch-outcome-requeue-and-release.md`
- Feature 16 / Epic 16.2 Story 16.2.3 authoritative queued-run node claim, dispatch-preparation persistence, and controlled duplicate-claim conflict baseline: `docs/architecture/run-orchestration-node-claim-dispatch-preparation.md`
- Feature 16 / Epic 16.2 Story 16.2.8 consolidated control-plane lifecycle architecture (queue selection, assignment, claim, dispatch, progress ingestion, completion/failure finalization) and scheduler boundary rules: `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`
- Feature 16 / Epic 16.3 Story 16.3.1 authoritative run cancellation lifecycle/state-matrix workflow, queue-aware claim coordination, and backend cancellation signaling seams: `docs/architecture/run-orchestration-authoritative-cancellation-workflow-and-state-matrix.md`
- Feature 16 / Epic 16.3 Story 16.3.2 authoritative run retry/rerun eligibility workflow, lineage persistence rules, and canonical resubmission seams: `docs/architecture/run-orchestration-authoritative-retry-rerun-workflow-and-lineage.md`
- Feature 16 / Epic 16.3 Story 16.3.6 authoritative startup recovery/reconciliation behavior for stale claims, interrupted dispatch progression, stale assignment/running timeouts, and explicit manual-follow-up boundaries: `docs/architecture/run-orchestration-startup-recovery-reconciliation.md`
- Feature 16 / Epic 16.3 Story 16.3.5 operational run/queue projection reads for queue position, action eligibility, authoritative timeline/history, user-safe failure summaries, and admin-gated diagnostics: `docs/architecture/run-orchestration-operational-visibility-projections.md`
- Feature 16 / Epic 16.3 Story 16.3.4 authoritative realtime orchestration event publication for submission/queue/assignment/progress/cancel/retry/completion/failure transitions: `docs/architecture/run-orchestration-realtime-event-publication.md`
- Feature 16 / Epic 16.1 Story 16.1.7 run submission governance audit hooks for denied/accepted submission events and initial lifecycle transition emission: `docs/architecture/run-submission-lifecycle-audit-hooks.md`
- Feature 16 / Epic 16.1 Story 16.1.8 end-to-end authoritative run-submission pipeline guardrails, extension points, and prohibited shortcuts: `docs/architecture/run-submission-pipeline-extension-guardrails.md`
- Feature 16 / Epic 16.1 Story 16.1.8 contributor workflow and extension checklist for run-submission changes: `docs/run-submission-contributor-guide.md`
- Feature 17 / Epic 17.2 Story 17.2.8 contributor workflow for scheduler policy, queue reservations/arbitration, dispatch, execution-update, and finalization extensions: `docs/run-orchestration-contributor-guide.md`

## Direction 4 (Phase 1) foundation
- Agent concepts are now first-class inner-layer artifacts (`src/domain/agents/*`) with validated goal, policy, memory, and execution-session models (including lifecycle and invariant enforcement).
- Agent roots now expose explicit `toolAccess` alongside policy so planner/executor consumers have a stable contract without duplicating policy semantics.
- Agent memory configuration is explicitly asset-based (`AssetId` references + memory types + typed retrieval configuration + revision), aligned with Direction 2 lineage/versioning.
- Agent execution now has a bounded mapping seam into the unified execution backbone (`src/application/agents/contracts/AgentExecutionMapping.ts`) that yields `ExecutionPlan` units plus per-unit payload correlation data, rather than introducing a second runtime model.
- This remains a foundation slice only: no studio UI, no autonomous replanning loop, and no parallel orchestration stack.

- Direction 4 (Phase 2, inner foundation only) now includes an execution-oriented planning contract: `src/domain/agents/AgentPlan.ts` (dependency-aware plan/step model + validation), `src/application/agents/contracts/AgentPlanningStrategy.ts` (strategy contract/descriptor seam) plus `src/application/agents/services/DeterministicAgentPlanningStrategy.ts` (first deterministic strategy), and bounded planning-loop evaluation contracts in `src/application/agents/contracts/AgentPlanningLoop.ts` without adding a parallel runtime or UI loop.
- Direction 4 (Phase 3, memory system inner slice) now adds explicit memory retrieval/write seams and session working memory:
  - Retrieval contract: `src/application/agents/contracts/AgentMemoryRetrieval.ts` + `src/application/agents/services/AgentMemoryRetrievalService.ts`.
  - Session working memory model: `src/domain/agents/AgentWorkingMemory.ts` + `src/application/agents/services/AgentWorkingMemoryService.ts`.
  - Bounded write pipeline: `src/application/agents/services/AgentMemoryWriteService.ts`.
  - Explicit memory policy controls now live in `src/domain/agents/AgentMemory.ts` (`retrievableTypes`, `writableTypes`, `sessionOnlyTypes`, bounded retention settings).
  - Retrieval semantics are deterministic and policy-bounded (type/tag/metadata/recency filters over asset-version-backed entries), and session-only memory types are excluded from durable retrieval.
  - Execution read models now carry working-memory snapshots and write outcomes so planning/evaluation consumers can reuse bounded session context without a second runtime.
  - Write policy is now enforced operationally (writable/session-only checks + bounded durable retention gating).
- Direction 4 (Phase 4, MCP capability layer foundation) now binds agent MCP access to canonical MCP identity (`src/domain/mcp/McpToolIdentity.ts` + `AgentPolicy.toolAccess.allowedMcpTools`), maps MCP steps as execution-native units (`ExecutionUnitKinds.mcpToolInvocation` via `AgentExecutionMapping`), and introduces deterministic plan/execute-time MCP governance checks (`src/application/agents/services/AgentMcpToolGovernanceService.ts`) that reuse registry/trust services for permission/approval/sandbox/schema checks without creating a second runtime.
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
- A compact shared composition taxonomy now exists in `src/domain/taxonomy/CompositionTaxonomy.ts` with explicit structural kind, semantic role, and behavior kind.
- Classification seams for current entities live in `src/application/taxonomy/CompositionTaxonomyClassifier.ts`.
- Workflow and agent adapters use the same taxonomy model (`src/application/workflows/WorkflowTaxonomy.ts`, `src/application/agents/contracts/AgentTaxonomy.ts`) so agents remain extensions of the shared composition model, not a separate ontology.
- Canonical identity persistence now stores taxonomy metadata, and canonical asset query criteria supports taxonomy-aware filtering.
- Canonical asset summary/detail reads include taxonomy via identity metadata with bounded fallback mapping.
- See `docs/architecture/shared-composition-taxonomy.md` for the practical architecture note and current-scope boundaries.
- Shared asset contracts now complement taxonomy (`src/domain/contracts/AssetContract.ts`, `src/application/contracts/CompositionAssetContractResolver.ts`) and are surfaced through canonical operational reads when available; see `docs/architecture/shared-asset-contracts.md`.
- Asset selector foundation now lives in `src/domain/studio-shell/AssetSelectorContract.ts` and `src/application/studio-entry/AssetSelectorCapabilityRegistry.ts`; see `docs/architecture/asset-selector-framework.md`.
- Canonical studio launch/return handoff contracts now live in `src/ui/routes/StudioHandoffContract.ts`; see `docs/architecture/studio-handoff-contract.md`.

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

## Direction 8 update: secret host composition (story 8.1.7)

- Authoritative server runtime now composes secret services through `src/infrastructure/security/secrets/SecretServiceComposition.ts` and host wiring in `src/hosts/server/IdentityServerHost.ts`.
- Canonical architecture note for this slice: `docs/architecture/secrets-service-composition.md`.
- Runtime-facing service-to-service secret consumption adapters now expose workspace/user/server credential retrieval through formal retrieval use cases in `src/application/security/services/SecretRuntimeConsumptionAdapters.ts`.
- Canonical architecture note for this slice: `docs/architecture/secrets-service-consumption-adapters.md`.








- Feature 20.3.2 production-safe admin update workflows for supported profile and override controls with explicit confirmation/validation/result handling and editable vs inspect-only vs unsupported control separation: docs/architecture/deployment-profile-policy-admin-safe-update-workflows.md.
- Feature 20.3.3 policy explainability and impact-summary baseline for authoritative metadata-driven admin messaging and governance-warning visibility: docs/architecture/deployment-profile-policy-explainability-and-impact-summaries.md.
