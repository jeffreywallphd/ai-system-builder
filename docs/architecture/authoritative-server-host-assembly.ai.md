# AI Companion: Authoritative Server Host Assembly

## Purpose
- Define the production authoritative server host assembly as the executable control-plane boundary.
- Keep host code focused on composition/startup while business logic remains in src/application/domain layers.

## Main implementation seams
- Composition root: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- Auth-minimal entrypoint: `src/hosts/server/AuthMinimalServerHostEntrypoint.ts`
- Auth-minimal runtime host startup implementation: `src/hosts/server/AuthMinimalIdentityServerHost.ts`
- Runtime host startup implementation: `src/hosts/server/IdentityServerHost.ts`
- Identity/session/trusted-device bounded composition module: `src/hosts/server/composition/ServerIdentitySessionTrustedDeviceCompositionModule.ts`
- Workspace/authorization/sharing bounded composition module: `src/hosts/server/composition/ServerWorkspaceAuthorizationCompositionModule.ts`
- Deployment-policy administration bounded composition module: `src/hosts/server/composition/ServerDeploymentPolicyCompositionModule.ts`
- Secret-service bounded composition module: `src/hosts/server/composition/ServerSecretCompositionModule.ts`
- Certificate/CA bounded composition module: `src/hosts/server/composition/ServerCertificateCompositionModule.ts`
- Node trust bounded composition module: `src/hosts/server/composition/ServerNodeTrustCompositionModule.ts`
- TLS material + transport trust bounded composition module: `src/hosts/server/composition/ServerTlsMaterialCompositionModule.ts`
- Storage + protected asset bounded composition module: `src/hosts/server/composition/ServerStorageAssetCompositionModule.ts`
- Image/media bounded composition module: `src/hosts/server/composition/ServerImageMediaCompositionModule.ts`
- Generated-result bounded composition module: `src/hosts/server/composition/ServerGeneratedResultCompositionModule.ts`
- Audit/diagnostics/platform cross-cutting bounded composition module: `src/hosts/server/composition/ServerAuditDiagnosticsPlatformCompositionModule.ts`
- Execution-node management bounded composition module: `src/hosts/server/composition/ServerExecutionNodeManagementCompositionModule.ts`
- Run scheduling bounded composition module: `src/hosts/server/composition/ServerRunSchedulingCompositionModule.ts`
- Run orchestration bounded composition module: `src/hosts/server/composition/ServerRunOrchestrationCompositionModule.ts`
- Orchestration recovery/reconciliation bounded composition module: `src/hosts/server/composition/ServerOrchestrationRecoveryCompositionModule.ts`
- Bounded composition contract scaffold: `src/hosts/server/composition/contracts/*`
- Authoritative persistence composition seam: `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- Auth-minimal persistence composition seam: `src/infrastructure/persistence/AuthMinimalPersistenceComposition.ts`
- Route registration composition seam: `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- Auth-minimal route registration composition seam: `src/hosts/server/AuthMinimalServerApiRouteComposition.ts`

Story 2.1.2 adds the first bounded-control-plane composition scaffold:

- module contracts: `src/hosts/server/composition/contracts/AuthoritativeServerCompositionModuleContracts.ts`
- module map: `src/hosts/server/composition/contracts/AuthoritativeServerCompositionModuleMap.ts`
- composition placement guidance: `src/hosts/server/composition/README.md`
- contract guardrail test: `src/hosts/server/tests/AuthoritativeServerCompositionAssemblyContracts.test.ts`

Story 2.2.1 extracts identity/session/trusted-device assembly from `IdentityServerHost.ts` into:

- `src/hosts/server/composition/ServerIdentitySessionTrustedDeviceCompositionModule.ts`
- regression coverage: `src/hosts/server/tests/ServerIdentitySessionTrustedDeviceCompositionModule.test.ts`

Story 2.2.2 extracts workspace lifecycle, authorization/sharing, and deployment-policy administration assembly from `IdentityServerHost.ts` into:

