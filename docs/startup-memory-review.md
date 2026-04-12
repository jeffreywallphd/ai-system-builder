# Startup Memory Review (Electron + Node)

## Scope and method

This review is based on static inspection of startup code paths in Electron main process and renderer composition. It identifies objects, services, caches, and module loading patterns that are allocated eagerly at startup and likely contribute to high baseline RAM usage.

## Executive summary

Your observed footprint (roughly ~1.0 GB Node/electron combined) is plausible with the current startup architecture. The app eagerly initializes a very large dependency graph in both the Electron main process and the renderer process before users navigate to most features.

The biggest contributors are:

1. **Eager process startup in main** (service supervisor + authoritative server + many repositories/APIs at boot).
2. **Eager renderer dependency graph construction** (`createUiDependencies`) that instantiates many services/stores/use-cases immediately.
3. **Eager route/page imports** in router (large page modules loaded up front instead of on-demand).
4. **In-memory caches/buffers** (registry cache, runtime logs/events, graph projection sink) that retain data for process lifetime.
5. **Seed workflow + node catalog work done at import-time** in `seedWorkflows.ts` (including top-level async catalog loading).

## What is stored in memory at startup (and why)

### 1) Electron main process startup allocations

- `bootstrapDesktopRuntime()` initializes desktop storage, resolves Python runtime, starts service supervisor, starts authoritative server host, creates bootstrap context, starts connectivity monitor, and registers many IPC handlers.
- It then constructs multiple repositories/APIs at startup (workflow persistence, execution runs, run summaries, agent repos, studio shell APIs, system runtime APIs, canonical asset APIs, registry APIs).

Why this is expensive: these are long-lived singleton objects with internal state and DB handles, kept for the full process lifetime.

### 2) Renderer dependency graph is fully constructed on first render

- `AppProviders` calls `createUiDependencies()` in `useMemo`, and that function eagerly builds a large object graph:
  - runtime clients/managers/orchestrators
  - workflow execution infrastructure
  - model and MCP services
  - context/tuning/training services
  - multiple stores and auxiliary services
- This happens regardless of whether user visits pages that need those features.

Why this is expensive: many service instances + transitive imports are retained by stores/context and become effectively permanent.

### 3) Router eagerly imports almost every page module

- `AppRouter.tsx` imports a long list of page modules directly.
- This pattern forces heavy route modules into initial renderer bundle/memory instead of code-splitting by route.

Why this is expensive: large UI modules are parsed/compiled/retained immediately even when user only uses a small subset.

### 4) Seed workflow and node-catalog work occurs at module import time

- `seedWorkflows.ts` imports JSON workflow seeds and creates catalog helpers.
- It performs top-level async work to build `SEED_NODE_DEFINITION_INDEX` from full node definitions.
- `createUiDependencies.ts` imports `createSeedWorkflows`, so this overhead can appear even before fallback path is needed.

Why this is expensive: static import + top-level initialization moves non-essential data prep into startup critical path.

### 5) Intentional in-memory retention structures

- Main process creates `InMemoryAssetLineageGraphProjectionSink` (stores edges/transformations arrays in memory).
- Main process creates `RegistryCacheLayer` with up to 300 entries per namespace.
- Renderer uses `RuntimeEventBuffer` capacity 500 and runtime console logs default capacity 250.

Why this is expensive: retained caches improve responsiveness but increase baseline and peak heap, especially after longer sessions.

## Why responsiveness/load may degrade on low-RAM machines

1. High baseline memory leaves little headroom; OS starts compressing/paging.
2. Startup does many synchronous/eager operations before UI settles.
3. Once pressure rises, GC and paging pauses increase perceived “hangs”.
4. Multiple processes (main + renderer + helper + Python/runtime) compound total resident set.

## RAM minimization recommendations (ordered by impact)

## A. High impact / low-to-medium risk

1. **Route-level lazy loading for pages**
   - Convert page imports in `AppRouter.tsx` to `React.lazy` + suspense boundaries.
   - Goal: load only active route code.
   - Expected benefit: significantly lower renderer startup memory and parse/compile cost.

