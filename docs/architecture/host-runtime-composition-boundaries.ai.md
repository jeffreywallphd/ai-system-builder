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
  - `src/shared/contracts/hosts/HostCompositionContracts.ts`
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
- `src/shared/contracts/hosts/tests/HostCompositionContracts.test.ts`
- `src/hosts/tests/HostRuntimeCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostEntrypoint.test.ts`
- `src/hosts/bootstrap/tests/HostBootstrapPipeline.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`

