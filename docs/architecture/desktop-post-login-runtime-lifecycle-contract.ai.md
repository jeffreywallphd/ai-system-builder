# AI Companion: Desktop Post-Login Runtime Lifecycle Contract

Feature: C  
Epic: C.1  
Story: C.1.3

## Purpose
- Define the explicit post-login runtime orchestration contract so deferred runtime never drifts back into pre-login startup.
- Make warmup trigger behavior, lifecycle status semantics, and teardown/reset behavior implementation-ready across main/preload/renderer.

## Canonical boundary
- `DesktopPostLoginRuntimeLifecycle`
- canonical runtime contract source: `src/application/common/DesktopControlPlaneRuntimeContracts.ts`
- canonical shared runtime availability response contracts: `src/shared/contracts/runtime/RuntimeAvailabilityResponseContracts.ts`
- trigger request: `DesktopPostLoginWarmupRequest`
- status read model: `DesktopPostLoginRuntimeStatus`
- capability phases: `pre-login`, `warming`, `ready`, `failed`
- transport phases: `unavailable`, `binding`, `available`, `failed`
- activation modes: `auth-success-warmup`, `lazy-feature-demand`

## Story 1.2.1 runtime availability response contracts

Shared runtime lifecycle response shapes now define explicit stateful payloads for both readiness and guarded runtime endpoint contracts without coupling callers to transport outages:

- canonical lifecycle states:
  - `unavailable`
  - `warming`
  - `ready`
  - `failed`
- readiness endpoints can return `RuntimeReadinessResponseContract` with a `runtime` lifecycle payload.
- guarded runtime endpoints can return `RuntimeGuardedEndpointUnavailableResponseContract` with endpoint identity + blocked lifecycle state.
- contracts include:
  - machine-readable blocking reason codes,
  - retryability and optional retry timing,
  - ISO timestamps (`checkedAt`, `updatedAt`, and state-specific timestamps),
  - optional diagnostics metadata for desktop-local troubleshooting.

## Layer responsibilities
- main (`electron/main`):
  - owns lifecycle transitions and authoritative status payload.
  - owns warmup orchestration (`createPostLoginRuntimeActivationService(...).startPostLoginWarmup(...)` -> `createPostLoginRuntimeDependencyActivator(...).activateDependencies(...)`).
  - owns deferred feature IPC readiness gate and runtime disposal/reset transitions.
  - composes focused runtime-control modules for stateful lifecycle concerns:
    - `electron/main/DesktopPostLoginRuntimeStatusStore.ts`
    - `electron/main/DesktopConnectivityRuntimeController.ts`
    - `electron/main/runtime/PostLoginRuntimeActivationService.ts`
    - `electron/main/runtime/PostLoginRuntimeDependencyActivator.ts`
    - `electron/main/runtime/DesktopRuntimeDisposalCoordinator.ts`
- preload (`electron/preload.ts`):
  - exposes runtime status/readiness probes and warmup trigger bridge.
  - enforces deferred API guards until runtime is ready.
- renderer (`src/ui`):
  - emits auth-success warmup triggers.
  - reads runtime status when it needs more than binary readiness.
  - handles deferred unavailable behavior as controlled state.

## Trigger contract
- auth-success trigger sources:
  - `explicit-login`
  - `session-restore`
  - `session-refresh`
  - `unknown`
- lazy trigger source:
  - `feature-demand`

Main trigger semantics:
1. join if warmup already in flight,
2. ignore if runtime activation is already `ready` (idempotent steady state),
3. otherwise transition to `warming` with activation mode derived from trigger,
4. bootstrap post-login runtime once and reuse the same in-flight promise,
5. reset activation to retryable idle only on failure.

## Story C.2.2 runtime infrastructure boundary

The deferred warmup path is now the only contract-allowed location for:

- desktop Python runtime resolution (`resolveDesktopPythonRuntime(...)`)
- local managed service startup (`DesktopServiceSupervisor.start()`)

Pre-login contract guardrails now require:

- pre-login startup sequence does not include Python runtime resolution or service-supervisor startup,
- `bootstrapAuthShell()` remains free of Python/supervisor composition logic.

