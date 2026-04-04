# AI Companion: Layers and Boundaries

## Fast boundary map
- `domain/` = business rules only
- `application/` = use cases + ports
- `infrastructure/` = port implementations + composition
- `ui/` = React pages/components/stores/services
- `electron/` = desktop host/bootstrap/bridges

## Key evidence files
- Domain aggregate: `domain/workflows/Workflow.ts`
- Domain validation: `domain/services/WorkflowValidator.ts`
- Application port: `application/ports/interfaces/IWorkflowRepository.ts`
- Application orchestration: `application/workflows/ExecuteWorkflowUseCase.ts`
- Infrastructure repo: `infrastructure/filesystem/LocalWorkflowRepository.ts`
- UI convenience orchestration: `ui/services/WorkflowService.ts`, `ui/services/NodeService.ts`

## Important nuance
The architecture is mostly clean, but not all write actions are modeled as application use cases. Some stay in UI services as domain-object convenience operations.

## Direction 4 boundary note (Phase 1)
- Agent meaning/rules live in `domain/agents/` (goals, policies, asset-backed memory config, execution sessions).
- Agent-to-runtime mapping lives in `application/agents/contracts/AgentExecutionMapping.ts` and targets `ExecutionPlan` units.
- No agent UI/runtime bypass was introduced in this phase.
- Phase 3 memory services now enforce policy operationally at the same inner layers (retrievable/writable/session-only/retention checks), still asset-backed and without a second storage/runtime model.
- Phase 5 runtime semantics are still application-layer (`AgentRunnerService`) with deterministic progress/retry/session events; persistence remains an application port (`IAgentExecutionSessionRepository`) with a concrete SQLite infrastructure implementation.
- Phase 5 session persistence now includes durable per-step outcomes and transition-history reads via the same application port, keeping retry/partial-execution truth in the inner contract instead of transport-specific projections.
- Phase 6 authoring now has an explicit persistence/application seam split:
  - persistence ports: `IAgentRepository`, `IAgentExecutionSessionRepository`
  - infrastructure adapters: `SqliteAgentRepository`, `SqliteAgentExecutionSessionRepository`
  - SQLite opening now runs through a bounded compatibility seam (`infrastructure/filesystem/sqlite/SqliteCompat.ts`) so the same repository contract works across Node/Electron (`better-sqlite3`) and Bun (`bun:sqlite`) environments.
  - application use cases: CRUD + bounded configuration updates (`goals`, `policy`, `tools`, `memory`, `strategy`) plus whole-config validation (`AgentConfigurationValidationService`).
  - CRUD failure semantics are explicit inner-layer contracts (`AgentConflictError`, `AgentNotFoundError`, `AgentInvalidRequestError`) so infrastructure transport mapping is type-based rather than string-matching.
  - `SqliteAgentRepository` deserialization now rehydrates snapshots through domain normalization, preserving full aggregate truth (including asset-native memory refs and planning/execution config) instead of raw cast-only JSON reads.
  - malformed persisted snapshots now fail fast with explicit field-level errors (for example missing policy/planning/execution objects) instead of silently materializing partial aggregates.
  - goal authoring updates (`add`/`update`/`remove`/`reorder`) now enforce deterministic coherence through `AgentGoalConfiguration` (unique ids, canonical required tool refs, contiguous ordering from 1, explicit missing-goal failures) at the application/domain boundary.
  - policy authoring updates are now centralized via `AgentPolicyConfiguration` operations for tool access, safety approvals/sandbox posture, and cost/execution limits.
  - new agent-facing artifacts/read models must flow through shared composition seams (`CompositionTaxonomyClassifier` or `CompositionAssetContractResolver`) rather than agent-only presentation semantics.
  - memory configuration updates are now explicitly validated for asset-native references, retrieval compatibility, writable/retrievable/session-only coherence, and retention contradictions before persistence.
  - tool configuration updates are now explicitly validated and normalized as canonical policy semantics (`AgentPolicy.toolAccess` only): canonical tool ids, MCP binding consistency against allowed ids, and scope-constraint integrity are enforced in inner-layer normalization before persistence.
  - memory validation now emits explicit structured issues for non-canonical/malformed asset refs, duplicate refs, malformed asset-version ids, invalid semantic/recency settings, and retention/policy contradictions (not only generic fallback errors).
  - tool identity normalization now reuses a shared domain seam (`domain/agents/AgentToolIdentity.ts`) across policy, goals, plan, and application validation so canonical identity rules are not duplicated across services.
  - strategy configuration is now explicitly bounded to supported descriptors (deterministic id/mode only in this slice); unsupported strategy combinations are rejected deterministically.
  - strategy validation now also emits explicit structured issues for missing strategy id and unsupported id/mode combinations.
  - whole-agent validation issues now include machine-friendly sectioning (`goals`/`tools`/`memory`/`strategy`/etc.) and are reusable across CRUD/configuration/API via `AgentConfigurationValidationError`.
  - validation is now explicitly reusable for both create and update pathways (`mode: create|update`), including update-time immutable-id checks.
  - policy/sandbox/trust contradictions now emit explicit cross-field issue codes (for example required-vs-denied permission conflicts, sandbox denial vs required approval conflicts, and malformed tool-scope approvals) rather than relying only on generic domain fallback errors.
  - desktop backend transport now exposes thin agent-authoring IPC handlers (`ai-loom-desktop-agents:*`) that delegate to authoring use cases instead of re-implementing domain/application rules in transport.
  - all configuration use cases now emit typed authoring failures (`AgentNotFoundError` / `AgentInvalidRequestError`) instead of generic message-thrown errors, so transport stays deterministic.
  - `AgentAuthoringBackendApi` now maps transport errors from typed authoring/validation contracts only; unknown exceptions map to `internal` without substring fallback logic.
  - API read-model DTOs are now hardened as composition-native projections (`agent` + taxonomy classification + optional contract projection) so transport contracts remain aligned with shared composition seams.
  - test coverage now includes SQLite-backed authoring integration checks for CRUD + goal/policy/tool/memory/strategy flows plus API mapping/error-path checks so real repository seams are exercised directly.
  - Phase 8.2/8.3 renderer wiring now stays an outer-layer shell (`ui/pages/AgentStudioPage.tsx` + `ui/services/AgentStudioService.ts` + panel components) that consumes those IPC/backend contracts directly for list/load/create/launch/session/cancel and configuration updates.
  - authoring UX surfaces (goals/policy/tools/memory/strategy) do not add client-side business validation; backend use cases and validation contracts remain source-of-truth and UI only displays returned errors/issues.
  - agent-facing read artifacts consumed by UI remain composition-native (`agent` + taxonomy classification + optional contract projection) rather than agent-only semantics, preserving `CompositionTaxonomyClassifier` / `CompositionAssetContractResolver` boundaries.


