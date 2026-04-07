# AI Companion: Host Runtime Composition Boundaries

## Purpose
- Make host runtime composition explicit and reusable across server, desktop, hybrid, web, and worker assemblies.
- Keep authoritative control-plane responsibility explicit and separate from general node execution capability.

## Core contracts introduced
- Domain host model and validation:
  - `src/domain/hosts/HostRuntimeDomain.ts`
  - explicit runtime kind (`server`, `desktop`, `hybrid`, `web`, `worker`)
  - explicit control-plane role (`authoritative-server`, `control-plane-client`, `none`)
  - explicit capability flags (`control-plane-authority`, `node-execution`, UI/shell/runtime flags)
  - startup dependency boundary declaration by layer (`shared-contracts`, `domain`, `application`, `infrastructure`, `host`)
- Application composition-root contracts:
  - `src/application/common/HostCompositionContracts.ts`
  - shared boot configuration contract
  - lifecycle phase transitions and transition validation
  - executable composition-root contract boundary
  - required startup dependency checks against declared boundary
- Shared contract projection:
  - `src/shared/contracts/src/hosts/HostCompositionContracts.ts`
  - stable DTO projection for host identity and boot configuration

## Canonical host runtime catalog
- `src/hosts/HostRuntimeCatalog.ts` now defines runtime profiles for:
  - server (authoritative control plane)
  - desktop (control-plane client shell)
  - hybrid (desktop + local worker composition)
  - web (thin-client composition)
  - worker (background execution composition)
- Each profile now carries:
  - explicit responsibilities
  - capability set
  - startup dependency boundaries

## Authoritative server composition root
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` provides a reusable composition root adapter for authoritative server startup.
- This adapter:
  - enforces authoritative server role at compose-time
  - enforces required startup dependency boundary coverage
  - records deterministic lifecycle transitions (`configured -> composing -> starting -> ready -> stopping -> stopped`)
  - composes the existing production host startup path through `startIdentityServerHost`

## Desktop composition root + entrypoint
- `src/hosts/desktop/DesktopHostCompositionRoot.ts` now provides a reusable desktop composition root adapter.
- `src/hosts/desktop/DesktopHostEntrypoint.ts` provides a dedicated executable desktop host assembly entrypoint.
- Desktop adapter behavior:
  - validates desktop startup dependency boundary coverage
  - composes host-aware desktop service registration plans
  - asserts required desktop service coverage before feature registration starts host runtime
  - records deterministic lifecycle transitions (`configured -> composing -> starting -> ready -> stopping -> stopped`)
  - composes desktop runtime startup through host-owned adapters without authoritative control-plane role leakage

## Hybrid composition root + entrypoint (story 12.2.3)
- `src/hosts/hybrid/HybridHostCompositionRoot.ts` now provides a reusable hybrid composition root adapter.
- `src/hosts/hybrid/HybridHostEntrypoint.ts` provides a dedicated executable hybrid host assembly entrypoint.
- Hybrid adapter behavior:
  - validates hybrid startup dependency boundary coverage
  - composes host-aware hybrid service registration plans
  - asserts required hybrid service coverage before feature registration starts host runtime
  - enforces explicit capability-driven composition rules for desktop-facing + node/runtime capabilities
  - rejects control-plane ownership blur by disallowing direct local authoritative source in hybrid composition root
- supports intentional authoritative execution by delegating to the authoritative server host assembly mode
- records deterministic lifecycle transitions (`configured -> composing -> starting -> ready -> stopping -> stopped`)

## Web composition root + entrypoint (story 12.2.4)
- `src/hosts/web/WebHostCompositionRoot.ts` now provides a reusable web composition root adapter.
- `src/hosts/web/WebHostEntrypoint.ts` provides a dedicated executable web host assembly entrypoint.
- Web adapter behavior:
  - validates web startup dependency boundary coverage
  - composes host-aware web service registration plans
  - asserts required web service coverage before feature registration starts host runtime
  - keeps thin-client delivery concerns explicit through host-owned delivery configuration composition
  - records deterministic lifecycle transitions (`configured -> composing -> starting -> ready -> stopping -> stopped`)

## Worker composition root + entrypoint (story 12.2.4)
- `src/hosts/worker/WorkerHostCompositionRoot.ts` now provides a reusable worker composition root adapter.
- `src/hosts/worker/WorkerHostEntrypoint.ts` provides a dedicated executable worker host assembly entrypoint.
- Worker adapter behavior:
  - validates worker startup dependency boundary coverage
  - composes host-aware worker service registration plans
  - asserts required worker service coverage before feature registration starts host runtime
  - enforces explicit `node-execution` + `worker-runtime` capability composition
  - carries explicit node-registration capability context for runtime startup to support future capability-based node registration
  - records deterministic lifecycle transitions (`configured -> composing -> starting -> ready -> stopping -> stopped`)

## Unified bootstrap pipeline and startup context (story 12.1.2)
- Added `src/hosts/bootstrap/HostBootstrapPipeline.ts` as a shared host startup seam.
- Startup context is now explicit and reusable across hosts:
  - boot configuration
  - deployment profile metadata
  - environment map
  - enabled capabilities
  - lifecycle hooks
  - stage artifact handoff helpers
- Canonical startup sequence is now explicit and shared:
  1. `configuration`
  2. `dependencies`
  3. `logging`
  4. `security`
  5. `persistence`
  6. `feature-registration`
- Host-specific startup customization is supported through stage overrides and appended host stages (`runAfterStageId`) without copying common boot code.
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` now runs authoritative server startup through this shared pipeline.

