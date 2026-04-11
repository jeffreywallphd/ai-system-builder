# Desktop Host Assembly

## Purpose

Define the concrete desktop executable host assembly for advanced authoring, administration, and local workstation runtime flows.

The desktop host assembly owns host composition and startup orchestration only. Domain and application behavior remains in inner-layer contracts and use cases.

## Composition root and entrypoint

- Composition root: `src/hosts/desktop/DesktopHostCompositionRoot.ts`
- Dedicated entrypoint assembly: `src/hosts/desktop/DesktopHostEntrypoint.ts`
- Electron main-process runtime wiring consumed by the host assembly: `electron/main/main.ts`

The entrypoint composes and starts the desktop host through:
1. `constructDesktopHostAssembly(...)`
2. `startDesktopHostAssembly(...)`

## Desktop runtime responsibilities

Desktop host composition explicitly wires:
- desktop shell startup and renderer window creation
- preload/IPC transport registration
- local cache/persistence bootstrapping
- offline local-mode boundaries (cache vs local draft vs queued sync intent vs local-ephemeral runtime state)
- runtime supervisor/bootstrap dependencies for workstation execution
- authoring and administration bridge surfaces as control-plane client behavior

This keeps desktop runtime concerns behind host-owned adapters and avoids leaking desktop composition into server-host boundaries.

## Separation from authoritative server

- Authoritative control-plane composition remains isolated to `host:server:authoritative`.
- Desktop host is `host:desktop:app-shell` with control-plane client role only.
- Desktop assembly service coverage is asserted against desktop-required host services before feature registration starts host runtime.

## Startup expectations

Desktop host startup runs through the shared bootstrap pipeline:
- `configuration`
- `dependencies`
- `logging`
- `security`
- `persistence`
- `feature-registration`

Defaults:
- startup reason: `desktop-host-entrypoint-startup`
- required startup dependencies: full desktop dependency boundary from `src/hosts/HostRuntimeCatalog.ts`

Electron main now executes through the desktop host assembly and supplies host-owned adapters for:
- desktop runtime bootstrap
- renderer content security policy installation
- initial window creation
- graceful host stop and local runtime resource disposal

Renderer CSP now pre-authorizes loopback deferred-runtime endpoints (`http://127.0.0.1:8790` service supervisor and `http://127.0.0.1:8100` python runtime) for desktop host modes so post-login runtime warmup calls are not blocked by pre-login document policy while still remaining loopback-scoped.

## Testing

Desktop host assembly coverage lives in:
- `src/hosts/desktop/tests/DesktopHostCompositionRoot.test.ts`
- `src/hosts/desktop/tests/DesktopHostEntrypoint.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts` (desktop required-service coverage assertions)