Operational diagnostics now explicitly log deferred warmup start/ready details for both Python runtime resolution and service-supervisor startup.

## Story C.2.5 connectivity monitoring lifecycle boundary

Connectivity monitoring now uses the deferred runtime lifecycle contract:

- pre-login auth-shell startup no longer starts recurring connectivity monitoring probes.
- monitoring starts only once post-login warmup is accepted (`startPostLoginWarmup(...)` in `PostLoginRuntimeActivationService`).
- pre-warmup renderer connectivity reads return a controlled fallback payload (`connecting`) with explicit deferred-monitoring detail.
- pre-warmup offline-mode write attempts return the same fallback payload, preventing partial pre-login monitoring emulation.
- runtime disposal/teardown explicitly stops connectivity monitoring before runtime reset so quit/logout lifecycle remains deterministic.

## Story C.3.1 preload and IPC surface split boundary

Desktop preload bridge exposure is now split into canonical namespaces:

- `window.aiLoomDesktop.auth`
  - always available during pre-login startup
  - contains bootstrap context, storage, secrets, connectivity, and runtime lifecycle probes/triggers
- `window.aiLoomDesktop.features`
  - deferred feature bridge groups
  - guarded until deferred feature IPC readiness is true
  - first guarded access emits a `feature-demand` warmup request through the runtime warmup channel

Compatibility constraint:

- legacy root aliases can remain temporarily for compatibility, but new renderer integration should consume `auth` and `features` namespaces as the authoritative contract.

## Story 1.4.1 desktop bootstrap and runtime bridge contract clarification

Desktop preload/runtime contracts now expose explicit bootstrap and lifecycle surfaces so stable transport identity is not conflated with deferred capability readiness:

- `window.aiLoomDesktop.auth.bootstrapContext`
  - explicit auth/bootstrap context payload for renderer bootstrap consumers.
  - `auth.bootstrap` remains as temporary compatibility alias.
- `window.aiLoomDesktop.auth.controlPlane`
  - explicit stable control-plane bootstrap identity (`baseUrl`, bootstrap `capabilityPhase`).
  - meant for stable transport/bootstrap addressing, not deferred feature readiness decisions.
- `window.aiLoomDesktop.auth.runtime` official lifecycle methods:
  - `isCapabilityReady()`
  - `getLifecycleStatus()`
  - `getTransportStatus()`
  - `activateCapabilities(request?)`
- temporary runtime compatibility aliases retained:
  - `isDeferredFeatureApiReady()`
  - `getPostLoginRuntimeStatus()`
  - `startPostLoginWarmup(request?)`

Contract intent:

- control-plane transport/bootstrap identity stays stable and explicit via `auth.controlPlane` + lifecycle `transport` status,
- deferred capability readiness remains lifecycle-state driven (`capabilityPhase/state`) instead of transport/socket assumptions,
- renderer integrations should migrate to official lifecycle naming while compatibility aliases remain temporary.

## Story 1.4.2 central renderer runtime lifecycle service

Renderer lifecycle awareness is now centralized in one reusable service/hook so feature surfaces do not each implement local polling and warmup timing logic:

- canonical renderer lifecycle service:
  - `src/ui/runtime/RendererRuntimeLifecycleService.ts`
- canonical shared hook:
  - `useRendererRuntimeLifecycle(...)`

Contract behavior:

- status source remains `window.aiLoomDesktop.auth.runtime` with legacy fallback to `window.aiLoomDesktop.runtime`.
- lifecycle state surfaces remain explicit (`pre-login`, `warming`, `ready`, `failed`).
- activation and retry flow through one warmup trigger path (`requestDesktopPostLoginWarmup(...)`) with configurable trigger source.
- readiness is derived from lifecycle state when available, with compatibility fallback to readiness probes when only legacy bridge methods exist.

Consumer alignment:

- `src/ui/runtime/DeferredRuntimeFeatureGate.ts` now consumes the shared service/hook instead of owning separate bridge polling logic.
- `src/ui/components/studio-shell/ImageManipulationRuntimeEditorPanel.tsx` now consumes the shared service/hook instead of custom local runtime polling/readiness helpers.

