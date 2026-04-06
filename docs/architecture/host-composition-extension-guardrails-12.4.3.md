# Host Composition Extension Guardrails (Story 12.4.3)

Story 12.4.3 adds architecture-level guardrails so host composition patterns stay enforceable as the codebase grows.

## What was added

### Automated architecture validation

Added `dev/tests/HostCompositionArchitectureGuardrails.test.ts` to enforce host framework invariants:

- canonical host runtime coverage for `server`, `desktop`, `hybrid`, `web`, and `worker`
- canonical host file placement under `src/hosts/<kind>/`:
  - `*CompositionRoot.ts`
  - `*HostEntrypoint.ts`
- host composition-root implementations stay inside `src/hosts/**`
- each composition root keeps required host-framework seams:
  - executable boundary assertion
  - shared bootstrap pipeline and startup context composition
  - host service registration plan composition
  - host-specific service coverage assertion
- host composition roots do not import `ui/` directly
- host entrypoints continue defaulting required dependency ids from host runtime startup dependency declarations
- startup dependency boundaries continue explicit `shared-contracts` + `application` + `host` coverage with consistent dependency-id prefixing

These tests are designed to fail when future host additions bypass the established framework.

## Contributor guide: how to add a new host

1. Add a runtime profile in `src/hosts/HostRuntimeCatalog.ts` with explicit host id, kind, control-plane role, capabilities, responsibilities, and startup dependency boundaries.
2. Keep runtime metadata projection on shared contracts via `src/hosts/HostRuntimeMetadataCatalog.ts`.
3. Add a composition root in `src/hosts/<new-kind>/<NewKind>CompositionRoot.ts` that:
   - validates executable boot dependency boundaries
   - runs startup through shared bootstrap pipeline
   - composes + validates host service registration before runtime startup
4. Add an entrypoint in `src/hosts/<new-kind>/<NewKind>HostEntrypoint.ts` that:
   - creates boot config with `createHostBootConfiguration(...)`
   - defaults required dependencies from runtime startup dependencies
   - starts runtime through composition root assembly
5. Add/update host registrations in `src/infrastructure/config/HostServiceRegistrationCatalog.ts`.
6. Add tests for the new composition root and entrypoint, plus catalog/runtime metadata coverage.
7. Update both architecture docs (`.md` and `.ai.md`) and README architecture links.

## Contributor guide: how to register services safely

1. Add registrations in `src/infrastructure/config/HostServiceRegistrationCatalog.ts`.
2. Keep service kind and boundary layer aligned.
3. Declare minimal required capabilities and control-plane role constraints.
4. Declare explicit dependencies with `dependsOn`.
5. Set exposure boundaries (`ui`, `transport`, `execution`, `persistence`) intentionally.
6. Update required-service assertions when the service is part of baseline host behavior.

## Layer placement decision guide

Use this quick rule when adding host-related logic:

- `domain/`: business invariants and domain language only.
- `application/`: use-case orchestration and host-agnostic ports/contracts.
- `infrastructure/`: concrete adapters and host service registration catalog.
- `ui/`: rendering/state/presenter logic only; never compose hosts here.
- `src/hosts/`: executable host assembly and runtime composition wiring only.

When in doubt, keep business behavior in `domain`/`application` and keep `src/hosts` focused on composition, bootstrapping, and lifecycle orchestration.
