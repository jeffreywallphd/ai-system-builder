# Host Runtime Composition Boundaries

This note defines the host runtime composition contracts that make host boundaries explicit for server, desktop, hybrid, web, and worker assemblies.

## Intent

- Make host composition a first-class architecture construct.
- Keep authoritative control-plane responsibility explicit.
- Separate control-plane authority from general node execution concerns.

## Contracts added

### Domain host model

`src/domain/hosts/HostRuntimeDomain.ts` now defines:

- runtime kinds: `server`, `desktop`, `hybrid`, `web`, `worker`
- control-plane roles: `authoritative-server`, `control-plane-client`, `none`
- capability flags: including `control-plane-authority` and `node-execution`
- startup dependency boundaries by layer:
  - `shared-contracts`
  - `domain`
  - `application`
  - `infrastructure`
  - `host`

The domain validation contract now enforces:

- only authoritative-server role can carry control-plane authority
- authoritative-server role must be a server host kind
- startup dependencies are uniquely identified and explicitly layered

### Application composition-root contract

`src/application/common/HostCompositionContracts.ts` now defines:

- shared host boot configuration contract
- lifecycle phases and valid lifecycle transitions
- executable host composition-root interface
- compose-time checks that required dependencies are declared in the composition boundary
- explicit control-plane eligibility assertion for authoritative boot flows

### Shared host DTO contracts

`src/shared/contracts/src/hosts/HostCompositionContracts.ts` now projects:

- stable host identity DTOs
- stable boot configuration DTOs
- contract scope/version descriptors for host composition payload exchange

## Host catalog and boundaries

`src/hosts/HostRuntimeCatalog.ts` now provides canonical runtime definitions for:

- server (authoritative control plane)
- desktop (desktop shell control-plane client)
- hybrid (desktop shell plus local worker execution)
- web (thin client)
- worker (background execution)

Each catalog entry contains explicit responsibilities, capability flags, and startup dependency boundaries.

## Authoritative server composition root

`src/hosts/server/AuthoritativeServerCompositionRoot.ts` introduces a reusable authoritative composition root adapter that:

- enforces authoritative-role semantics before startup
- validates startup dependency boundary requirements
- composes the production server startup path via `startIdentityServerHost`
- records deterministic host lifecycle transitions through startup and shutdown

## Desktop composition root and executable host assembly

`src/hosts/desktop/DesktopHostCompositionRoot.ts` introduces a reusable desktop composition root adapter that:

- validates desktop startup dependency boundary requirements
- composes host-aware desktop service registration plans and asserts desktop required-service coverage before feature registration
- records deterministic host lifecycle transitions through startup and shutdown
- starts desktop runtime through host-owned adapters (window/bootstrap/IPC wiring) without introducing authoritative control-plane ownership

`src/hosts/desktop/DesktopHostEntrypoint.ts` adds a dedicated executable host assembly entrypoint for desktop startup (`constructDesktopHostAssembly(...)` and `startDesktopHostAssembly(...)`).

## Hybrid composition root and executable host assembly

`src/hosts/hybrid/HybridHostCompositionRoot.ts` introduces a reusable hybrid composition root adapter that:

- validates hybrid startup dependency boundary requirements
- composes host-aware hybrid service registration plans and asserts hybrid required-service coverage before feature registration
- enforces explicit capability-driven composition rules for desktop-facing plus node/runtime capability composition
- rejects direct local authoritative control-plane ownership in hybrid composition to avoid collapsing server and client responsibilities
- records deterministic host lifecycle transitions through startup and shutdown

`src/hosts/hybrid/HybridHostEntrypoint.ts` adds a dedicated executable hybrid host assembly entrypoint (`constructHybridHostAssembly(...)` and `startHybridHostAssembly(...)`) with explicit assembly modes:

- `hybrid-client`: hybrid runtime remains a control-plane client
- `authoritative-server-host`: intentional delegation to authoritative server host assembly startup

## Web composition root and executable host assembly

`src/hosts/web/WebHostCompositionRoot.ts` introduces a reusable web composition root adapter that:

- validates web startup dependency boundary requirements
- composes host-aware web service registration plans and asserts web required-service coverage before feature registration
- keeps thin-client delivery concerns explicit through host-owned delivery configuration composition (for example delivery mode and base path)
- records deterministic host lifecycle transitions through startup and shutdown

`src/hosts/web/WebHostEntrypoint.ts` adds a dedicated executable web host assembly entrypoint (`constructWebHostAssembly(...)` and `startWebHostAssembly(...)`).

## Worker composition root and executable host assembly

`src/hosts/worker/WorkerHostCompositionRoot.ts` introduces a reusable worker composition root adapter that:

- validates worker startup dependency boundary requirements
- composes host-aware worker service registration plans and asserts worker required-service coverage before feature registration
- enforces explicit worker execution capability composition (`node-execution` and `worker-runtime`) and rejects mismatched capability toggles
- carries explicit node-registration capability context for runtime startup so future capability-based node registration can remain host-owned and deterministic
- records deterministic host lifecycle transitions through startup and shutdown

`src/hosts/worker/WorkerHostEntrypoint.ts` adds a dedicated executable worker host assembly entrypoint (`constructWorkerHostAssembly(...)` and `startWorkerHostAssembly(...)`).

