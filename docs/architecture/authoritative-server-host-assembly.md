# Authoritative Server Host Assembly

## Purpose

Define the concrete authoritative server executable host assembly that serves as AI Loom's single control-plane runtime composition boundary.

The host assembly is responsible for runtime composition and startup orchestration only. Business logic remains in application services and domain contracts.

## Runtime authority stance

- The authoritative server host is the only runtime with control-plane authority (`host:server:authoritative`).
- Desktop, hybrid, web, and worker hosts are non-authoritative clients or execution surfaces.
- Control-plane authority and node execution remain separate concerns by contract.

## Composition root and entrypoint

- Composition root: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- Dedicated entrypoint assembly: `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- Runtime host implementation composed by the root: `src/hosts/server/IdentityServerHost.ts`
- Authoritative persistence composition seam: `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`

The entrypoint composes and starts the host through:
1. `constructAuthoritativeServerHostAssembly(...)`
2. `startAuthoritativeServerHostAssembly(...)`

## Control-plane composition responsibilities

The authoritative host composition explicitly wires control-plane coverage for:
- identity
- trusted devices
- node trust
- workspace metadata and administration
- scheduling and orchestration policy
- storage metadata and policy
- audit and observability hooks
- thin-client API transport delivery

The host validates startup dependency coverage and authoritative service coverage before starting runtime transport.

## Startup expectations

The entrypoint defaults to a full authoritative startup dependency contract and uses the shared host bootstrap pipeline (`configuration -> dependencies -> logging -> security -> persistence -> feature-registration`).

### Environment keys

- `AI_LOOM_SERVER_DATABASE_PATH`: SQLite path for authoritative server persistence.
- `AI_LOOM_SERVER_HOST`: bind address (for example `127.0.0.1`).
- `AI_LOOM_SERVER_PORT`: bind port.
- `AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH`: optional SQLite bootstrap fallback path.
- `AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE`: optional SQLite journal mode override for bootstrap/runtime initialization.
- `AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS`: optional SQLite foreign-key enforcement toggle for bootstrap/runtime initialization.

### Defaults

- Startup reason defaults to `authoritative-server-entrypoint-startup`.
- Required startup dependencies default to the complete authoritative host dependency boundary declared in `src/hosts/HostRuntimeCatalog.ts`.
- Database path defaults to `runtime-assets/server/authoritative-server.sqlite` relative to the process working directory when not provided.

### Process lifecycle

When run as a script, the entrypoint:
- starts the authoritative host
- logs startup address and phase
- handles `SIGINT`/`SIGTERM` by stopping the host gracefully
- exits non-zero on startup failure

During host composition:
- the bootstrap `persistence` stage initializes the shared SQLite persistence runtime (`src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`)
- the bootstrap `persistence` stage composes authoritative persistent platform services (repository adapters, audit sinks, and platform run/audit persistence adapter) and stores them as startup artifacts
- the bootstrap `feature-registration` stage injects startup-composed persistent platform services into `startIdentityServerHost(...)`
- startup failure cleanup disposes persistence runtime resources
- startup failure cleanup also disposes composed persistent platform services
- normal host shutdown also disposes composed persistent platform services and persistence runtime resources after host transport shutdown

Repository startup command:
- `npm run start:authoritative-server`

## Entrypoint consumers

In addition to the direct server script entrypoint above, runtime startup consumers now route through this same authoritative host assembly:

- `electron/main/main.ts` (desktop host local control-plane startup)
- `src/infrastructure/runtime/browser-development/createBrowserDevelopmentVitePlugin.ts` (browser-development local control-plane startup)

## Testing

Host assembly coverage lives in:
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/server/tests/AuthoritativeServerHostEntrypoint.test.ts`
