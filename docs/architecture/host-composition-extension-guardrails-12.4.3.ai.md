# AI Companion: Host Composition Extension Guardrails (Story 12.4.3)

## Scope completed
- Add architecture-level validation tests that fail fast when host composition rules drift.
- Add contributor guidance for safely adding new hosts and placing new logic in the correct layer.

## New architecture guardrail tests
- Added `dev/tests/HostCompositionArchitectureGuardrails.test.ts`.
- This suite enforces:
  - canonical host runtime coverage for `server`, `desktop`, `hybrid`, `web`, and `worker`
  - canonical file placement per host kind under `src/hosts/<kind>/`:
    - `*CompositionRoot.ts`
    - `*HostEntrypoint.ts`
  - host composition roots remain in `src/hosts/**` (no host composition-root implementation outside host layer)
  - each composition root continues using shared host framework seams:
    - executable boundary assertion
    - shared bootstrap pipeline + startup context
    - host service registration plan composition
    - host-specific required-service coverage assertion
  - host composition roots do not import `src/ui/` directly
  - host entrypoints continue defaulting required dependency ids from host runtime catalog startup dependencies
  - host runtime startup dependency boundaries continue covering `shared-contracts`, `application`, and `host` layers with consistent dependency-id prefixes

## Contributor workflow: adding a new host
1. Add a canonical runtime profile in `src/hosts/HostRuntimeCatalog.ts` with explicit:
  - `hostId`
  - `kind`
  - `controlPlaneRole`
  - `capabilities`
  - `responsibilities`
  - `startupDependencies` by boundary layer
2. Add host runtime metadata coverage in `src/hosts/HostRuntimeMetadataCatalog.ts` only through existing metadata contracts.
3. Create a composition root at `src/hosts/<new-kind>/<NewKind>CompositionRoot.ts` that:
  - validates executable boundary coverage (`assertExecutableHostBoundarySatisfiesBootConfiguration`)
  - composes through shared bootstrap pipeline
  - composes and validates host service registration plan before feature registration startup
4. Create an entrypoint at `src/hosts/<new-kind>/<NewKind>HostEntrypoint.ts` that:
  - builds boot config through `createHostBootConfiguration(...)`
  - defaults required dependency ids from host runtime startup dependencies
  - starts the host through composition root assembly functions
5. Add/update host service registration catalog entries in `src/infrastructure/config/HostServiceRegistrationCatalog.ts`.
6. Add focused tests for the new host root/entrypoint plus catalog/runtime metadata tests.
7. Update architecture docs (`.ai.md` + `.md`) and README architecture index references.

## Contributor workflow: registering services safely
1. Register new service ids in `src/infrastructure/config/HostServiceRegistrationCatalog.ts`.
2. Keep `kind` and `boundaryLayer` aligned:
  - `application-port` -> `application`
  - `infrastructure-adapter` -> `infrastructure`
  - `platform-service` -> `infrastructure` or `host`
3. Declare minimal required capabilities and allowed control-plane roles.
4. Declare explicit `dependsOn` links.
5. Declare `exposureBoundaries` deliberately (`ui`, `transport`, `execution`, `persistence`).
6. Add/update required-service assertions for host families when behavior is baseline-critical.

## Layer placement guide for future host work
- `src/domain/`
  - Put invariants, domain vocabulary, and pure business rules.
  - Do not put startup wiring, IO, or host process concerns here.
- `src/application/`
  - Put use-case orchestration and port contracts.
  - Put host-agnostic composition contracts used by all hosts.
- `src/infrastructure/`
  - Put concrete adapters and service registration catalogs.
  - Keep adapter details here; do not leak adapter-specific concerns into src/domain/application.
- `src/ui/`
  - Put rendering, state, page/presenter/service UI coordination.
  - Do not import UI directly into host composition roots.
- `src/hosts/`
  - Put executable host assemblies, composition roots, and host lifecycle/bootstrap coordination.
  - Keep host modules composition-only; no feature/business rules.

## Why this closes drift risk
- Host conventions are now enforced by executable tests, not only docs.
- New host additions must satisfy the same production composition-root and boundary rules used by existing host assemblies.
- Layer ownership is documented with concrete file-level patterns and guardrails.
