# AI Companion: Worker Host Assembly

## Purpose
- Define the production worker host assembly as an explicit executable boundary for runtime/background execution.
- Keep execution capability composition and worker startup in host composition while src/application/domain logic stays in inner layers.

## Main implementation seams
- Composition root: `src/hosts/worker/WorkerHostCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/worker/WorkerHostEntrypoint.ts`

## Worker boundary posture
- Worker host runs with control-plane role `none` (`host:worker:runtime`), not authoritative control-plane ownership.
- Worker startup requires `node-execution` and `worker-runtime` capabilities to remain enabled together.
- Worker runtime start context now carries explicit node-registration capabilities so future capability-based node registration can remain deterministic and host-owned.
- Worker service coverage is asserted before feature registration startup.

## Startup expectations
- Shared bootstrap order is preserved: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Entrypoint default startup reason: `worker-host-entrypoint-startup`.
- Entrypoint default required dependencies: full worker dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Environment keys:
  - `AI_LOOM_WORKER_ENABLE_NODE_EXECUTION`
  - `AI_LOOM_WORKER_ENABLE_WORKER_RUNTIME`
  - `AI_LOOM_WORKER_NODE_REGISTRATION_CAPABILITIES`
- Repository command: `npm run start:worker-host`

## Tests
- `src/hosts/worker/tests/WorkerHostCompositionRoot.test.ts`
- `src/hosts/worker/tests/WorkerHostEntrypoint.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
