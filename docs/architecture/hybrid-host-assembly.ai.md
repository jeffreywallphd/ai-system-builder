# AI Companion: Hybrid Host Assembly

## Purpose
- Define the production hybrid host assembly for workstation-plus-platform-adjacent deployment scenarios.
- Keep hybrid runtime composition explicit so desktop and local node/runtime capabilities can coexist without collapsing control-plane ownership.

## Main implementation seams
- Composition root: `src/hosts/hybrid/HybridHostCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/hybrid/HybridHostEntrypoint.ts`
- Authoritative delegation seam (intentional authoritative mode only): `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`

## Hybrid boundary posture
- Hybrid host remains a control-plane client runtime by default (`host:hybrid:desktop-worker`).
- Hybrid composition requires desktop-facing and local runtime capabilities to stay explicitly enabled together:
  - desktop shell
  - UI rendering
  - IPC bridge
  - local persistence
  - node execution
  - worker runtime
- Hybrid service coverage is asserted before feature registration startup through `assertHybridHostServiceCoverage(...)`.
- Hybrid composition root rejects local authoritative control-plane ownership to prevent mixed authority/runtime ambiguity.

## Valid and disallowed deployment patterns
- Valid:
  - `hybrid-client` assembly mode with remote authoritative control-plane source.
  - bounded desktop + local execution runtime composition through hybrid service registration.
- Intentionally authoritative:
  - `authoritative-server-host` assembly mode delegates to authoritative server host assembly startup.
  - control-plane authority remains owned by server runtime contracts (`host:server:authoritative`).
- Disallowed:
  - hybrid composition root configured with `local-authoritative-server-delegated` control-plane source.
  - node execution enabled without worker runtime (or worker runtime enabled without node execution).
  - disabling required desktop-facing capabilities.

## Startup expectations
- Shared bootstrap order is preserved: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Entrypoint default startup reason: `hybrid-host-entrypoint-startup`.
- Entrypoint default required dependencies: full hybrid dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Environment keys:
  - `AI_LOOM_HYBRID_HOST_MODE` (`hybrid-client` | `authoritative-server-host`)
  - `AI_LOOM_HYBRID_CONTROL_PLANE_SOURCE` (`remote-authoritative-server` | `local-authoritative-server-delegated`)
  - `AI_LOOM_HYBRID_ENABLE_NODE_EXECUTION`
  - `AI_LOOM_HYBRID_ENABLE_WORKER_RUNTIME`
- Repository command: `npm run start:hybrid-host`

## Tests
- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostEntrypoint.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
