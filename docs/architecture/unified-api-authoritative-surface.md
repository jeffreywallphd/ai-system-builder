# Unified API Authoritative Surface

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.1, Establish Shared API Contracts and Access Foundations
- Story: 14.1.8, Document the authoritative API surface and migration rules for future work

## Purpose

Define the production-facing baseline for all new desktop, web, and mobile-responsive client work:

1. Protected operations must flow through one authoritative server API surface.
2. Shared request/response contracts must be reused across all clients.
3. Remaining non-converged pathways must migrate to authoritative transport without introducing client-specific shortcuts.

This document is normative for future Feature 14 convergence work.

## Authoritative surface baseline

### Required transport path for protected operations

All protected client operations must follow this path:

1. Shared contract in `src/shared/contracts/*`
2. Shared schema validation in `src/shared/schemas/*`
3. Application/backend orchestration in `src/infrastructure/api/*`
4. Authoritative HTTP or websocket exposure in `src/infrastructure/transport/http-server/*`
5. Client consumption through shared clients in `src/ui/shared/*` (usually via `src/ui/shared/api/SharedApiClient.ts`)

Desktop preload and IPC may remain as host adapters, but they must not be treated as primary protected-resource APIs.

### Shared contract ownership

- Canonical contract root: `src/shared/contracts/`
- Canonical schema root: `src/shared/schemas/`
- Existing package overview: `docs/architecture/shared-api-contract-package.md`
- Initial convergence inventory and migration context: `docs/architecture/unified-api-convergence-plan.md`

## Prohibited patterns

New work must not introduce or preserve these anti-patterns for protected flows:

1. Direct raw storage access from clients.
2. UI-only DTO drift away from shared server contracts.
3. Unauthorized local bypass paths around authoritative session and authorization checks.

### Prohibition 1: direct raw storage access

Do not add protected read/write flows that directly use raw filesystem paths, `localStorage`, or client-only repositories as a primary source of truth.

Not allowed for protected operations:

- Desktop/UI direct filesystem CRUD routed by client-specific channels.
- Browser local persistence as production authority.
- Direct mutation paths that skip server-side policy enforcement.

Allowed only for explicitly documented degraded/development fallback mode:

- Temporary, non-authoritative UX continuity with no protected/admin mutation.

### Prohibition 2: UI-only DTO drift

Do not define client-only transport DTOs that diverge from shared contracts for the same protected endpoint behavior.

Required behavior:

- Shared payloads are defined under `src/shared/contracts/*`.
- Validation contracts are defined under `src/shared/schemas/*`.
- Clients and transport adapters import shared DTOs/schemas rather than shadowing them in UI modules.

### Prohibition 3: unauthorized local bypass paths

Do not expose local shortcuts that bypass authoritative authentication, session, authorization, or audit pathways.

Examples of non-converged pathways that must continue migrating:

- Desktop preload shortcut channels in `electron/preload.ts` for protected resource mutations.
- Managed service direct side channel access (`src/infrastructure/services/HttpManagedServiceSupervisorClient.ts`, `src/ui/services/ManagedServiceEventStream.ts`) when not brokered by authoritative API authorization.
- Browser fallback persistence wiring (`src/ui/composition/createUiDependencies.ts`) used beyond explicit degraded mode.

## Extension rules for new client-facing operations

All new protected operations must follow this order:

1. Define shared contract and endpoint route constants in `src/shared/contracts/<domain>/`.
2. Define schema parse/validation in `src/shared/schemas/<domain>/`.
3. Add or extend backend API orchestration in `src/infrastructure/api/<domain>/`.
4. Expose route/handler in authoritative transport (`src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` or domain-equivalent transport module).
5. Consume via shared client modules under `src/ui/shared/<domain>/` and UI services under `src/ui/services/`.
6. Keep desktop bridge additions temporary and document explicit convergence follow-up when IPC glue is unavoidable.

Minimum acceptance for new operation design:

- Shared DTOs and schemas exist.
- Auth/session/authorization checks are centralized at authoritative transport and backend boundaries.
- Error semantics align with shared API envelope conventions.
- Any realtime behavior uses shared websocket/event contracts, not client-local event protocol forks.

## Migration guidance for remaining non-converged pathways

| Legacy pathway | Current location | Migration target | Required migration rule |
| --- | --- | --- | --- |
| Protected desktop IPC shortcuts | `electron/preload.ts`, `electron/main/main.ts` | Shared client -> authoritative HTTP/WSS -> backend API | Keep IPC as shell adapter only; no protected business mutation in preload-only channels |
| Direct managed-service client/event side channel | `src/infrastructure/services/HttpManagedServiceSupervisorClient.ts`, `src/ui/services/ManagedServiceEventStream.ts` | Authoritative API/WSS broker with shared contracts | External consumers must use authoritative auth/session scope; supervisor internals remain host-private |
| Browser-local protected persistence fallbacks | `src/ui/composition/createUiDependencies.ts`, `src/ui/composition/BrowserFallbackRepositories.ts` | Authoritative API-backed repositories | Local fallback limited to explicit degraded mode without protected/admin mutation |
| Legacy compatibility SDK contract shims | `src/infrastructure/api/*/sdk/Public*Contract.ts` | `src/shared/contracts/*` + `src/shared/schemas/*` | New endpoints must land in shared contract roots first; shims remain compatibility-only |

## Contributor checklist

Before opening a PR that adds or changes a protected client-facing operation, verify:

1. Shared contract files were added or updated under `src/shared/contracts/`.
2. Shared schema validators were added or updated under `src/shared/schemas/`.
3. Authoritative backend + transport adapters were updated under `src/infrastructure/api/` and `src/infrastructure/transport/http-server/`.
4. Desktop/web/mobile-responsive clients consume the same shared contract and client abstraction.
5. No direct raw storage path, UI-only DTO fork, or unauthorized local bypass was introduced.
6. Migration notes are documented when touching non-converged legacy pathways.

## Related docs

- `docs/architecture/unified-api-endpoint-reference.md`
- `docs/architecture/unified-api-convergence-plan.md`
- `docs/architecture/shared-api-contract-package.md`
- `docs/architecture/identity-server-api.md`
- `docs/architecture/storage-server-api.md`
