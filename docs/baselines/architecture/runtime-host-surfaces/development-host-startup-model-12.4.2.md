# Development and Test Startup Host Migration (Story 12.4.2) Baseline

## Baseline Introduction

Snapshot date: 2026-04-11
Snapshot scope: Story 12.4.2 startup-model migration record
Why this baseline exists: Keep migration-era startup implementation notes available without competing with active runtime-host authority.
Current canonical guidance: `docs/architecture/domains/runtime-host-surfaces/overview.md`
Historical handling note: This file is historical migration context and is non-authoritative for current implementation changes.

## Historical Snapshot

Story 12.4.2 moved developer startup and harness execution paths onto the host composition framework so local workflows aligned with production composition boundaries.

### Local development startup migration

`package.json` added host-oriented local development aliases:

- `dev:host:authoritative-server`
- `dev:host:hybrid`
- `dev:host:web`
- `dev:host:worker`
- `dev:host:control-plane-worker`

Each alias used executable host entrypoints:

- `start:authoritative-server` -> `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- `start:hybrid-host` -> `src/hosts/hybrid/HybridHostEntrypoint.ts`
- `start:web-host` -> `src/hosts/web/WebHostEntrypoint.ts`
- `start:worker-host` -> `src/hosts/worker/WorkerHostEntrypoint.ts`

Combined local mode (`dev:host:control-plane-worker`) ran authoritative server and worker host assemblies together for control-plane plus execution testing.

### Desktop startup and native dependency reliability notes

- `dev:desktop:prepare` and `dev:desktop:start` were split and both ran through Node symlink-preservation flags for Windows reliability.
- Desktop preflight native module repair moved to resolve `electron-rebuild` CLI through `process.execPath` instead of wrapper binaries.
- `better-sqlite3` compatibility probing moved to a short-lived Electron subprocess to avoid Windows file-lock (`EPERM`) failures during rebuild.
- `vite.main.config.ts` externalized `sharp` and `@img/sharp-*` packages so native binaries resolved from `node_modules` at runtime.
- Generated-result preview image processing switched to runtime `sharp` dynamic import in `SharpGeneratedResultPreviewImageProcessor.ts`.

### Test harness migration notes

- Server integration harness in `src/hosts/server/tests/IdentityServerHost.test.ts` booted through `startAuthoritativeServerHostAssembly(...)`.
- `startAuthoritativeServerHostForTest(...)` was added as a host-entrypoint-backed helper.
- `dev/tests/HostDevelopmentStartupScripts.test.ts` was added to enforce startup script guardrails.

## Canonical Current Guidance

- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- `docs/architecture/host-bootstrap-pipeline.md`
