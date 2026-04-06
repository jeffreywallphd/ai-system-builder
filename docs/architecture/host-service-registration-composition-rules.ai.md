# AI Companion: Host Service Registration and Composition Rules

## Purpose
- Centralize host composition of application ports, infrastructure adapters, and platform services.
- Keep authoritative and non-authoritative hosts on explicit composition rules instead of ad hoc host imports.
- Enforce host-safe boundaries for UI, transport, execution, and persistence adapter composition.

## Main implementation seams
- Registration engine: `src/infrastructure/config/HostServiceRegistration.ts`
  - normalized service registration contracts
  - layer-alignment checks by registration kind
  - registration dependency-cycle detection
  - host capability + control-plane role gating
  - exposure-boundary gating (`ui`, `transport`, `execution`, `persistence`)
  - startup dependency coverage validation
- Host catalog + policy: `src/infrastructure/config/HostServiceRegistrationCatalog.ts`
  - canonical service definitions
  - host-specific service sets
  - authoritative required-service assertions
  - desktop required-service assertions
  - hybrid required-service assertions

## Authoritative server behavior
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts` now:
  - composes host service registration in bootstrap `dependencies` stage
  - stores plan artifact in startup context
  - enforces authoritative control-plane required-service coverage before runtime host start

## Desktop host behavior
- `src/hosts/desktop/DesktopHostCompositionRoot.ts` now:
  - composes host service registration in bootstrap `dependencies` stage
  - stores plan artifact in startup context
  - enforces desktop required-service coverage before runtime host start

## Hybrid host behavior
- `src/hosts/hybrid/HybridHostCompositionRoot.ts` now:
  - composes host service registration in bootstrap `dependencies` stage
  - stores plan artifact in startup context
  - enforces hybrid required-service coverage before runtime host start

## Contributor checklist for new services
1. Add the service to `HostServiceRegistrationCatalog.ts`.
2. Use correct `kind`/`boundaryLayer` pairing.
3. Declare capability and role requirements explicitly.
4. Declare exposure boundaries to prevent leakage.
5. Declare explicit service dependencies (`dependsOn`).
6. Add host mapping entries and verify startup dependency coverage.
7. Update authoritative required-service list when relevant.
8. Add tests in `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts` (and host-root tests when behavior changes).

## Tests
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`

