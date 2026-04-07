# AI Companion: Unified API Convergence Plan

## Purpose

- Canonical inventory and migration plan for Story 14.1.1 (Feature 14 / Epic 14.1).
- Align desktop, browser, and mobile-responsive clients to one authoritative API surface for protected operations.

## Inventory summary

- Desktop currently exposes broad preload IPC (`window.aiLoomDesktop`) including storage, secrets, workflows, model files, studio-shell, registry, and agents.
- Thin clients already consume HTTP `/api/v1/*` via shared clients in `src/ui/shared/*Client.ts`.
- Authoritative server routes and websocket upgrade handling are centralized in `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts`.
- Managed-service supervisor still has a direct side channel (`HttpManagedServiceSupervisorClient` + `/events` stream) outside authoritative API mediation.
- Browser fallback still includes `localStorage` and in-memory repositories in `createUiDependencies.ts`.

## Priority migration calls

1. Migrate desktop-only protected shortcuts (storage/secrets/workflow/model-file IPC) behind authoritative HTTP/WSS contracts.
2. Keep desktop IPC only as host adapter shell, not as protected resource API surface.
3. Converge runtime queue/run realtime updates to authoritative websocket channels.
4. Move managed-service external access behind authoritative API proxy; keep supervisor internals private.
5. Restrict browser fallback repositories to explicit degraded mode only.

## Domain-to-contract homes

- Identity/session: existing `src/shared/contracts/identity/IdentityTransportContracts.ts` and `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts`
- Workspace admin/invitations: existing `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts` + `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts`
- Authorization: existing `src/shared/contracts/authorization/*`, `src/shared/schemas/authorization/*`
- Nodes: existing `src/shared/contracts/nodes/NodeTrustApiContracts.ts`, `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- Storage: existing `src/shared/contracts/storage/StorageTransportContracts.ts`, `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- Assets: existing `src/shared/contracts/assets/*`
- Security metadata/certs: existing `src/shared/contracts/security/*`, `src/shared/schemas/security/*`
- Runtime/deployment transport: existing `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`, `src/shared/contracts/deployment/DeploymentTransportContracts.ts` plus schema peers

## Internal-only paths that remain acceptable

- Host composition/bootstrap (`src/hosts/*`)
- Authoritative persistence/runtime composition internals
- Electron shell lifecycle and window bootstrap internals
- In-process event stream internals when externalized only through authoritative transport

## Canonical doc

- `docs/architecture/unified-api-convergence-plan.md`
- Follow-on rules for production extension/migration governance: `docs/architecture/unified-api-authoritative-surface.md`
- Contributor checklist: `docs/unified-api-contributor-guide.md`
- Runtime convergence now includes authoritative mutation/read transport for core run/queue resources:
  - `POST /api/v1/runtime/runs/start`
  - `POST /api/v1/runtime/runs/:executionId/cancel`
  - `GET /api/v1/runtime/runs/:executionId/status`
  - `GET /api/v1/runtime/runs/:executionId/result`
  - `GET /api/v1/runtime/runs/:executionId/trace`
  - `GET /api/v1/runtime/queue`
  - `POST /api/v1/runtime/queue/:queueItemId/dequeue`

## Story 14.3.1 migration note: desktop session/context bootstrap convergence

- Desktop UI session bootstrap now initializes authoritative actor/workspace/trusted-session context from `GET /api/v1/identity/session/context` via shared identity client contracts.
- Renderer bootstrap no longer treats persisted login payload fields as authoritative actor/workspace/trust context.
- Persisted identity session state now stores a normalized allowlist projection sourced from authoritative session-context response:
  - actor identity (`userIdentityId`, `username`, `displayName`)
  - session trust posture (`assuranceLevel`, `trustState`, trust invalidation metadata)
  - workspace context (`requestedWorkspaceId`, `resolvedWorkspaceId`, visible workspace summaries)
  - derived initial capability state (resolved workspace roles/admin-owner posture)
- Desktop startup/session bootstrap failures now flow through a normalized client bootstrap error model and are surfaced in login UX as session-context initialization failures.
- Host-specific wiring remains shell-only (desktop endpoint/base-url wiring), while converged session/context authority is server-mediated.

### Story 14.3.1 tests

- `src/ui/shared/identity/tests/IdentityAuthSessionCoordinator.test.ts`
  - validates authoritative actor/workspace/trust context hydration and persistence
  - validates normalized context-unavailable bootstrap handling
- `src/ui/shared/identity/tests/IdentityAuthSessionStore.test.ts`
  - validates persistence/rehydration of normalized workspace/capability bootstrap state

## Story 14.3.2 migration note: thin-client bootstrap and workspace context convergence

- Thin web/mobile-responsive pages now rehydrate session actor context through the shared `IdentityAuthSessionCoordinator` path before protected thin-client operations.
- Thin-client workspace context bootstrap and switching now pass requested workspace ids to `GET /api/v1/identity/session/context` through shared identity client contracts.
- Focused thin-client pages (sharing review, workspace invitations, workspace memberships) now consume authoritative session/workspace context hydration rather than only trusting stale locally persisted context fields.
- Thin-client workspace switching now updates URL workspace scope and refreshes authoritative context before loading scoped workspace data.

### Story 14.3.2 tests

- `src/ui/shared/identity/tests/IdentityAuthSessionCoordinator.test.ts`
  - validates workspace-id forwarding for bootstrap and authenticated refresh flows

## Story 14.3.3 migration note: desktop operational run monitoring and queue-control convergence

- Desktop Run operational surface now consumes runtime queue list/read/mutation APIs through shared runtime client contracts instead of desktop-local operational shortcuts.
- Run monitoring reads (`status`, `result`, `trace`) and approved control actions (`cancel`, `dequeue`) flow through shared `RuntimeControlClient` contracts bound to authoritative `/api/v1/runtime/*` routes.
- Workspace/session scoping for runtime operations is now centralized in `RuntimeOperationsService`, reusing persisted identity session context and surfacing policy-denied/failure responses through the shared runtime error envelope.
- The desktop operational Run panel now presents queue visibility and run-inspection controls backed by shared contracts and shared error semantics.

### Story 14.3.3 tests

- `src/ui/shared/runtime/tests/RuntimeControlClient.test.ts`
  - validates authoritative runtime read/list/mutation route usage and shared auth/header/query conventions
- `src/ui/services/tests/RuntimeOperationsService.test.ts`
  - validates session/workspace scoped runtime operations and shared unauthorized error handling
- `src/ui/pages/tests/RunPage.test.ts`
  - validates Run surface wiring for queue visibility and runtime control actions through `RuntimeOperationsService`
