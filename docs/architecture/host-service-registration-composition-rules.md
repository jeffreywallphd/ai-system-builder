# Host Service Registration and Composition Rules

This note defines the host-aware service registration rules introduced for Story 12.1.3.

## Intent

- Centralize service composition so hosts do not rely on ad hoc imports.
- Compose application ports, infrastructure adapters, and platform services through one repeatable registration model.
- Enforce host boundaries so UI, transport, execution, and persistence services are only assembled where host capability and role allow it.

## Runtime contracts

`src/infrastructure/config/HostServiceRegistration.ts` provides:

- a normalized service registration model (`serviceId`, `kind`, `boundaryLayer`, dependency graph, capability/role gates)
- layer-alignment enforcement:
  - `application-port` registrations must stay in `application`
  - `infrastructure-adapter` registrations must stay in `infrastructure`
  - `platform-service` registrations must stay in `infrastructure` or `host`
- cycle detection for registration dependencies
- host-aware composition checks for:
  - required capabilities
  - allowed control-plane roles
  - exposure boundaries (`ui`, `transport`, `execution`, `persistence`)
- startup-dependency coverage validation so required boot dependency ids are backed by composed services

## Host service catalog

`src/infrastructure/config/HostServiceRegistrationCatalog.ts` provides:

- canonical service registration inventory for server, desktop, hybrid, web, and worker host families
- host-to-service registration maps for default composition
- authoritative control-plane required-service assertions
- desktop host required-service assertions
- hybrid host required-service assertions

The catalog composes deterministic service plans through:

- `composeHostServiceRegistrationPlan(...)`
- `assertAuthoritativeControlPlaneServiceCoverage(...)`
- `assertDesktopHostServiceCoverage(...)`
- `assertHybridHostServiceCoverage(...)`

## Host integration

`src/hosts/server/AuthoritativeServerCompositionRoot.ts` now composes service registration plans during the shared bootstrap `dependencies` stage and enforces authoritative required service coverage before `feature-registration`.

`src/hosts/desktop/DesktopHostCompositionRoot.ts` now composes service registration plans during the shared bootstrap `dependencies` stage and enforces desktop required service coverage before `feature-registration`.

`src/hosts/hybrid/HybridHostCompositionRoot.ts` now composes service registration plans during the shared bootstrap `dependencies` stage and enforces hybrid required service coverage before `feature-registration`.

This keeps host service assembly explicit, host-aware, and deterministic across authoritative, desktop, and hybrid composition roots.

## Contributor guidance: adding a new service registration safely

1. Add the registration in `src/infrastructure/config/HostServiceRegistrationCatalog.ts`.
2. Choose the correct `kind` + `boundaryLayer` pairing (`application-port`, `infrastructure-adapter`, or `platform-service`).
3. Declare only the minimal `requiredCapabilities` and `allowedControlPlaneRoles` needed by the service.
4. Set `exposureBoundaries` (`ui`, `transport`, `execution`, `persistence`) to prevent host leakage.
5. Add explicit `dependsOn` references for upstream collaborators; do not rely on implicit import order.
6. Map the service into the relevant host entries (`HostServiceIdsByHostId`) and ensure startup dependency coverage remains valid.
7. If the service is part of authoritative control-plane baseline behavior, add it to `AuthoritativeControlPlaneRequiredServiceIds`.
8. Add or update tests in `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts` and, if needed, host composition-root tests.

## Test coverage

- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`

