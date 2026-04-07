# Worker Host Assembly

## Intent

- Define the production worker host assembly as an explicit executable boundary for runtime/background execution.
- Keep worker startup and execution capability composition in host code while src/application/domain orchestration remains in inner layers.

## Main implementation seams

- Composition root: `src/hosts/worker/WorkerHostCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/worker/WorkerHostEntrypoint.ts`

## Worker boundary posture

- Worker host runs as a non-control-plane runtime (`host:worker:runtime`) and never claims authoritative control-plane ownership.
- Worker startup enforces explicit execution capability composition (`node-execution` + `worker-runtime`) and rejects mismatched combinations.
- Worker composition now carries an explicit node-registration capability context so future capability-based node registration can remain host-owned and deterministic.
- Worker service coverage is asserted before feature registration so runtime execution composition is explicit and testable.

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
