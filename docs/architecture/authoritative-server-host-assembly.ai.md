# AI Companion: Authoritative Server Host Assembly

## Purpose
- Define the production authoritative server host assembly as the executable control-plane boundary.
- Keep host code focused on composition/startup while business logic remains in src/application/domain layers.

## Main implementation seams
- Composition root: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- Runtime host startup implementation: `src/hosts/server/IdentityServerHost.ts`
- Authoritative persistence composition seam: `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- Route registration composition seam: `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`

## Control-plane ownership
- Authoritative server is the single runtime with control-plane authority.
- Composition explicitly covers identity, device trust, node trust, workspace administration metadata, scheduling/orchestration policy, storage policy metadata, audit hooks, and thin-client transport APIs.
- Startup asserts dependency and required-service coverage before runtime start.

## Startup expectations
- Shared bootstrap pipeline order remains authoritative: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Entrypoint default startup reason: `authoritative-server-entrypoint-startup`.
- Entrypoint default required dependencies: full authoritative dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Environment keys:
  - `AI_LOOM_SERVER_DATABASE_PATH`
  - `AI_LOOM_SERVER_HOST`
  - `AI_LOOM_SERVER_PORT`
  - `AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH`
  - `AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE`
  - `AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS`
  - `AI_LOOM_COMFYUI_ADAPTER_ENABLED`
  - `AI_LOOM_COMFYUI_BASE_URL`
  - `AI_LOOM_COMFYUI_REQUEST_TIMEOUT_MS`
  - `AI_LOOM_COMFYUI_CAPABILITY_PROBE_ON_STARTUP`
  - `AI_LOOM_COMFYUI_REQUIRED_NODE_TYPES`
  - `AI_LOOM_COMFYUI_AUTH_TOKEN`
- Script-mode behavior:
  - starts host
  - logs runtime address/phase
  - handles `SIGINT`/`SIGTERM` for graceful stop
  - exits non-zero on startup failure
- Persistence lifecycle behavior:
  - `persistence` stage initializes `src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`
  - `persistence` stage composes authoritative persistent platform services (repository adapters, audit sinks, platform run/audit adapter) and stores them as startup artifacts
  - `feature-registration` stage injects startup-composed persistence services into `startIdentityServerHost(...)`
  - startup failure cleanup disposes persistence runtime resources
  - normal host stop disposes persistent platform services and persistence runtime resources
- Repository command: `npm run start:authoritative-server`

## Authoritative API route registration
- Shared route-registration contracts and catalog:
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- Domain route family modules:
  - `src/infrastructure/transport/http-server/authoritative-route-families/*`
- Startup behavior:
  - `dependencies` stage composes route registration artifact
  - `dependencies` stage also composes optional ComfyUI execution adapter infrastructure artifact when Comfy adapter config is enabled
  - `dependencies` stage composes authoritative run-execution adapter registration (`src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`) that resolves:
    - run dispatch port registration
    - run cancellation signal port via Comfy cancellation bridge (`src/infrastructure/execution/runs/ComfyUiRunExecutionCancellationSignalAdapter.ts`)
  - `feature-registration` stage asserts authoritative required route-family coverage before transport start
  - `feature-registration` stage injects composed run-execution adapter registration into `startIdentityServerHost(...)`

## Entrypoint consumers
- `electron/main/main.ts` now delegates desktop local control-plane startup through `startAuthoritativeServerHostAssembly(...)`.
- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts` now delegates browser-development local control-plane startup through `startAuthoritativeServerHostAssembly(...)`.

## Tests
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/server/tests/AuthoritativeServerHostEntrypoint.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`