Result:

- runtime lifecycle polling and retry semantics are canonicalized in renderer runtime infrastructure,
- feature surfaces reuse one lifecycle contract and avoid duplicated lifecycle timing assumptions.

## Story 1.4.4 user-facing runtime lifecycle UI states

Renderer runtime-driven surfaces now present non-technical lifecycle copy mapped directly from backend runtime lifecycle status (`DesktopPostLoginRuntimeStatus`) so users understand startup and retry behavior without transport-level jargon:

- lifecycle states shown to users:
  - `unavailable`
  - `warming`
  - `ready`
  - `failed`
- route-level deferred runtime guard (`src/ui/runtime/DeferredRuntimeFeatureGate.ts`) now uses clear user-first state titles/messages and preserves retry on retryable failures.
- settings runtime panel (`src/ui/components/execution/McpRuntimeStatusPanel.tsx`) now renders explicit lifecycle status including `ready` state and failed-state retry affordance when restart is available.
- lifecycle diagnostics shown in UI state details are sourced from backend lifecycle payload fields (`state`, `capabilityPhase`, `transport.phase`, `unavailableReason`, activation stage metadata, failure metadata) rather than placeholder transport assumptions.

## Status/readiness exposure
- status channel:
  - `ai-loom-desktop-runtime:get-post-login-runtime-status`
  - preload runtime bridge: `getPostLoginRuntimeStatus()`
- readiness channel:
  - `ai-loom-desktop-runtime:is-feature-api-ready`
  - preload runtime bridge: `isDeferredFeatureApiReady()`

Contract rule:
- readiness `true` implies status `ready`.
- renderer may continue using readiness for binary gating.
- renderer should use status probe for warming/failed/unavailable awareness.
- runtime readiness must be inferred from capability phase (`ready`), not transport listener existence; transport continuity is reported separately in `status.transport`.

## Story C.3.2 renderer readiness/failure boundary

Renderer now applies a deferred-runtime feature-entry boundary instead of assuming post-login runtime is immediately ready:

- `src/ui/runtime/DeferredRuntimeFeatureGate.ts`
  - resolves runtime bridge from `window.aiLoomDesktop.auth.runtime` (legacy fallback supported),
  - requests `feature-demand` warmup on first gated feature entry,
  - polls lifecycle status until `ready`,
  - maps lifecycle states into controlled surface states (`loading`, `disconnected`, `error`) with retry support.
- `src/ui/layout/AppLayout.tsx`
  - gates deferred-runtime-dependent routes at the `Outlet` boundary:
    - `/build*`, `/explore*`, `/run*`, `/assets*`, `/workflows/*`, `/studio-shell/*`
  - renders existing `SurfaceStatePanel` status presentation and a localized retry action when runtime is unavailable/failed.

Contract intent:

- login remains fast (no new global post-login blocking screen),
- deferred feature entry points no longer race deferred runtime warmup,
- failures/unavailability are surfaced in a controlled way that is clear to users and actionable for developers.

## Story C.3.3 startup instrumentation boundary

The runtime lifecycle contract now includes explicit timing + memory checkpoints that separate critical-path startup from deferred/runtime-on-demand work:

- pre-login/authoritative control-plane host:
  - auth-shell phase remains instrumented under `desktop-startup.pre-login-auth-shell-bootstrap`.
  - authoritative control-plane host readiness now logs startup-memory at `start` and `ready` in `desktop-startup.identity-auth-host-readiness`.
- first-window readiness:
  - `desktop-startup.main-window-creation` now logs `first-window-ready-to-show`.
  - `desktop-startup.host-bootstrap` now logs `renderer-first-window-ready`.
- post-login warmup:
  - `desktop-startup.post-login-warmup` now logs `deferred-feature-runtime-container-ready` after deferred container composition.
- deferred first-use service groups (in `DeferredDesktopFeatureRuntime`):
  - workflow persistence
  - execution/workflow run persistence
  - studio shell backend
  - system studio/runtime backends

Each first-use group now emits paired `[ai-loom][startup]` timing and `[ai-loom][startup-memory]` checkpoints using `desktop-startup.deferred-feature-runtime.*` timing phases.