- `src/hosts/server/composition/ServerWorkspaceAuthorizationCompositionModule.ts`
- `src/hosts/server/composition/ServerDeploymentPolicyCompositionModule.ts`
- regression coverage:
  - `src/hosts/server/tests/ServerWorkspaceAuthorizationCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerDeploymentPolicyCompositionModule.test.ts`

Story 2.2.3 extracts node trust, certificates, TLS material, and secret-service assembly from inline `IdentityServerHost.ts` startup wiring into:

- `src/hosts/server/composition/ServerSecretCompositionModule.ts`
- `src/hosts/server/composition/ServerCertificateCompositionModule.ts`
- `src/hosts/server/composition/ServerNodeTrustCompositionModule.ts`
- `src/hosts/server/composition/ServerTlsMaterialCompositionModule.ts`
- regression coverage:
  - `src/hosts/server/tests/ServerSecretCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerCertificateCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerNodeTrustCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerTlsMaterialCompositionModule.test.ts`

Story 2.2.4 extracts storage/asset/media/generated-result assembly from inline `IdentityServerHost.ts` startup wiring into:

- `src/hosts/server/composition/ServerStorageAssetCompositionModule.ts`
- `src/hosts/server/composition/ServerImageMediaCompositionModule.ts`
- `src/hosts/server/composition/ServerGeneratedResultCompositionModule.ts`
- regression coverage:
  - `src/hosts/server/tests/ServerStorageAssetCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerImageMediaCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerGeneratedResultCompositionModule.test.ts`

Story 2.2.5 extracts audit-service assembly, diagnostics reconciliation/backends, and cross-cutting operational logging dependencies from inline `IdentityServerHost.ts` startup wiring into:

- `src/hosts/server/composition/ServerAuditDiagnosticsPlatformCompositionModule.ts`
- regression coverage:
  - `src/hosts/server/tests/ServerAuditDiagnosticsPlatformCompositionModule.test.ts`

Story 2.2.6 extracts orchestration, scheduling, startup recovery/reconciliation, and execution-node management assembly from inline `IdentityServerHost.ts` startup wiring into:

- `src/hosts/server/composition/ServerExecutionNodeManagementCompositionModule.ts`
- `src/hosts/server/composition/ServerRunSchedulingCompositionModule.ts`
- `src/hosts/server/composition/ServerRunOrchestrationCompositionModule.ts`
- `src/hosts/server/composition/ServerOrchestrationRecoveryCompositionModule.ts`
- regression coverage:
  - `src/hosts/server/tests/ServerExecutionNodeManagementCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerRunSchedulingCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerRunOrchestrationCompositionModule.test.ts`
  - `src/hosts/server/tests/ServerOrchestrationRecoveryCompositionModule.test.ts`

## Control-plane ownership
- Authoritative server is the single runtime with control-plane authority.
- Composition explicitly covers identity, device trust, node trust, workspace administration metadata, scheduling/orchestration policy, storage policy metadata, audit hooks, and thin-client transport APIs.
- Startup asserts dependency and required-service coverage before runtime start.

## Startup expectations
- Shared bootstrap pipeline order remains authoritative: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Story 2.1.3 adds a canonical staged bootstrap/state model in
  `src/hosts/server/composition/contracts/AuthoritativeServerBootstrapPipelineStateModel.ts`
  to make control-plane startup sequencing explicit for refactor planning:
  1. `configuration-load`
  2. `security-material-resolution`
  3. `persistence-initialization`
  4. `migration-execution`
  5. `subsystem-composition`
  6. `readiness-verification`
  7. `transport-startup`
  8. `shutdown-preparation` (`planned` adoption state)
- Bootstrap stage contracts for staged decomposition live in `src/hosts/server/AuthoritativeServerBootstrapStageContracts.ts` with typed boundaries for `config`, `security`, `persistence`, `services`, and `transport`.
- Contract-to-host-stage bindings keep runtime order unchanged while exposing logical boundaries (`services -> dependencies`, `transport -> feature-registration`).
- Story 1.2.2 extracts initial authoritative bootstrap stage implementations into:
  - `src/hosts/server/AuthoritativeServerConfigBootstrapStage.ts`
  - `src/hosts/server/AuthoritativeServerSecurityBootstrapStage.ts`
