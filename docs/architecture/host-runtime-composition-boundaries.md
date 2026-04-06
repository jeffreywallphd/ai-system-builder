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

