# Hybrid Host Assembly

## Purpose

Define the concrete hybrid executable host assembly for workstation-plus-platform-adjacent deployment scenarios.

The hybrid assembly keeps desktop-facing runtime composition and local node/runtime composition explicit, while preserving control-plane ownership boundaries.

## Main implementation seams

- Composition root: `src/hosts/hybrid/HybridHostCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/hybrid/HybridHostEntrypoint.ts`
- Intentional authoritative delegation seam: `src/hosts/server/AuthoritativeServerHostEntrypoint.ts`

## Hybrid boundary posture

- Default hybrid runtime remains a control-plane client (`host:hybrid:desktop-worker`).
- Hybrid composition requires explicit, bounded capability composition:
  - desktop shell
  - UI rendering
  - IPC bridge
  - local persistence
  - node execution
  - worker runtime
- Hybrid startup composes host service registration plans and asserts required hybrid coverage before runtime feature registration.
- Hybrid composition root rejects direct local authoritative ownership configuration to avoid collapsing server authority into the hybrid runtime boundary.

## Valid and disallowed deployment patterns

- Valid:
  - `hybrid-client` mode with remote authoritative control-plane source.
  - desktop-plus-local-execution composition through hybrid service registration.
- Intentionally authoritative:
  - `authoritative-server-host` mode delegates runtime startup to the authoritative server host assembly.
  - control-plane authority remains owned by authoritative server contracts (`host:server:authoritative`).
- Disallowed:
  - local authoritative source configured directly on hybrid composition root.
  - node execution enabled without worker runtime (or vice versa).
  - required desktop-facing capabilities disabled.

## Startup expectations

- Canonical bootstrap order remains: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Default startup reason: `hybrid-host-entrypoint-startup`.
- Default required dependencies: all hybrid host startup dependencies from `src/hosts/HostRuntimeCatalog.ts`.
- Environment controls:
  - `AI_LOOM_HYBRID_HOST_MODE` (`hybrid-client` | `authoritative-server-host`)
  - `AI_LOOM_HYBRID_CONTROL_PLANE_SOURCE` (`remote-authoritative-server` | `local-authoritative-server-delegated`)
  - `AI_LOOM_HYBRID_ENABLE_NODE_EXECUTION`
  - `AI_LOOM_HYBRID_ENABLE_WORKER_RUNTIME`
- Repository command: `npm run start:hybrid-host`

## Tests

- `src/hosts/hybrid/tests/HybridHostCompositionRoot.test.ts`
- `src/hosts/hybrid/tests/HybridHostEntrypoint.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
