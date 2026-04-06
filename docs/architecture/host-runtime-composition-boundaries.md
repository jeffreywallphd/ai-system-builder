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

`src/shared/contracts/hosts/HostCompositionContracts.ts` now projects:

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
- `src/shared/contracts/hosts/tests/HostCompositionContracts.test.ts`
- `src/hosts/tests/HostRuntimeCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostEntrypoint.test.ts`
- `src/hosts/bootstrap/tests/HostBootstrapPipeline.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`

