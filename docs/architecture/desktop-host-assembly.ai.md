# AI Companion: Desktop Host Assembly

## Purpose
- Define the production desktop host assembly as an explicit executable boundary for advanced authoring/administration runtime flows.
- Keep desktop startup orchestration in host composition while application/domain logic stays in inner layers.

## Main implementation seams
- Composition root: `src/hosts/desktop/DesktopHostCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/desktop/DesktopHostEntrypoint.ts`
- Electron host consumer: `electron/main/main.ts`

## Desktop boundary posture
- Desktop host remains a control-plane client runtime (`host:desktop:app-shell`), not an authoritative control-plane runtime.
- Desktop-specific startup, IPC/bridge registrations, local persistence bootstrap, and workstation runtime bootstrapping are composed through host-owned adapters.
- Desktop service coverage is asserted before feature registration so dependency composition remains explicit and controlled.

## Startup expectations
- Shared bootstrap order is preserved: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Entrypoint default startup reason: `desktop-host-entrypoint-startup`.
- Entrypoint default required dependencies: full desktop dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Electron startup now delegates through `startDesktopHostAssembly(...)` and uses host-provided callbacks for:
  - runtime bootstrap
  - renderer CSP setup
  - main-window creation
  - graceful stop/disposal

## Tests
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostEntrypoint.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
