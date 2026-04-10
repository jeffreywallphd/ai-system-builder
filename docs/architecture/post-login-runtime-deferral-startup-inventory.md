# Desktop Startup Eager Service and Repository Inventory

Feature: C  
Epic: C.1  
Story: C.1.2

## Purpose

Provide an implementation inventory of desktop services, repositories, backend APIs, and monitors that are currently initialized on startup paths so post-login and on-demand deferral work can proceed without re-analysis.

This note complements `docs/architecture/post-login-runtime-deferral-boundary.md` by documenting concrete constructors/factories, current call sites, startup category classification, and dependency sequencing.

## Source files reviewed

- `docs/general-prompt-guidance.md`
- `docs/architecture/post-login-runtime-deferral-boundary.md`
- `electron/main/main.ts`
- `electron/main/DeferredDesktopFeatureRuntime.ts`
- `electron/main/DesktopServiceSupervisor.ts`
- `src/hosts/desktop/DesktopConnectivityStateService.ts`

## Startup category legend

- `must remain pre-login`
- `start after login`
- `lazy/on-demand`
- `eliminate or simplify`

## Inventory by concrete implementation

| Responsibility | Concrete constructors/factories | Current call site | Current initialization timing | Startup category | Dependency notes |
| --- | --- | --- | --- | --- | --- |
| Pre-login storage bridge for auth/session/secrets | `new DesktopStorageDatabase(...)`; `new InitializeProductionStorageUseCase(storageDatabase).execute({ scope: authShellPreLogin })` | `bootstrapAuthShell()` in `electron/main/main.ts:587`, constructor at `:596`, initializer at `:597` | Before main window | must remain pre-login | Required by auth bootstrap IPC storage/secrets bridge and trusted-session bootstrap reads. |
| Auth-minimal identity host runtime | `startAuthMinimalServerHostAssembly(...)` | `bootstrapAuthShell()` in `electron/main/main.ts:607` | Before main window | must remain pre-login | Produces `identityApiBaseUrl` used by auth shell + connectivity probe. |
| Connectivity monitor state service | `new DesktopConnectivityStateService()` + `.startMonitoring(createDesktopConnectivityProbePort(...))` | `bootstrapAuthShell()` in `electron/main/main.ts:647-648`; monitor implementation in `src/hosts/desktop/DesktopConnectivityStateService.ts:87,169` | Before main window | must remain pre-login | Depends on identity host address and storage session keys; preserves offline/auth diagnostics in login shell. |
| Full runtime storage provisioning | `new InitializeProductionStorageUseCase(storageDatabase).execute({ scope: fullRuntime })` | `bootstrapPostLoginRuntime(...)` in `electron/main/main.ts:736` | Post-login warmup | start after login | Requires pre-login storage database instance; enables runtime/assets/models directories for feature infra. |
| Service supervisor and managed runtime process | `new DesktopServiceSupervisor(...)`; `serviceSupervisor.start()` | `bootstrapPostLoginRuntime(...)` in `electron/main/main.ts:741` and `:749` (start); class in `electron/main/DesktopServiceSupervisor.ts` | Post-login warmup | start after login | Depends on full storage provisioning and Python runtime resolution in same function. |
| Deferred runtime container instantiation | `createDeferredDesktopFeatureRuntime({ ... })` | `bootstrapPostLoginRuntime(...)` in `electron/main/main.ts:779` | Post-login warmup | eliminate or simplify | Container object itself is light, but this still eagerly allocates a cross-feature activation root; can be lazily created per first deferred feature call if warmup scope is narrowed further. |
| Non-auth IPC registration gate | `registerDeferredFeatureIpc(() => { ...ipcMain.on/handle... })` | `bootstrapPostLoginRuntime(...)` in `electron/main/main.ts:788`; guard function at `:664` | Post-login warmup | eliminate or simplify | Current monolithic registration binds many feature surfaces at once; split into activation groups to avoid broad warmup coupling. |
| Workflow persistence runtime | Factory `createWorkflowPersistence(...) -> new DesktopWorkflowPersistence(...)`; runtime `ensureWorkflowPersistence()` | Factory in `electron/main/DeferredDesktopFeatureRuntime.ts:96`; ensure at `:215`; usage via IPC in `electron/main/main.ts:792-808` | First workflow IPC use after post-login registration | lazy/on-demand | Independent from studio/system runtime backends except shared storage paths/runtime config. |
| Execution run repository and history use cases | `createExecutionRunRepository(...)`; `createExecutionHistoryInfrastructure(...)`; `new GetExecutionRunUseCase(...)`; runtime `ensureExecutionHistory()` | Factories at `electron/main/DeferredDesktopFeatureRuntime.ts:101-107`; ensure at `:226`; usage in `electron/main/main.ts:810-823` | First execution-run IPC use | lazy/on-demand | Shares same `storagePaths.databasePath`; no dependency on studio/system backend APIs. |
| Workflow run summary repository | `new SqliteWorkflowRunSummaryRepository(...)`; `new ListWorkflowRunSummariesUseCase(...)`; runtime `ensureWorkflowRunHistory()` | Factory at `electron/main/DeferredDesktopFeatureRuntime.ts:113`; ensure at `:242`; usage in `electron/main/main.ts:825-847` | First workflow-run IPC use | lazy/on-demand | This repository is an upstream dependency for studio-shell dependency assembly. |
| Studio-shell repository and workflow persistence repo | `new SqliteStudioShellRepository(...)`; `new SqliteWorkflowPersistenceRepository(...)`; runtime `ensureStudioDependencies()` | Factory methods at `electron/main/DeferredDesktopFeatureRuntime.ts:119,122`; ensure at `:256` | First studio/system runtime feature use | lazy/on-demand | `ensureStudioDependencies()` internally depends on `ensureWorkflowRunHistory()` for shared run-summary repo. |
| Image persistence adapters/infrastructure | `new SqliteImageRunHistoryRepository(...)`; `new SqliteImageWorkflowSystemPersistenceAdapter(...)`; `new LocalStorageInstanceProvisioner(...)`; `new LocalSystemOutputArtifactStorage(...)`; `new LocalStorageInstanceLifecycleInfrastructure(...)` | Factories at `electron/main/DeferredDesktopFeatureRuntime.ts:125,128,138,141,144`; assembled for Studio Shell API at `:131` | First studio-shell/system feature use | lazy/on-demand | Part of studio/system dependency graph; should move with StudioShell/System runtime backends to preserve behavior. |
| Studio shell backend API | `new StudioShellBackendApi(...)`; runtime `ensureStudioShellBackendApi()` | Factory at `electron/main/DeferredDesktopFeatureRuntime.ts:131`; ensure at `:307`; used by studio-shell IPC in `electron/main/main.ts:932-1117` | First studio-shell IPC use | lazy/on-demand | Depends on `ensureStudioDependencies()` and storage infrastructure adapters above. |
| System studio backend API | `new SystemStudioBackendApi(repository)`; runtime `ensureSystemStudioBackendApi()` | Factory at `electron/main/DeferredDesktopFeatureRuntime.ts:152`; ensure at `:318`; used via system-definition/system-component IPC routes in `electron/main/main.ts` | First system-studio IPC use | lazy/on-demand | Depends on shared studio repository from `ensureStudioDependencies()`. |
| System runtime backend API and execution/audit stores | `new SqliteSystemRuntimeExecutionStore(...)`; `new SqliteExecutionAuditRepository(...)`; `new SystemRuntimeBackendApi(...)`; runtime `ensureSystemRuntimeBackendApi()` | Factories at `electron/main/DeferredDesktopFeatureRuntime.ts:155,158,161`; ensure at `:325`; used by system-runtime IPC and canonical registry composition | First system-runtime IPC use (or canonical-registry first use) | lazy/on-demand | Depends on `ensureSystemRuntimeDependencies()` which depends on `ensureStudioDependencies()`. |
| Canonical registry runtime | `new SqliteAssetSystemRepository(...)` + dynamic imports + registry use cases + `new RegistryBackendApi(...)` | `ensureCanonicalRegistryRuntime(...)` in `electron/main/main.ts:347`; repository creation at `:398`; IPC usage `:1198-1381` | First canonical assets/registry IPC use | lazy/on-demand | Hard dependency on deferred runtime `ensureSystemRuntimeBackendApi()` and `ensureWorkflowPersistenceRepository()`. |
| Agent runtime repositories and backend API | `new SqliteAgentRepository(...)`; `new SqliteAgentExecutionSessionRepository(...)`; `new SqliteAssetSystemRepository(...)`; `new AgentStudioBackendApi(...)` | `ensureAgentStudioBackendApi(...)` in `electron/main/main.ts:213`; constructors at `:219-221,226`; IPC usage `:849-929` | First agent IPC use | lazy/on-demand | Depends on agent runner graph and storage paths; independent from studio/system/canonical runtime chain. |