## Shared deployment-profile-aware startup configuration (story 12.3.3)
- Added `src/infrastructure/config/HostStartupConfiguration.ts` as a shared startup/config module consumed by all host composition roots.
- Shared startup configuration now centralizes:
  - deployment profile resolution (`home`, `classroom`, `organization`)
  - environment and release-channel normalization
  - region and enabled-capability resolution
  - capability-boundary validation against host declarations
- Shared environment keys:
  - `AI_LOOM_DEPLOYMENT_PROFILE`
  - `AI_LOOM_ENVIRONMENT_NAME`
  - `AI_LOOM_RELEASE_CHANNEL`
  - `AI_LOOM_DEPLOYMENT_REGION`
  - `AI_LOOM_ENABLED_CAPABILITIES`
- This keeps profile-aware startup behavior explicit and testable across server/desktop/hybrid/web/worker assemblies while preserving one runtime architecture.

## Unified lifecycle coordination (story 12.3.1)
- Added `src/hosts/lifecycle/HostLifecycleCoordinator.ts` for shared lifecycle orchestration across all host composition roots.
- Server, desktop, hybrid, web, and worker roots now use this shared coordinator for:
  - deterministic transition recording
  - explicit startup-completed and readiness-marked lifecycle events
  - graceful shutdown coordination with shutdown hooks
  - cleanup sequencing and cleanup event capture
  - safe startup/shutdown failure propagation to `failed` lifecycle state
- Lifecycle behavior is now standardized while host roots remain composition-only and business-logic free.

## Host capability advertisement and runtime role inspection (story 12.3.2)
- `src/domain/hosts/HostRuntimeDomain.ts` now includes shared capability descriptors and runtime role-inspection projection contracts.
  - capability descriptors classify each host capability with explicit category + summary
  - role inspection projects control-plane, execution, UI, transport, and persistence posture without brittle string checks
- `src/application/common/HostCompositionContracts.ts` now includes `HostRuntimeMetadata` and `createHostRuntimeMetadata(...)` so metadata projection stays contract-owned and uniform.
- `src/hosts/HostRuntimeMetadataCatalog.ts` now provides reusable host metadata advertisement/inspection APIs:
  - `advertiseHostRuntimeMetadata(...)`
  - `resolveHostRuntimeMetadataFromCatalog(...)`
  - `listHostRuntimeMetadataCatalog(...)`
  - shared startup artifact key (`artifact:host:runtime:metadata`) for bootstrap diagnostics/registration hooks
- All host composition roots now advertise runtime metadata and expose it through runtime handles:
  - server, desktop, hybrid, web, worker
- Shared DTO projection now includes runtime metadata via `toHostRuntimeMetadataDto(...)` in:
  - `src/shared/contracts/src/hosts/HostCompositionContracts.ts`

This keeps host runtime metadata consumable for future node trust, scheduling, and admin/read-model surfaces while preserving host-boundary ownership.

## Host service registration and dependency composition rules (story 12.1.3)
- Added host-aware service registration contracts in `src/infrastructure/config/HostServiceRegistration.ts` for:
  - registration kind + boundary layer enforcement
  - dependency-cycle prevention
  - host capability/control-plane role gating
  - startup dependency coverage validation
  - exposure-boundary checks (`ui`, `transport`, `execution`, `persistence`)
- Added canonical host service catalog and authoritative required-service coverage assertions in `src/infrastructure/config/HostServiceRegistrationCatalog.ts`.
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` now composes service registration plans during bootstrap `dependencies` and validates authoritative service coverage before host feature-registration startup.

## Boundary rule now explicit
- Control-plane authority and node execution are separate concerns by contract:
  - only `authoritative-server` role may carry `control-plane-authority`
  - node execution is optional and host-specific (`hybrid`/`worker`)
  - authoritative server can remain authoritative without being a node executor

## Tests
- `src/domain/hosts/tests/HostRuntimeDomain.test.ts`
- `src/application/common/tests/HostCompositionContracts.test.ts`
- `src/shared/contracts/src/hosts/tests/HostCompositionContracts.test.ts`
- `src/hosts/tests/HostRuntimeMetadataCatalog.test.ts`
- `src/hosts/tests/HostRuntimeCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostEntrypoint.test.ts`
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostEntrypoint.test.ts`
- `src/hosts/web/tests/WebHostCompositionRoot.test.ts`
- `src/hosts/web/tests/WebHostEntrypoint.test.ts`
- `src/hosts/worker/tests/WorkerHostCompositionRoot.test.ts`
- `src/hosts/worker/tests/WorkerHostEntrypoint.test.ts`
- `src/hosts/bootstrap/tests/HostBootstrapPipeline.test.ts`
- `src/hosts/lifecycle/tests/HostLifecycleCoordinator.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
- `src/infrastructure/config/tests/HostStartupConfiguration.test.ts`

## Runtime entrypoint adoption (story 12.4.1)
- Active desktop and browser-development startup paths now delegate authoritative control-plane startup through host assembly entrypoints instead of direct server-host startup:
  - `electron/main/main.ts`
  - `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts`
- This keeps production/dev runtime entrypoints aligned with explicit host composition-root execution.