## TODO
- When summarizing purity/impurity, say "clean-architecture-style with pragmatic UI-layer convenience logic," not "strict clean architecture."
- Phase 7 inner contracts now expose authored-agent operations as application use cases (launch/session-read/run-control/trigger-binding) over existing `AgentRunnerService` + `IAgentExecutionSessionRepository` seams; no parallel runtime path was introduced.

## Direction 6 boundary note: Identity domain foundation (story 1.1.1)
- New inner-layer identity contracts live in `src/domain/identity/IdentityDomain.ts`.
- The model keeps identity lifecycle, credential lifecycle/policy, and session lifecycle as explicit separate concerns.
- Provider contracts remain extensible (`local` + `external` categories and provider-kind descriptors) so local accounts are supported now without blocking future external identity integration.
- No infrastructure/transport details were added to the identity domain seam.

## Direction 6 boundary note: Identity application ports foundation (story 1.1.2)
- Application-layer identity boundaries now live in `application/identity/ports/`.
- Lookup, persistence, credential-material, and session contracts are split into dedicated interfaces so use cases depend on capability seams instead of implementation detail.
- Time and ID generation are explicit application seams (`IIdentityClock`, `IIdentityIdGenerator`) instead of implicit `Date`/UUID calls.
- Shared DTO/query contracts in `application/contracts/IdentityApplicationContracts.ts` keep port payloads stable and framework-independent.

