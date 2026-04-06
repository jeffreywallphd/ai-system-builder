# Web Host Assembly

## Intent

- Define the production web host assembly as an explicit executable boundary for thin-client delivery.
- Keep browser/runtime startup orchestration in host composition code while application/domain logic remains in inner layers.

## Main implementation seams

- Composition root: `src/hosts/web/WebHostCompositionRoot.ts`
- Dedicated entrypoint: `src/hosts/web/WebHostEntrypoint.ts`

## Web boundary posture

- Web host remains a control-plane client runtime (`host:web:thin-client`) and never claims authoritative control-plane ownership.
- Web startup composes thin-client delivery concerns (delivery mode + base path) through host-owned configuration without mixing in worker/runtime execution responsibilities.
- Web service coverage is asserted before feature registration so runtime composition remains explicit.

## Startup expectations

- Shared bootstrap order is preserved: `configuration`, `dependencies`, `logging`, `security`, `persistence`, `feature-registration`.
- Entrypoint default startup reason: `web-host-entrypoint-startup`.
- Entrypoint default required dependencies: full web dependency boundary from `src/hosts/HostRuntimeCatalog.ts`.
- Environment keys:
  - `AI_LOOM_WEB_DELIVERY_MODE` (`thin-client` | `static-shell`)
  - `AI_LOOM_WEB_BASE_PATH`
- Repository command: `npm run start:web-host`

## Tests

- `src/hosts/web/tests/WebHostCompositionRoot.test.ts`
- `src/hosts/web/tests/WebHostEntrypoint.test.ts`
- `src/infrastructure/config/tests/HostServiceRegistrationCatalog.test.ts`