## Unified bootstrap pipeline and startup context

`src/hosts/bootstrap/HostBootstrapPipeline.ts` now provides a shared startup seam for all hosts:

- canonical startup context model carrying boot config, deployment profile, environment data, enabled capabilities, lifecycle hooks, and stage artifacts
- reusable canonical stage sequence:
  - `configuration`
  - `dependencies`
  - `logging`
  - `security`
  - `persistence`
  - `feature-registration`
- deterministic stage execution history for startup-order verification
- host-specific customization through stage overrides and `runAfterStageId` extensions without duplicating shared boot logic

The authoritative server composition root now consumes this pipeline to keep host startup order explicit and reusable while preserving clean boundary ownership.

## Shared deployment-profile-aware startup configuration (story 12.3.3)

`src/infrastructure/config/HostStartupConfiguration.ts` now centralizes runtime startup configuration resolution for server, desktop, hybrid, web, and worker roots:

- shared deployment profile contract constrained to `home`, `classroom`, and `organization`
- shared environment keys for profile/environment/channel/region/capability resolution:
  - `AI_LOOM_DEPLOYMENT_PROFILE`
  - `AI_LOOM_ENVIRONMENT_NAME`
  - `AI_LOOM_RELEASE_CHANNEL`
  - `AI_LOOM_DEPLOYMENT_REGION`
  - `AI_LOOM_ENABLED_CAPABILITIES`
- centralized validation for startup environment name, release channel, and host-capability enablement boundaries
- one `resolveHostStartupConfiguration(...)` path so deployment profile choices remain explicit and testable across all host assemblies without architecture forking

## Unified lifecycle coordination (story 12.3.1)

Host lifecycle management is now shared through `src/hosts/lifecycle/HostLifecycleCoordinator.ts`.

Each host composition root (server, desktop, hybrid, web, worker) now uses this lifecycle coordinator to:

- emit deterministic lifecycle transition events
- mark explicit startup completion and readiness state
- coordinate graceful shutdown with standardized shutdown hooks
- execute cleanup hooks in deterministic order
- propagate startup/shutdown failures while transitioning to `failed` safely

This keeps runtime lifecycle behavior consistent across hosts without moving business logic into host lifecycle modules.

## Host capability advertisement and runtime role inspection (story 12.3.2)

`src/domain/hosts/HostRuntimeDomain.ts` now also defines shared capability-descriptor and runtime-role-inspection contracts:

- capability descriptors with explicit category + summary per host capability flag
- runtime role inspection projection that reports authoritative/control-plane-client posture, execution posture, UI posture, transport posture, and persistence posture

`src/application/common/HostCompositionContracts.ts` now defines `HostRuntimeMetadata` and `createHostRuntimeMetadata(...)` so host runtime metadata is produced in one consistent format:

- canonical host identity fields (host id, kind, control-plane role)
- structured role inspection projection
- advertised capability descriptors (optionally narrowed to runtime-enabled subsets)
- host metadata annotations for diagnostics/registration consumers

`src/hosts/HostRuntimeMetadataCatalog.ts` now provides host metadata advertisement and inspection helpers:

- `advertiseHostRuntimeMetadata(...)`
- `resolveHostRuntimeMetadataFromCatalog(...)`
- `listHostRuntimeMetadataCatalog(...)`
- shared bootstrap artifact key (`artifact:host:runtime:metadata`) for host-internal startup hooks

All composition roots now publish runtime metadata deterministically and expose it on runtime handles:

- server: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- desktop: `src/hosts/desktop/DesktopHostCompositionRoot.ts`
- hybrid: `src/hosts/hybrid/HybridHostCompositionRoot.ts`
- web: `src/hosts/web/WebHostCompositionRoot.ts`
- worker: `src/hosts/worker/WorkerHostCompositionRoot.ts`

This keeps capability advertisement and runtime role inspection host-owned and contract-safe for future node trust, scheduling, and admin/read-model surfaces.

## Host-aware service registration and dependency composition rules (story 12.1.3)

`src/infrastructure/config/HostServiceRegistration.ts` now defines reusable host service registration contracts and validation rules for:

- application ports
- infrastructure adapters
- platform services

The registration layer enforces:

- layer-safe registration kind alignment
- dependency-cycle prevention
- host capability and control-plane role gating
- startup dependency coverage for required boot dependencies
- host-safe exposure boundaries for UI, transport, execution, and persistence composition

`src/infrastructure/config/HostServiceRegistrationCatalog.ts` now provides canonical host-specific registration sets and authoritative control-plane required service assertions.

`src/hosts/server/AuthoritativeServerCompositionRoot.ts` now composes service registration plans in the `dependencies` stage and validates authoritative control-plane coverage before feature registration starts the runtime host.

## Architectural boundary clarification

The contracts now explicitly state that:

- control-plane authority is not equivalent to node execution
- node execution capability can exist on hybrid/worker hosts without authoritative control-plane rights
- the authoritative server remains a dedicated control-plane role, reusable through a dedicated composition root

## Test coverage

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

The following active runtime entrypoints now delegate authoritative control-plane startup through the authoritative server host assembly entrypoint instead of direct server-host initialization:

- `electron/main/main.ts`
- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts`

This keeps startup control-plane composition on the explicit host framework path for desktop and browser-development runtime workflows.

