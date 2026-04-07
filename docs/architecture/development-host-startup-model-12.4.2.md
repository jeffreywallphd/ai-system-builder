# Development and Test Startup Host Migration (Story 12.4.2)

Story 12.4.2 moves developer startup and harness execution paths onto the host composition framework so local workflows match production composition boundaries.

## What changed

### Local development scripts now expose host-first startup modes

`package.json` now includes host-oriented local development aliases:

- `dev:host:authoritative-server`
- `dev:host:hybrid`
- `dev:host:web`
- `dev:host:worker`
- `dev:host:control-plane-worker`

Each alias runs through one of the executable host entrypoints already defined in the host framework:

- `start:authoritative-server` -> `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- `start:hybrid-host` -> `src/hosts/hybrid/HybridHostEntrypoint.ts`
- `start:web-host` -> `src/hosts/web/WebHostEntrypoint.ts`
- `start:worker-host` -> `src/hosts/worker/WorkerHostEntrypoint.ts`

The new combined mode (`dev:host:control-plane-worker`) uses `concurrently` to run the authoritative server and worker host assemblies together for local control-plane plus execution testing.

Desktop development startup also separates Electron Forge launch into `dev:desktop:start` and runs both desktop preflight and Forge CLI through Node symlink-preservation flags:

- `dev:desktop:prepare` -> `node --preserve-symlinks-main dev/prepare-electron-forge-dev.cjs`
- `dev:desktop:start` -> `node --preserve-symlinks --preserve-symlinks-main node_modules/@electron-forge/cli/dist/electron-forge.js start`

This keeps the default `npm run dev` workflow stable on Windows hosts where parent-directory realpath resolution can fail under restricted ACLs.

### Server integration harness startup now runs through host assembly entrypoint

`src/hosts/server/tests/IdentityServerHost.test.ts` now starts runtime hosts via a dedicated helper that composes startup through `startAuthoritativeServerHostAssembly(...)`.

The helper preserves existing test ergonomics (`address`, `secretService`, and `close`) while routing startup and shutdown through host lifecycle coordination. This keeps the test harness aligned with production host composition without rewriting integration assertions.

### Guardrail test coverage for startup scripts

Added `dev/tests/HostDevelopmentStartupScripts.test.ts` to validate startup workflow contracts:

- default development command remains `npm run dev:desktop`
- desktop startup scripts use symlink-preservation Node flags for preflight and Electron Forge entrypoint invocation
- host startup scripts resolve to host entrypoint assemblies
- host-based aliases and combined local mode remain defined
- package scripts do not use direct legacy `IdentityServerHost.ts` startup as a default path

## Developer-facing startup model

- Standard local app development remains: `npm run dev` (desktop host path).
- Host-specific local startup can be run directly through `npm run dev:host:*` commands.
- Combined local control-plane + worker mode is available with:
  - `npm run dev:host:control-plane-worker`

This keeps local startup behavior composition-root-first while preserving fast feedback loops.
