# AI Companion: Entrypoint Host Composition Migration (Story 12.4.1)

## Scope completed
- Migrate real runtime entrypoints that still bypassed host assemblies onto explicit composition-root entrypoints.

## Entrypoints migrated
- `electron/main/main.ts`
  - replaced direct `startIdentityServerHost(...)` startup with `startAuthoritativeServerHostAssembly(...)`
  - local identity API endpoint derivation now uses authoritative runtime handle address
  - runtime shutdown now stops authoritative host runtime through host assembly lifecycle
- `infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts`
  - replaced direct `startIdentityServerHost(...)` startup with `startAuthoritativeServerHostAssembly(...)`
  - added `createBrowserDevelopmentAuthoritativeServerHostOptions(...)` as a thin entrypoint bridge
  - shutdown now stops authoritative host runtime handle

## Compatibility notes
- Existing local control-plane behavior for desktop/browser development is preserved.
- Existing host/port/CORS behavior is preserved.
- Startup reason is now explicit for migrated paths:
  - `electron-main-authoritative-server-host-startup`
  - `browser-development-vite-authoritative-host-startup`

## Validation
- Added focused test coverage for browser-development entrypoint option bridging:
  - `infrastructure/runtime/tests/BrowserDevelopmentHostEntrypointBridge.test.ts`
