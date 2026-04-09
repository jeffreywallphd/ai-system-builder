# AI Companion: Development and Test Startup Host Migration (Story 12.4.2)

## Scope completed
- Align local development scripts and test harness startup with host entrypoint assemblies.

## Development startup updates
- Added explicit host-based local dev aliases in `package.json`:
  - `dev:host:authoritative-server`
  - `dev:host:hybrid`
  - `dev:host:web`
  - `dev:host:worker`
  - `dev:host:control-plane-worker`
- These aliases delegate to executable host entrypoints:
  - `start:authoritative-server`
  - `start:hybrid-host`
  - `start:web-host`
  - `start:worker-host`
- Combined control-plane + worker local mode now runs both host assemblies concurrently.
- Desktop dev startup now routes preflight and Electron Forge CLI through Node symlink-preservation flags:
  - `dev:desktop:prepare` -> `node --preserve-symlinks-main dev/prepare-electron-forge-dev.cjs`
  - `dev:desktop:start` -> `node --preserve-symlinks --preserve-symlinks-main node_modules/@electron-forge/cli/dist/electron-forge.js start`
  - `dev:desktop` chains `prepare` then `start`.
- Electron main-process Vite bundling now treats native image-processing runtime dependencies as external:
  - `vite.main.config.ts` externalizes `sharp` and `@img/sharp-*` packages, including resolved `node_modules` path variants, so Electron resolves native binaries from `node_modules` at runtime.

## Test harness updates
- Server integration harness in `src/hosts/server/tests/IdentityServerHost.test.ts` now boots through `startAuthoritativeServerHostAssembly(...)`.
- Added a host-entrypoint-backed test helper (`startAuthoritativeServerHostForTest(...)`) so tests keep existing host assertions while startup path is host-based.

## Startup script guardrails
- Added `dev/tests/HostDevelopmentStartupScripts.test.ts` to enforce:
  - default dev path remains `dev:desktop`
  - desktop startup scripts keep symlink-preservation Node flags in place for Windows-safe script resolution
  - host startup scripts target host entrypoint assemblies
  - host aliases and combined mode are present
  - no package script defaults to direct `IdentityServerHost.ts` startup

## Browser development runtime bootstrap path correction
- Browser-mode Vite bootstrap now resolves repository root through a shared browser-development path module:
  - `src/infrastructure/runtime/browser-development/BrowserDevelopmentPaths.ts`
- This removes duplicate path math and prevents `src/src/...` runtime entrypoint resolution during managed runtime auto-start (including `service-supervisor.js` and authoritative server startup).
- Added regression coverage in:
  - `src/infrastructure/runtime/tests/BrowserDevelopmentPaths.test.ts`
  - Verifies bootstrap path resolution reaches repository root and expected runtime entrypoint.

## Developer documentation updates
- Updated `README.md` with a host-based local startup modes section and command list for individual and combined host runs.