## Story C.3.4 startup boundary regression safeguards

The deferred runtime lifecycle contract now includes explicit regression guardrails that prevent non-auth runtime groups from drifting back into pre-login startup:

- startup contract guard list (`PreLoginStartupForbiddenRuntimeGroups`) now explicitly requires:
  - `service-supervisor`
  - `python-runtime-resolution`
  - `workflow-persistence`
  - `execution-history`
  - `workflow-run-history`
  - `studio-shell-backend-api`
  - `system-studio-backend-api`
  - `system-runtime-backend-api`
  - `desktop-connectivity-monitor`
- startup contract validation fails if this required guard list is removed or narrowed.
- focused Electron main regression coverage now asserts:
  - `bootstrapAuthShell()` does not activate those runtime groups,
  - connectivity monitoring starts only once post-login warmup is accepted,
  - Python runtime resolution and service-supervisor startup remain in post-login composition,
  - workflow/studio/system backends remain lazy through deferred runtime `ensure*` paths.

## Story C.3.5 runtime-control extraction boundary

- Post-login runtime lifecycle state transitions now flow through `createDesktopPostLoginRuntimeStatusStore(...)` instead of ad hoc mutable status variables in `main.ts`.
- Deferred connectivity lifecycle behavior (placeholder state creation, auth IPC serialization, offline-mode fallback/write handling, monitoring start/stop ownership) now flows through `createDesktopConnectivityRuntimeController(...)`.
- Contract semantics remain unchanged:
  - deferred placeholder detail text remains stable,
  - monitoring starts only after warmup acceptance,
  - probe token lookup still resolves through persisted bootstrap storage.

## Story C.3.6 bootstrap/disposal module extraction boundary

- Post-login runtime warmup orchestration now lives in `electron/main/runtime/PostLoginRuntimeActivationService.ts`.
- Post-login runtime dependency activation/composition internals now live in `electron/main/runtime/PostLoginRuntimeDependencyActivator.ts`.
- Runtime teardown/reset sequencing internals are now centralized in `electron/main/runtime/DesktopRuntimeDisposalCoordinator.ts`.
- `electron/main/main.ts` remains the composition root that decides when warmup/disposal runs, while delegating lifecycle implementation details to those dedicated modules.

## Story C.3.7 continuous listener availability regression coverage

- Runtime lifecycle regression coverage now explicitly protects continuous control-plane listener availability across capability-state transitions.
- `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` now verifies transport identity continuity (`boundAddress`/`boundPort`) across:
  - `pre-login`
  - `warming`
  - `ready`
  - `failed`
- `electron/main/tests/MainPreLoginControlPlaneHostStartup.test.ts` now verifies bind-once host reuse semantics remain explicit in `ensureDesktopControlPlaneHostBound(...)` via:
  - persisted runtime reuse path,
  - bind-start/bind-ready transition reasons,
  - reuse transition reason (`authoritative-host-bind-reused`).
- `electron/main/tests/MainDeferredRuntimeStartupBoundary.test.ts` now verifies post-login warmup capability activation does not trigger listener rebinding by asserting warmup flow excludes transport rebinding markers and bind/start entrypoints.

Contract intent:

- capability lifecycle transitions must not be modeled as transport outages,
- the desktop session retains one authoritative listener identity while runtime capabilities warm and fail/retry,
- tests fail if stop-and-rebind behavior is introduced into warmup pathways.

## Story 1.3.2 activation idempotency and join semantics

- `PostLoginRuntimeActivationService` now uses explicit activation states (`idle`, `activating`, `ready`) instead of implicit socket-lifecycle assumptions.
- Concurrent warmup requests always join one in-flight activation promise regardless of trigger source (`explicit-login`, `session-restore`, `session-refresh`, `feature-demand`).
- Once activation reaches `ready`, repeated warmup requests are explicit no-ops and must not re-activate capabilities, restart connectivity monitoring, or restart dependency activation.
- On activation failure, state returns to `idle` so subsequent warmup requests can retry through the same lifecycle contract.

## Story 1.2.2 runtime route-family registration continuity

Desktop control-plane host startup now composes runtime route families at initial host bind instead of relying on post-login host replacement:

- `electron/main/main.ts` uses `composeDesktopAuthoritativeServerApiRouteRegistrationPlan()` when bootstrapping the authoritative host.
- runtime route-family registration remains continuous across pre-login, warming, and ready phases.
- lifecycle-aware capability gating continues to block deferred runtime families before activation with explicit unavailable responses.
- non-desktop startup paths keep default route-plan behavior unless they explicitly request runtime route-family inclusion.

## Story 1.2.4 backend runtime-state authority wiring

- Backend runtime capability guarding now reads desktop lifecycle state from the same post-login runtime status store used by auth IPC (`postLoginRuntimeStatusStore.getStatus()`).
- Authoritative server host composition projects that status source into route-family availability resolution so runtime guarded families evaluate availability from `capabilityPhase` (`pre-login` -> `warming` -> `ready` -> `failed`) instead of a duplicate backend-only lifecycle model.
- Capability activation remains the registration/ownership seam for deferred route families, while lifecycle gating state is now sourced from the authoritative desktop runtime lifecycle contract.

## Story 1.2.6 runtime read/mutation guard consistency

- Runtime lifecycle guarding now resolves endpoint-aware route-family intent for overlapping runtime prefixes before evaluating availability.
- Guarded runtime lifecycle responses now cover:
  - run submission (`/api/v1/runtime/runs/start`, image-system run submission),
  - run reads (run list/detail/status, queue reads),
  - run mutations (cancel/retry, queue dequeue),
  - image runtime routes that depend on deferred runtime activation.
- Non-ready runtime requests now consistently return structured runtime-unavailable payloads (`RuntimeGuardedEndpointUnavailableResponseContract`) instead of falling back to generic route-family errors.
- Readiness-state bypass remains limited to execution-readiness reads so lifecycle status can still be observed while other runtime read/mutation endpoints stay explicitly guarded.

## Story 1.2.7 typed diagnostics for blocking runtime dependencies

- Runtime lifecycle blocking responses now include typed diagnostics in `RuntimeAvailabilityResponseContract.diagnostics` with stable renderer-safe fields:
  - `lifecycleState`
  - `blockingDependencyCategory`
  - `retryable`
  - optional `summary`, `routeFamilyId`, `capabilityId`, `lifecyclePhase`, and `transportPhase`
- Blocking dependency categories are normalized to controlled values:
  - `authentication`
  - `capability-activation`
  - `runtime-supervisor`
  - `control-plane-transport`
  - `unknown`
- Desktop route-family availability now carries runtime lifecycle snapshots sourced from authoritative post-login runtime status (capability phase + transport/supervisor indicators) instead of placeholder guard metadata.
- Runtime capability guard mapping now derives diagnostics from those lifecycle snapshots so responses identify whether blocking is caused by auth/session phase, capability activation warmup, runtime supervisor failure, or control-plane transport state.
- Execution readiness state-driven bypass surfaces the same typed lifecycle diagnostics in both `runtimeLifecycle` and readiness-level diagnostics, preserving observability without leaking internal error internals.

## Story 1.3.3 Python runtime resolution activation stage

- Python runtime resolution is now an explicit post-login activation stage owned by `electron/main/runtime/PythonRuntimeResolutionActivationStage.ts`.
- Stage lifecycle reporting is surfaced through `DesktopPostLoginRuntimeStatus.activationStages` with explicit `pending` -> `running` -> `ready|blocked` transitions for `python-runtime-resolution`.
- `PostLoginRuntimeDependencyActivator` now executes Python resolution through that stage wrapper, preserving existing packaged and development resolver behavior while adding explicit stage-level observability and error reporting.
- Route-family runtime lifecycle snapshots now include activation-stage status so backend runtime capability guard responses can report when Python runtime resolution is currently blocking readiness.
- Guard diagnostics now expose optional stage-level blocking fields (`blockingActivationStageId`, `blockingActivationStageState`, `blockingActivationStageDetail`) without changing existing runtime availability contract versioning.
- Regression coverage now includes:
  - `electron/main/tests/PythonRuntimeResolutionActivationStage.test.ts` for successful and blocked resolution paths.
  - `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` stage transition/read-model coverage.
  - `src/infrastructure/transport/http-server/identity/tests/RuntimeCapabilityGuardMiddleware.test.ts` stage-aware blocking diagnostics.