2. **Split `createUiDependencies` into feature modules loaded on demand**
   - Build “core dependencies” for shell/login/home first.
   - Lazily initialize heavy domains (training, dataset generation, MCP tooling, registry graph analysis, canonical asset management) when corresponding page is opened.
   - Expected benefit: lower initial heap and faster interactivity.

3. **Defer main-process subsystem construction until first IPC call**
   - Keep minimal boot services only.
   - Initialize registry/canonical asset subsystem only when a registry IPC endpoint is first requested.
   - Expected benefit: lower main-process baseline and faster boot.

## B. High impact / medium risk

4. **Move `seedWorkflows` heavy initialization behind explicit call**
   - Avoid top-level async/catalog construction at module load.
   - Load seed JSON and build node-definition index only if fallback storage path is actually selected.
   - Expected benefit: immediate startup path memory/time reduction.

5. **Isolate heavyweight features into utility process / worker**
   - Registry graph traversal, projection rebuild/verification, and expensive dataset/model operations can run outside renderer/main heaps.
   - Expected benefit: protects UI responsiveness under pressure.

## C. Medium impact / low risk

6. **Tune cache and log retention for low-memory mode**
   - Add runtime profile (e.g., `memoryMode=low`) reducing:
     - `RegistryCacheLayer` max entries
     - `RuntimeEventBuffer` capacity
     - runtime console log capacity
   - Expected benefit: lower long-session memory growth.

7. **Conditional devtools opening**
   - In development, `mainWindow.webContents.openDevTools` is called automatically for main window.
   - Gate this by explicit env flag to avoid accidental memory expansion while testing on low-RAM systems.

## D. Validation/observability improvements (recommended)

8. **Add startup memory checkpoints**
   - Log `process.memoryUsage()` after major startup phases (storage init, supervisor start, authoritative server start, renderer boot complete, dependency graph build).

9. **Add per-feature memory delta instrumentation**
   - Track heap before and after opening heavy pages (Studio, Registry, Training, MCP).
   - Enables data-driven prioritization.

## Suggested phased plan

### Phase 1 (quick wins)
- Lazy route imports.
- Feature-gate devtools opening.
- Add low-memory cache/log caps.
- Add startup memory checkpoints.

### Current implementation status (April 10, 2026)
- ✅ Route-level lazy loading has been implemented in `src/ui/routes/AppRouter.tsx`.
- ✅ `createUiDependencies` has been split so several heavier feature groups are initialized on first access (context, tuning-dataset, model-training, canonical-asset management), rather than all at initial composition time.
- ✅ Additional lazy initialization now includes execution-history and tool-store surfaces in `createUiDependencies`.
- ✅ Startup memory checkpoints have been added in Electron main bootstrap and UI composition logging to improve memory tracking.
- ✅ Workflow executor/runtime orchestration now uses lazy executor construction so strategy graph initialization is deferred until execution is requested.
- ⏳ Remaining high-impact work: further defer execution application infrastructure assembly and MCP manager wiring behind explicit demand boundaries.

### Phase 2 (structural)
- Refactor `createUiDependencies` into lazy feature containers.
- Defer main-process registry/canonical subsystem initialization.
- Remove top-level init work from `seedWorkflows`.

### Phase 3 (advanced)
- Move graph-heavy or long-running functionality to utility/worker process.
- Add adaptive memory policy (auto low-memory mode under pressure).

## Key files reviewed

- `electron/main/main.ts`
- `electron/main/DesktopServiceSupervisor.ts`
- `src/ui/composition/AppProviders.tsx`
- `src/ui/composition/createUiDependencies.ts`
- `src/ui/routes/AppRouter.tsx`
- `src/ui/composition/seedWorkflows.ts`
- `src/infrastructure/filesystem/InMemoryAssetLineageGraphProjectionSink.ts`
- `src/application/asset-registry/RegistryCacheLayer.ts`
- `src/application/runtime/RuntimeEventBuffer.ts`
- `src/ui/state/RuntimeConsoleStore.ts`
