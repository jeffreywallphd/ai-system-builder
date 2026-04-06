# AI Companion: Authoritative Server Host Assembly

## Purpose
- Define the production authoritative server host assembly as the executable control-plane boundary.
- Keep host code focused on composition/startup while business logic remains in application/domain layers.

## Main implementation seams
- Composition root: `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`
- Runtime host startup implementation: `hosts/server/IdentityServerHost.ts`

## Control-plane ownership
- Authoritative server is the single runtime with control-plane authority.
- Composition explicitly covers identity, device trust, node trust, workspace administration metadata, scheduling/orchestration policy, storage policy metadata, audit hooks, and thin-client transport APIs.
- Startup asserts dependency and required-service coverage before runtime start.

## Startup expectations
- Shared bootstrap pipeline order remains authoritative: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Entrypoint default startup reason: `authoritative-server-entrypoint-startup`.
- Entrypoint default required dependencies: full authoritative dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Environment keys:
  - `AI_LOOM_SERVER_DATABASE_PATH`
  - `AI_LOOM_SERVER_HOST`
  - `AI_LOOM_SERVER_PORT`
- Script-mode behavior:
  - starts host
  - logs runtime address/phase
  - handles `SIGINT`/`SIGTERM` for graceful stop
  - exits non-zero on startup failure
- Repository command: `npm run start:authoritative-server`

## Tests
- `src/hosts/server/tests/AuthoritativeServerCompositionRoot.test.ts`
- `src/hosts/server/tests/AuthoritativeServerHostEntrypoint.test.ts`