## Key dependency relationships for refactor sequencing

### Group A: Auth-shell pre-login hard boundary

- `DesktopStorageDatabase(authShellPreLogin)` -> auth bootstrap IPC storage/secrets and trust bootstrap reads.
- `startAuthMinimalServerHostAssembly(...)` -> `identityApiBaseUrl` -> connectivity probe port and renderer auth bootstrap.
- `DesktopConnectivityStateService.startMonitoring(...)` depends on identity host and session storage reads.

These three should move together only if the login UX contract changes; otherwise keep fixed pre-login.

### Group B: Post-login runtime prerequisites

- `InitializeProductionStorageUseCase(...fullRuntime)` must complete before supervisor or feature paths requiring runtime/assets/models directories.
- `DesktopServiceSupervisor.start()` depends on full storage + Python runtime resolution.
- `registerDeferredFeatureIpc(...)` currently assumes post-login prerequisites have run.

If warmup is narrowed further, split registration so only minimal readiness plumbing remains here.

### Group C: Feature runtime chain rooted at `DeferredDesktopFeatureRuntime`

- `ensureWorkflowRunHistory()` is upstream for `ensureStudioDependencies()`.
- `ensureStudioDependencies()` is upstream for:
  - `ensureStudioShellBackendApi()`
  - `ensureSystemStudioBackendApi()`
  - `ensureSystemRuntimeDependencies()` -> `ensureSystemRuntimeBackendApi()`.