- Story 1.2.3 adds one stage orchestrator seam at `src/hosts/server/AuthoritativeServerBootstrapStageOrchestrator.ts`.
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` now consumes config/security stage modules and routes `services`, `security`, `persistence`, and `transport` through that orchestrator for centralized sequential stage execution.
- Story 1.3.1 adds a startup status model at that orchestrator seam. `createAuthoritativeServerBootstrapStageOrchestrator(...)` now exposes `getStatus()` with ordered stage entries and states:
  - `pending`
  - `running`
  - `success`
  - `failed`
- This startup status snapshot is available programmatically during and after staged startup execution.
- Story 1.3.2 adds startup summary emission. Every authoritative startup attempt now logs one structured `authoritative-server.startup.summary` event (success or failure) with:
  - total startup duration
  - shared pipeline stage durations and failed stage diagnostics
  - authoritative orchestrator stage durations and failed stage diagnostics
  - top-level startup failure details when startup fails
- Story 1.3.3 adds startup correlation ID propagation for startup observability:
  - startup tracer initialization generates one per-startup `startupCorrelationId`
  - startup span events (`startup.span.completed`, `startup.span.failed`, `startup.span.slow`) include `startupCorrelationId`
  - startup summary events include `startupCorrelationId` (equal to `traceId`)
  - authoritative runtime handles expose `startupCorrelationId` so entrypoint lifecycle logs share the same identifier
  - startup failures surfaced by the entrypoint include `startupCorrelationId` when available
- Story 1.4.1 adds a startup harness regression test that simulates authoritative startup and enforces stage order contracts across:
  - shared host bootstrap stages (`configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`)
  - authoritative staged decomposition (`services`, `security`, `persistence`, `transport`)
- Story 1.4.2 adds local startup performance baseline recording for authoritative startup:
  - successful startup runs append baseline samples to `authoritative-server-startup-baseline.json` in the authoritative database directory
  - each baseline sample records total startup duration and per-stage durations across shared pipeline and authoritative staged decomposition
  - baseline persistence is best-effort and cannot block startup completion
- Story 1.4.3 adds startup regression alerts against recorded baselines:
  - baseline recording now compares current successful startup duration against the mean of previously recorded successful baseline samples
  - when startup duration regression exceeds a configured threshold, startup logs one structured warning event:
    - `authoritative-server.startup.baseline-regression.detected`
  - warning event payload includes baseline and current duration, regression delta, threshold, and sample counts
  - baseline comparison and warning emission remain non-blocking for startup completion
- Startup emits structured span events (`startup.span.completed` / `startup.span.failed`) for major bootstrap steps:
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
- Span completion/failure events include `durationMs`; steps longer than 5000 ms are tagged with `slow: true` and include `slowSpanThresholdMs: 5000`.
- Slow spans also emit `startup.span.slow` warning events when they exceed configured warning thresholds (`slowSpanWarnings.defaultThresholdMs` with optional `slowSpanWarnings.thresholdsBySpanName` overrides).
- Entrypoint default startup reason: `authoritative-server-entrypoint-startup`.
- Entrypoint default required dependencies: full authoritative dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Environment keys:
  - `AI_LOOM_SERVER_DATABASE_PATH`
  - `AI_LOOM_SERVER_HOST`
  - `AI_LOOM_SERVER_PORT`
  - `AI_LOOM_SERVER_STARTUP_REGRESSION_WARNING_THRESHOLD_MS`
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
  - top-level transport composition (`createIdentityHttpServer`) consumes the route registration plan via the route-module registry and allows per-route-family modular dispatch
  - top-level websocket upgrade entry wiring is isolated in `src/infrastructure/transport/http-server/identity/composition/IdentityHttpUpgradeBoundary.ts`, separating upgrade dispatch from standard HTTP route handling
  - modular handler coverage now includes storage, asset, image-asset, deployment-policy, audit-ledger, execution-node-management, run-submission, run-read, run-mutation, and run-execution-update route families
  - route families without modular handler ownership continue through canonical inline route implementations in `IdentityHttpServer.ts`
  - `dependencies` stage also composes optional ComfyUI execution adapter infrastructure artifact when Comfy adapter config is enabled
  - `dependencies` stage composes authoritative run-execution adapter registration (`src/infrastructure/execution/runs/AuthoritativeRunExecutionAdapterRegistration.ts`) that resolves:
    - run dispatch port registration
    - run cancellation signal port via Comfy cancellation bridge (`src/infrastructure/execution/runs/ComfyUiRunExecutionCancellationSignalAdapter.ts`)
  - `feature-registration` stage asserts authoritative required route-family coverage before transport start
  - `feature-registration` stage injects composed run-execution adapter registration into `startIdentityServerHost(...)`
- Story B.2.2 narrows auth-minimal pre-login route coverage with dedicated composition:
  - `composeAuthMinimalServerApiRouteRegistrationPlan(...)` and `assertAuthMinimalServerApiRouteRegistrationCoverage(...)` live in `src/hosts/server/AuthMinimalServerApiRouteComposition.ts`
  - auth-minimal coverage requires `identity-auth` only
  - authoritative mode retains full control-plane route-family assertion in `src/hosts/server/AuthoritativeServerApiRouteComposition.ts`
- Story B.2.4 removes execution-adapter composition from auth-minimal pre-login startup:
  - `AuthoritativeServerCompositionRoot` exposes `bootstrap.executionInfrastructureEnabled`
  - `AuthMinimalServerHostEntrypoint` sets `executionInfrastructureEnabled: false`
  - pre-login dependencies stage skips ComfyUI execution adapter composition and run-execution adapter registration artifacts/injection
  - full authoritative startup keeps execution composition behavior unchanged

## Entrypoint consumers
- `electron/main/main.ts` now delegates pre-login desktop startup through `startAuthMinimalServerHostAssembly(...)`.
- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts` now starts browser-development local control-plane startup through `npm run start:authoritative-server` with `AI_LOOM_SERVER_*` env wiring when `bun` is available; when `bun` is unavailable, startup now fails fast with explicit guidance to install `bun` or start an authoritative host manually.

