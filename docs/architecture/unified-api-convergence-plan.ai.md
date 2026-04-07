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

- Identity/session: proposed `src/shared/contracts/identity/*` and `src/shared/schemas/identity/*`
- Workspace admin/invitations: proposed `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts` + schema peer
- Authorization: existing `src/shared/contracts/authorization/*`, `src/shared/schemas/authorization/*`
- Nodes: existing `src/shared/contracts/nodes/NodeTrustApiContracts.ts`, `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts`
- Storage: existing `src/shared/contracts/storage/StorageTransportContracts.ts`, `src/shared/schemas/storage/StorageTransportSchemaContracts.ts`
- Assets: existing `src/shared/contracts/assets/*`
- Security metadata/certs: existing `src/shared/contracts/security/*`, `src/shared/schemas/security/*`
- Runtime/deployment transport: proposed `src/shared/contracts/runtime/*`, `src/shared/contracts/deployment/*` plus schema peers

## Internal-only paths that remain acceptable

- Host composition/bootstrap (`src/hosts/*`)
- Authoritative persistence/runtime composition internals
- Electron shell lifecycle and window bootstrap internals
- In-process event stream internals when externalized only through authoritative transport

## Canonical doc

- `docs/architecture/unified-api-convergence-plan.md`
