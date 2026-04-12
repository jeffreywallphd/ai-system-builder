# Authoritative Server Host Assembly

## Purpose

Define the concrete authoritative server executable host assembly that serves as AI Loom's single control-plane runtime composition boundary.

The host assembly is responsible for runtime composition and startup orchestration only. Business logic remains in application services and domain contracts.

## Runtime authority stance

- The authoritative server host is the only runtime with control-plane authority (`host:server:authoritative`).
- Desktop, hybrid, web, and worker hosts are non-authoritative clients or execution surfaces.
- Control-plane authority and node execution remain separate concerns by contract.

## Composition root and entrypoint

- Composition root: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- Dedicated entrypoint assembly: `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- Runtime host implementation composed by the root: `src/hosts/server/IdentityServerHost.ts`
- Authoritative persistence composition seam: `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

The entrypoint composes and starts the host through:
1. `constructAuthoritativeServerHostAssembly(...)`
2. `startAuthoritativeServerHostAssembly(...)`

Story B.2.1 also introduces an auth-minimal startup entrypoint for pre-login desktop bootstrap:

- `src/hosts/server/AuthMinimalServerHostEntrypoint.ts`
- `src/hosts/server/AuthMinimalIdentityServerHost.ts`

This path still uses the shared authoritative host lifecycle/startup pipeline, but narrows route registration and startup persistence composition to auth-critical concerns.

## Control-plane composition responsibilities

The authoritative host composition explicitly wires control-plane coverage for:
- identity
- trusted devices
- node trust
- workspace metadata and administration
- scheduling and orchestration policy
- storage metadata and policy
- audit and observability hooks
- thin-client API transport delivery

The host validates startup dependency coverage and authoritative service coverage before starting runtime transport.

## Authoritative API route composition