## Tests
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/server/tests/AuthoritativeServerBootstrapStageOrchestrator.test.ts`
- `src/hosts/server/tests/AuthoritativeServerStartupHarness.test.ts`
- `src/hosts/server/tests/AuthoritativeServerHostEntrypoint.test.ts`
- `src/hosts/server/tests/AuthMinimalServerHostEntrypoint.test.ts`
- `src/hosts/server/tests/AuthMinimalServerApiRouteComposition.test.ts`
- `src/hosts/server/tests/AuthoritativeServerStartupBaselineRecorder.test.ts`
- `src/hosts/server/tests/ServerWorkspaceAuthorizationCompositionModule.test.ts`
- `src/hosts/server/tests/ServerDeploymentPolicyCompositionModule.test.ts`
- `src/hosts/server/tests/ServerSecretCompositionModule.test.ts`
- `src/hosts/server/tests/ServerCertificateCompositionModule.test.ts`
- `src/hosts/server/tests/ServerNodeTrustCompositionModule.test.ts`
- `src/hosts/server/tests/ServerTlsMaterialCompositionModule.test.ts`
- `src/hosts/server/tests/ServerStorageAssetCompositionModule.test.ts`
- `src/hosts/server/tests/ServerImageMediaCompositionModule.test.ts`
- `src/hosts/server/tests/ServerGeneratedResultCompositionModule.test.ts`
- `src/hosts/server/tests/ServerAuditDiagnosticsPlatformCompositionModule.test.ts`
- `src/hosts/server/tests/ServerExecutionNodeManagementCompositionModule.test.ts`
- `src/hosts/server/tests/ServerRunSchedulingCompositionModule.test.ts`
- `src/hosts/server/tests/ServerRunOrchestrationCompositionModule.test.ts`
- `src/hosts/server/tests/ServerOrchestrationRecoveryCompositionModule.test.ts`
- `src/infrastructure/transport/http-server/tests/AuthoritativeApiRouteRegistrationCatalog.test.ts`

## Related ADRs
- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`