## Story 1.3.4 service supervisor activation stage

- Service supervisor startup is now an explicit post-login activation stage owned by `electron/main/runtime/ServiceSupervisorActivationStage.ts`.
- Stage lifecycle reporting is surfaced through `DesktopPostLoginRuntimeStatus.activationStages` with explicit `pending` -> `running` -> `ready|blocked` transitions for `service-supervisor-startup`.
- Supervisor readiness now records explicit stage detail including both `baseUrl` and `runtimeBaseUrl`.
- Supervisor startup failures now flow through runtime lifecycle failure state while preserving the already-bound control-plane listener transport.
- Regression coverage now includes:
  - `electron/main/tests/ServiceSupervisorActivationStage.test.ts` for supervisor-ready and supervisor-blocked startup behavior.
  - `electron/main/tests/PostLoginRuntimeActivationService.test.ts` listener-preservation behavior when supervisor startup fails.
  - `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` service-supervisor stage read-model coverage.

## Story 1.3.5 deferred runtime registration staged behind capability lifecycle

- Deferred runtime warmup now treats deferred feature registration as three explicit activation stages instead of one opaque tail step:
  - `deferred-feature-runtime-composition`
  - `deferred-feature-provider-setup`
  - `deferred-feature-ipc-registration`
- Stage ordering is now explicit in `DesktopPostLoginWarmupSequence`:
  1. `python-runtime-resolution`
  2. `service-supervisor-startup`
  3. `deferred-feature-runtime-composition`
  4. `deferred-feature-provider-setup`
  5. `deferred-feature-ipc-registration`
- `PostLoginRuntimeDependencyActivator` now drives status transitions for those three stages using the same `DesktopPostLoginRuntimeStatusStore` lifecycle contract already used by backend runtime capability guarding.
- Deferred IPC readiness now derives from the lifecycle status channel (`state === ready`) rather than a disconnected dedicated boolean.
- Failure paths for deferred runtime composition, provider setup, and IPC registration now mark their own activation stage as `blocked` before surfacing runtime-level failure.
- Regression coverage now includes:
  - `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` readiness transition coverage through deferred registration stages.
  - `electron/main/tests/DesktopStartupContract.test.ts` ordering coverage for the expanded activation-stage sequence.
  - `electron/main/tests/MainPostLoginRuntimeComposition.test.ts` orchestration-structure coverage for deferred stage transitions in the activator.

## Story 1.3.6 retryable failed activation state

- Post-login activation failure handling now distinguishes recoverable dependency failures from fatal activation failures.
- Recoverable dependency activation failures now:
  - transition runtime lifecycle state to `failed`,
  - preserve bound control-plane listener transport continuity,
  - mark `failure.retryable: true`,
  - clean up partially activated deferred runtime artifacts so a subsequent explicit warmup request can retry cleanly.
- Fatal activation failures now:
  - transition runtime lifecycle state to `failed`,
  - mark `failure.retryable: false`,
  - preserve existing safety behavior by disposing desktop runtime resources and exiting the process.
- Explicit retry contract:
  - retry continues to flow through `startPostLoginWarmup(...)` using the same warmup trigger channel,
  - failed+retryable state remains visible through runtime status probes and renderer gating until retry succeeds.
- Regression coverage now includes:
  - `electron/main/tests/PostLoginRuntimeActivationService.test.ts` initial recoverable failure followed by successful explicit retry.
  - `electron/main/tests/DesktopPostLoginRuntimeStatusStore.test.ts` non-retryable failure metadata projection.

## Story 1.3.7 startup and activation diagnostics

- Post-login activation now emits structured startup diagnostics for each activation stage boundary with consistent `[ai-loom][startup]` event fields.
- Stage diagnostics now cover:
  - `desktop.post-login-activation.stage.started`
  - `desktop.post-login-activation.stage.completed`
  - `desktop.post-login-activation.stage.blocked`