- Host-level route composition seam: `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- Auth-minimal route composition seam: `src/hosts/server/AuthMinimalServerApiRouteComposition.ts`
- Shared transport route registration catalog:
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistration.ts`
  - `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
  - domain route family modules in `src/infrastructure/transport/http-server/authoritative-route-families/*`

During authoritative startup, the `dependencies` stage composes an API route registration plan artifact and the `feature-registration` stage validates required route-family coverage before runtime host transport starts.
The top-level HTTP server composition (`createIdentityHttpServer`) now consumes this registration plan through its route-module registry and supports per-route-family modular handlers with explicit legacy fallback.
Top-level websocket upgrade entry wiring is isolated in `src/infrastructure/transport/http-server/identity/composition/IdentityHttpUpgradeBoundary.ts`, separating upgrade dispatch from standard HTTP route handling.
This creates a hybrid migration seam where modular route-family dispatch can be introduced incrementally while unmatched or declined routes continue through existing monolithic handlers.

The same `dependencies` stage now also composes optional ComfyUI execution adapter infrastructure (transport client + run-dispatch adapter + cancellation adapter + capability probe adapter + output discovery collector) as a host startup artifact when Comfy adapter config is enabled.

The dependencies stage additionally composes authoritative run-execution adapter registration (`src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`) so higher layers can resolve:
- a run-dispatch port with registered backend adapters
- a run-cancellation signal port backed by the Comfy cancellation adapter bridge (`src/infrastructure/execution/runs/ComfyUiRunExecutionCancellationSignalAdapter.ts`)

Story B.2.2 introduces a dedicated auth-minimal route registration plan and coverage assertion:
- `composeAuthMinimalServerApiRouteRegistrationPlan(...)` now lives in `src/hosts/server/AuthMinimalServerApiRouteComposition.ts`.
- `assertAuthMinimalServerApiRouteRegistrationCoverage(...)` validates only the auth-minimal required route-family list (`identity-auth`).
- Full authoritative route registration and full coverage assertion remain in `src/hosts/server/AuthoritativeServerApiRouteComposition.ts` for authoritative startup mode.

Story B.2.4 narrows auth-minimal dependencies composition further:
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` now supports `bootstrap.executionInfrastructureEnabled`.
- `src/hosts/server/AuthMinimalServerHostEntrypoint.ts` forces `executionInfrastructureEnabled: false` for pre-login startup.
- With auth-minimal startup, dependencies stage does not compose ComfyUI execution infrastructure or run-execution adapter registration artifacts, and does not inject `runExecutionAdapters` into host startup.
- Full authoritative startup continues composing execution infrastructure when enabled.

## Startup expectations

The entrypoint defaults to a full authoritative startup dependency contract and uses the shared host bootstrap pipeline (`configuration -> dependencies -> logging -> security -> persistence -> feature-registration`).

Bootstrap stage contracts for controlled decomposition are now defined in `src/hosts/server/AuthoritativeServerBootstrapStageContracts.ts` with typed boundaries for:
- `config`
- `security`
- `persistence`
- `services`
- `transport`

Story 1.2.2 extracts the first authoritative bootstrap stage implementations into dedicated modules:
- `src/hosts/server/AuthoritativeServerConfigBootstrapStage.ts`
- `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`

Story 1.2.3 adds a dedicated stage orchestrator in `src/hosts/server/AuthoritativeServerBootstrapStageOrchestrator.ts`.

`AuthoritativeServerCompositionRoot.ts` now composes config/security stage modules and routes remaining startup stages (`services`, `security`, `persistence`, `transport`) through that orchestrator so stage execution stays sequential and centralized.

The contract catalog maps those logical authoritative stages onto the current shared pipeline (`services -> dependencies`, `transport -> feature-registration`) so decomposition can proceed without changing runtime startup order.

Story 1.3.1 introduces a startup status model at the same orchestrator seam. `createAuthoritativeServerBootstrapStageOrchestrator(...)` now exposes `getStatus()` with ordered stage entries whose state is one of:
- `pending`
- `running`
- `success`
- `failed`

This status snapshot is available programmatically during and after staged startup execution.

Story 1.3.2 adds startup summary emission. Every authoritative startup attempt now logs one structured `authoritative-server.startup.summary` event (success or failure) including:
- total startup duration
- shared pipeline stage durations and failed stage diagnostics
- authoritative orchestrator stage durations and failed stage diagnostics
- top-level startup failure details when startup fails

Story 1.3.3 adds startup correlation ID propagation for startup observability. A per-startup `startupCorrelationId` is generated at startup tracer initialization and propagated through startup logs:
- startup span events (`startup.span.completed`, `startup.span.failed`, `startup.span.slow`) now include `startupCorrelationId`
- startup summary events include `startupCorrelationId` (equal to `traceId`)
- runtime handles expose `startupCorrelationId` so entrypoint lifecycle logs can include the same identifier
- startup failures surfaced through the entrypoint include `startupCorrelationId` when available

Story 1.4.1 introduces a dedicated startup harness regression test to simulate full authoritative startup and enforce stage ordering contracts across both startup models:
- shared host bootstrap pipeline order (`configuration -> dependencies -> logging -> security -> persistence -> feature-registration`)
- authoritative staged decomposition order (`services -> security -> persistence -> transport`)

Story 1.4.2 adds local startup performance baseline recording for authoritative startup. The authoritative entrypoint now persists successful startup duration baselines as JSON:
- file path defaults to the authoritative database directory as `authoritative-server-startup-baseline.json`
- each successful startup appends a sample containing total startup duration and per-stage durations (shared pipeline + authoritative staged decomposition)
- baseline recording is best-effort and does not fail startup when persistence errors occur

Story 1.4.3 adds startup regression alerts against those baselines:
- each successful startup compares current total startup duration with the mean duration of previously recorded successful baseline samples
- when the regression delta exceeds a configured warning threshold, startup emits a structured warning event:
  - `authoritative-server.startup.baseline-regression.detected`
- warning payload includes baseline duration, current duration, regression delta, threshold, and baseline sample counts
- baseline comparison and warning publication are best-effort and never block startup completion

Authoritative startup now emits structured startup span events (`startup.span.completed` / `startup.span.failed`) aligned to logical bootstrap stages plus nested diagnostics:
- `services`
- `security`
- `persistence`
- `transport`
- `config-load`
- `migrations`
- `persistence-setup`
- `ca-init`
- `orchestration-recovery`
- `server-start`

Each span completion/failure event includes `durationMs`. Steps exceeding 5000 ms are tagged with `slow: true` and include `slowSpanThresholdMs: 5000` for direct diagnostics filtering.

Startup tracing also emits `startup.span.slow` warning events for spans exceeding configured warning thresholds (`slowSpanWarnings.defaultThresholdMs` plus optional `slowSpanWarnings.thresholdsBySpanName` overrides), making slow startup operations explicit in warning streams.

### Environment keys

- `AI_LOOM_SERVER_DATABASE_PATH`: SQLite path for authoritative server persistence.
- `AI_LOOM_SERVER_HOST`: bind address (for example `127.0.0.1`).
- `AI_LOOM_SERVER_PORT`: bind port.
- `AI_LOOM_SERVER_STARTUP_REGRESSION_WARNING_THRESHOLD_MS`: optional non-negative integer threshold (milliseconds) for startup regression warning emission.
- `AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH`: optional SQLite bootstrap fallback path.
- `AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE`: optional SQLite journal mode override for bootstrap/runtime initialization.
- `AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS`: optional SQLite foreign-key enforcement toggle for bootstrap/runtime initialization.
- `AI_LOOM_COMFYUI_ADAPTER_ENABLED`: optional Comfy adapter toggle (`true`/`false`).
- `AI_LOOM_COMFYUI_BASE_URL`: optional Comfy backend base URL for adapter composition.
- `AI_LOOM_COMFYUI_REQUEST_TIMEOUT_MS`: optional Comfy transport request timeout override.
- `AI_LOOM_COMFYUI_CAPABILITY_PROBE_ON_STARTUP`: optional capability-probe startup toggle.
- `AI_LOOM_COMFYUI_REQUIRED_NODE_TYPES`: optional comma-separated required Comfy node types.
- `AI_LOOM_COMFYUI_AUTH_TOKEN`: optional auth token consumed by Comfy transport requests.

### Defaults

- Startup reason defaults to `authoritative-server-entrypoint-startup`.
- Required startup dependencies default to the complete authoritative host dependency boundary declared in `src/hosts/HostRuntimeCatalog.ts`.
- Database path defaults to `runtime-assets/server/authoritative-server.sqlite` relative to the process working directory when not provided.

### Process lifecycle

When run as a script, the entrypoint:
- starts the authoritative host
- logs startup address and phase
- handles `SIGINT`/`SIGTERM` by stopping the host gracefully
- exits non-zero on startup failure

During host composition:
- the bootstrap `persistence` stage initializes the shared SQLite persistence runtime (`src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`)
- the bootstrap `persistence` stage composes authoritative persistent platform services (repository adapters, audit sinks, and platform run/audit persistence adapter) and stores them as startup artifacts
- the bootstrap `feature-registration` stage injects startup-composed persistent platform services into `startIdentityServerHost(...)`
- the bootstrap `feature-registration` stage injects startup-composed run execution adapter registration into `startIdentityServerHost(...)` through `IdentityServerHostOptions.runExecutionAdapters`
- run cancellation orchestration resolves backend cancellation signaling from host-composed adapter registration rather than constructing backend adapters inside API/UI code
- startup failure cleanup disposes persistence runtime resources
- startup failure cleanup also disposes composed persistent platform services
- normal host shutdown also disposes composed persistent platform services and persistence runtime resources after host transport shutdown

Repository startup command:
- `npm run start:authoritative-server`

## Entrypoint consumers

In addition to the direct server script entrypoint above, runtime startup consumers now route through this same authoritative host assembly:

- `electron/main/main.ts` now starts pre-login identity runtime through `startAuthMinimalServerHostAssembly(...)` for auth-shell bootstrap.
- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts` (browser-development local control-plane startup via `npm run start:authoritative-server` + `AI_LOOM_SERVER_*` env when `bun` is available; when `bun` is unavailable startup fails fast with explicit guidance to install `bun` or start an authoritative host manually)

## Testing

Host assembly coverage lives in:
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/server/tests/AuthoritativeServerBootstrapStageOrchestrator.test.ts`
- `src/hosts/server/tests/AuthoritativeServerStartupHarness.test.ts`
- `src/hosts/server/tests/AuthoritativeServerHostEntrypoint.test.ts`
- `src/hosts/server/tests/AuthMinimalServerHostEntrypoint.test.ts`
- `src/hosts/server/tests/AuthMinimalServerApiRouteComposition.test.ts`
- `src/hosts/server/tests/AuthoritativeServerStartupBaselineRecorder.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`

## Related ADRs

- `docs/adr/records/adr-001-single-authoritative-control-plane.md`