## Direction 6 boundary note: Identity persistence adapters in src layer (story 1.1.4)
- Added `src/infrastructure/persistence/identity/SqliteIdentityPersistenceAdapter.ts` as a concrete infrastructure adapter implementing identity repository ports without moving identity rules out of the domain/application layers.
- Added explicit persistence mapper boundaries in `src/infrastructure/persistence/identity/IdentityPersistenceMapper.ts` so SQL row contracts remain infrastructure-only and domain/application models stay persistence-agnostic.
- Added `src/infrastructure/persistence/sqlite/SqliteCompat.ts` and `src/infrastructure/persistence/identity/SqliteIdentityPersistenceMigrations.ts` to keep database opening/migration mechanics isolated to infrastructure.

## Direction 6 boundary note: Identity policy and validation services (story 1.1.5)
- Pure identity validation and normalization policy now lives in `src/domain/identity/IdentityPolicy.ts` (username/email/profile normalization, provider-subject normalization, credential-policy evaluation, and status-transition evaluation) so rule logic is reusable outside transport/UI handlers.
- Application orchestration for identity conflicts now lives in `application/identity/services/IdentityPolicyService.ts`, where repository-backed uniqueness checks are centralized behind `IIdentityLookupRepository` instead of being duplicated across registration/login entry points.
- Structured issue/conflict outputs are now machine-friendly and deterministic (`issues` + ordered `username/email/provider-subject` conflicts), which keeps outer layers thin and transport-agnostic.

## Direction 6 boundary note: Seed-safe admin bootstrap initialization (story 1.1.6)
- Added a dedicated first-run bootstrap application seam in `application/identity/services/IdentityBootstrapService.ts` for initial local admin setup, kept separate from general registration paths.
- Bootstrap gating now uses `IIdentityLookupRepository.countUserIdentities()` so "can initialize" policy is application-level and storage-agnostic.
- Bootstrap orchestration remains at the application layer over existing identity ports (lookup/persistence/credential-material/clock/id-generation), while SQLite adapters implement the new counting capability at infrastructure boundaries.
- This keeps bootstrap policy deterministic and testable without leaking infrastructure or UI concerns inward.

## Direction 6 boundary note: Identity architecture documentation (story 1.1.8)
- Added dedicated identity architecture docs in `docs/architecture/identity-foundation.md` and `docs/architecture/identity-foundation.ai.md`.
- Documents exact boundary ownership for identity contracts/adapters and keeps trust concerns separated from identity lifecycle contracts.

## Direction 6 boundary note: Secure local password credential handling (story 1.2.2)
- Added an explicit local-password credential port (`application/identity/ports/ILocalPasswordCredentialService.ts`) so secret hashing/verification logic remains outside application registration/login orchestration.
- `RegisterLocalAccountUseCase` now consumes password candidates and persists only derived hash material produced by that port.
- Added `VerifyLocalPasswordCredentialUseCase` as a reusable login verification seam over active credential-material lookup plus password verification through the same port.
- Added infrastructure security implementation `infrastructure/security/identity/ScryptLocalPasswordCredentialService.ts` using scrypt-based password derivation and timing-safe verification.

## Direction 6 boundary note: Authoritative identity server endpoints (story 1.2.6)
- Added a thin infrastructure API adapter (`infrastructure/api/identity/IdentityAuthBackendApi.ts`) that maps inner identity results to stable public API error codes.
- Added authoritative HTTP transport handlers in `infrastructure/transport/http-server/identity/IdentityHttpServer.ts` for registration/login (`POST /api/v1/identity/register`, `POST /api/v1/identity/login`).
- Boundary posture is preserved:
  - request validation is transport-only (`zod`);
  - registration/login business rules remain in application use cases;
  - host wiring is outer-layer only (`hosts/server/IdentityServerHost.ts`).
- Transport logging now redacts credential-sensitive fields before emission, so credential material does not leak through infrastructure logs.