- Warmup lifecycle diagnostics now cover:
  - `desktop.post-login-activation.warmup.requested`
  - `desktop.post-login-activation.warmup.started`
  - `desktop.post-login-activation.warmup.ready`
  - `desktop.post-login-activation.warmup.failed`
  - `desktop.post-login-activation.warmup.joined-inflight`
  - `desktop.post-login-activation.warmup.ignored-ready`
- Stage completion and failure diagnostics include `durationMs`, `startedAt`, and `endedAt` so activation timing regressions can be measured directly from logs.
- Stage start diagnostics include `dependencies` and `blockingDependency`, and blocked diagnostics include `errorName`, `errorMessage`, and optional `errorCause` so blocking dependency and failure cause are explicit.
- Warmup failure diagnostics include `retryable`, `preserveControlPlaneListener`, and `blockingStageId` so operators can distinguish recoverable activation-stage failures from fatal activation failures.
- Canonical implementation seams:
  - `electron/main/runtime/PostLoginActivationDiagnostics.ts`
  - `electron/main/runtime/PythonRuntimeResolutionActivationStage.ts`
  - `electron/main/runtime/ServiceSupervisorActivationStage.ts`
  - `electron/main/runtime/PostLoginRuntimeDependencyActivator.ts`
  - `electron/main/runtime/PostLoginRuntimeActivationService.ts`

## Story 1.3.8 activation lifecycle and retry integration coverage

- Integration coverage now verifies deferred runtime route behavior across a full activation lifecycle with retry on the same bound listener identity.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerAuthoritativeRunReadApi.test.ts` now covers:
  - `pre-login` -> `warming` -> `failed` -> `warming` (explicit retry) -> `ready` lifecycle progression,
  - readiness route lifecycle projection (`GET /api/v1/runtime/execution/readiness`) at each state,
  - guarded submission route lifecycle projection (`POST /api/v1/runtime/runs/start`) while unavailable and successful submission once ready/authenticated.
- Regression intent:
  - runtime lifecycle state transitions must continue to surface as explicit HTTP lifecycle payloads (not socket-level outages),
  - activation failure and retry must preserve listener reachability and lifecycle-aware route semantics until runtime reaches `ready`.

## Story 1.2.8 route-level no-connection-refusal startup regression coverage

- Runtime startup regression coverage now explicitly protects route-level listener continuity during capability transitions.
- Integration coverage asserts runtime endpoints return structured lifecycle payloads during startup transitions instead of socket-level connection refusal.
- Coverage scope includes:
  - execution readiness route (`GET /api/v1/runtime/execution/readiness`),
  - runtime submission route (`POST /api/v1/runtime/runs/start`).
- Pre-login and warming requests must continue to receive canonical lifecycle-aware HTTP responses (`200` readiness payloads and guarded `503` unavailable payloads) while the same control-plane listener remains reachable.
- Regression intent is encoded in test naming so failures clearly indicate listener continuity or runtime route-registration regressions.

## Deferred API behavior
- before readiness:
  - async deferred APIs reject with explicit unavailable errors,
  - sync deferred APIs throw explicit unavailable errors,
  - workflow persistence status returns degraded deferred payload.
- after readiness:
  - deferred API calls route through registered feature IPC handlers.

## Failure behavior
- warmup/bootstrap failure transitions lifecycle to `failed` with:
  - failure message
  - failure timestamp
  - retryable flag
- failures remain visible through status probe and main-process logs.

## Teardown/reset behavior
- app quit / host stop:
  - transition to `unavailable(shutting-down)` before disposal
  - dispose runtime resources
  - reset to `unavailable(pre-login)` for clean bootstrap baseline
- logout contract target:
  - dispose/reset post-login runtime while retaining auth-shell
  - transition to `unavailable(logged-out)`
  - allow next session to re-trigger warmup via auth-success or lazy feature demand

## Related implementation seams
- `electron/main/main.ts`
- `electron/main/AuthBootstrapIpcRegistration.ts`
- `electron/preload.ts`
- `electron/shared/DesktopContracts.ts`
- `src/ui/runtime/DesktopPostLoginWarmup.ts`
- `src/ui/App.tsx`
