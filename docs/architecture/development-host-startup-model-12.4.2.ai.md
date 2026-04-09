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
- Desktop preflight native dependency repair now resolves the `electron-rebuild` package CLI and executes it through the active Node runtime (`process.execPath`) rather than invoking wrapper binaries directly, which avoids Windows `.cmd` spawn `EINVAL` failures during `better-sqlite3` rebuild attempts.
- Desktop preflight compatibility checks now execute `better-sqlite3` runtime probes in short-lived Node/Electron subprocesses (instead of the persistent preflight process), which avoids Windows file-lock `EPERM` failures when `electron-rebuild` unlinks `better_sqlite3.node`.
- Electron main-process Vite bundling now treats native image-processing runtime dependencies as external:
  - `vite.main.config.ts` externalizes `sharp` and `@img/sharp-*` packages, including resolved `node_modules` path variants plus CommonJS virtual ID prefixes used in Rollup (`commonjs-external:*` and `/@id/*`) so Electron resolves native binaries from `node_modules` at runtime.
- Generated-result preview image processing now loads `sharp` at runtime in `src/infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor.ts` using dynamic import to prevent static sharp bundling in Electron main while preserving image derivative behavior.

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