- Image persistence adapters are created inside studio/system dependency assembly; they should move with that group.

This chain should be deferred/activated as a unit when splitting studio/system features.

### Group D: Cross-feature lazy runtimes

- Canonical registry runtime depends on:
  - `deferredFeatureRuntime.ensureSystemRuntimeBackendApi()`
  - `deferredFeatureRuntime.ensureWorkflowPersistenceRepository()`.
- Agent runtime (`ensureAgentStudioBackendApi`) is independent of canonical registry and studio/system runtime chains except shared storage roots.

Canonical registry cannot be activated before the system runtime + workflow persistence repository seam is available.

## Sequencing guidance for follow-on stories

1. Keep Group A unchanged as pre-login baseline.
2. Keep Group B minimal and move non-essential handler registration out of post-login warmup.
3. Split Group C IPC registration by activation families so first-use initialization remains localized.
4. Preserve Group D laziness; do not regress canonical/agent runtimes to eager startup.

## Explicit simplify/eliminate candidates

- Monolithic `registerDeferredFeatureIpc` registration block in `electron/main/main.ts:788-1388` should be segmented by feature activation group.
- Eager creation of the deferred runtime container object in post-login warmup (`electron/main/main.ts:779`) can be moved behind first deferred feature request if warmup needs further reduction.
