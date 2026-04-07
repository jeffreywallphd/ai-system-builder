# Unified API Convergence Plan

## Story alignment

- Feature: 14, Desktop and Thin-Client Unified API Surface
- Epic: 14.1, Establish Shared API Contracts and Access Foundations
- Story: 14.1.1, inventory existing access patterns and define convergence plan

This document captures the current client-access inventory and the target convergence posture so desktop, web, and mobile-responsive clients consume the same authoritative contracts for protected operations.

## Scope

- Included: protected resources, run control, auth/session, queue and realtime updates, assets, storage, secrets/certificates, workspace and authorization admin operations.
- Included surfaces: desktop Electron IPC/preload, web/thin HTTP clients, HTTP/WSS server transport, managed-service side channel, browser fallback persistence paths.
- Excluded: implementation of new APIs. This story defines migration plan and contract ownership.

## Current inventory by surface

| Surface | Responsibility | Current entry points | Current transport and data path | Target posture |
| --- | --- | --- | --- | --- |
| Desktop preload bridge | Desktop UI access to host capabilities | `electron/preload.ts`, `electron/shared/DesktopContracts.ts` | `contextBridge` + `ipcRenderer.sendSync/invoke` channels (`ai-loom-desktop-*`) | Keep as internal adapter only; desktop bridge should call authoritative HTTP/WSS contracts instead of exposing raw capability shortcuts |
| Desktop main IPC handlers | Host-side operation dispatch | `electron/main/main.ts` (`ipcMain.on/handle`) | IPC handlers invoke backend APIs/use cases; some handlers perform direct `fs` operations | Converge protected operations to authoritative server APIs; preserve only host-internal lifecycle/bootstrap IPC |
| Thin-client shared HTTP clients | Cross-client API consumption | `src/ui/shared/*Client.ts` and `src/ui/services/*Service.ts` | `fetch` to `/api/v1/*` using shared DTO/API contract types | Keep and expand as canonical client pattern |
| Authoritative HTTP/WSS transport | Server contract enforcement | `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` | Node HTTP routes + secure websocket upgrade handling, auth and policy checks | Keep as canonical authoritative surface |
| Application backend API adapters | App-layer orchestration for transport | `src/infrastructure/api/*BackendApi.ts` | Route handlers map transport DTOs to use-case orchestration | Keep; continue using as transport-to-application boundary |
| Managed-service supervisor side channel | Runtime service management and events | `electron/main/DesktopServiceSupervisor.ts`, `src/infrastructure/services/HttpManagedServiceSupervisorClient.ts`, `src/ui/services/ManagedServiceEventStream.ts` | Direct HTTP calls to supervisor (`/services`, `/events`) outside authoritative API | Migrate externalized operations behind authoritative API/WSS proxy; keep supervisor internals host-private |
| Browser fallback persistence | Local fallback repositories | `src/ui/composition/createUiDependencies.ts`, `src/ui/composition/BrowserFallbackRepositories.ts` | `window.localStorage` and in-memory repositories for workflows/runs/context/settings | Keep only for explicit degraded/offline development mode; not valid for protected production operations |

## Domain convergence map

| API domain | Current entry points | Current application owners | Target authoritative endpoints | Shared contract home |
| --- | --- | --- | --- | --- |
| Identity and session | `src/ui/services/IdentityAuthService.ts`, `src/ui/shared/identity/IdentityAuthClient.ts`, `src/infrastructure/transport/http-server/identity/IdentityHttpServer.ts` | `src/infrastructure/api/identity/IdentityAuthBackendApi.ts` + identity use cases under `src/application/identity/use-cases/*` | `/api/v1/identity/*` over HTTPS/WSS-authenticated sessions | Existing: `src/shared/contracts/identity/IdentityTransportContracts.ts`, `src/shared/schemas/identity/IdentityTransportSchemaContracts.ts` |
| Workspace admin and invitations | `src/ui/services/WorkspaceAdministrationService.ts`, `src/ui/shared/workspaces/WorkspaceAdministrationClient.ts`, workspace routes in `IdentityHttpServer` | `src/infrastructure/api/workspaces/WorkspaceAdministrationBackendApi.ts`, `WorkspaceInvitationBackendApi.ts` + `src/application/workspaces/use-cases/*` | `/api/v1/workspaces/*` | Existing: `src/shared/contracts/workspaces/WorkspaceTransportContracts.ts`, `src/shared/schemas/workspaces/WorkspaceTransportSchemaContracts.ts` |
| Authorization sharing/access review | `src/ui/services/AuthorizationManagementService.ts`, `src/ui/shared/authorization/AuthorizationManagementClient.ts` | `src/infrastructure/api/authorization/AuthorizationManagementBackendApi.ts` + `src/application/authorization/use-cases/*` | `/api/v1/authorization/*` | Existing: `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`, `src/shared/schemas/authorization/AuthorizationSchemaContracts.ts` |
| Node enrollment and inventory | `src/ui/services/NodeEnrollmentReviewService.ts`, `NodeInventoryService.ts`, `src/ui/shared/nodes/*Client.ts` | `src/infrastructure/api/nodes/NodeTrustBackendApi.ts` + `src/application/nodes/use-cases/*` | `/api/v1/nodes/*` | Existing: `src/shared/contracts/nodes/NodeTrustApiContracts.ts`, `src/shared/schemas/nodes/NodeTrustApiSchemaContracts.ts` |
| Storage administration | `src/ui/services/StorageAdministrationService.ts`, `src/ui/shared/storage/StorageAdministrationClient.ts` | `src/infrastructure/api/storage/StorageManagementBackendApi.ts` + `src/application/storage/use-cases/StorageManagementService.ts` | `/api/v1/storage/*` | Existing: `src/shared/contracts/storage/StorageTransportContracts.ts`, `src/shared/schemas/storage/StorageTransportSchemaContracts.ts` |
| Asset access and protected downloads | `src/ui/services/AssetWorkflowService.ts`, `src/ui/shared/assets/AssetWorkflowClient.ts` | `src/infrastructure/api/assets/AssetManagementBackendApi.ts` + `src/application/assets/use-cases/*` | `/api/v1/assets/*` | Existing: `src/shared/contracts/assets/AssetTransportContracts.ts`, `src/shared/contracts/assets/AssetWorkflowClientContracts.ts` |
| Secret metadata and certificate admin | `src/ui/services/SecretMetadataManagementService.ts`, HTTP server security routes | `src/infrastructure/api/security/SecretMetadataBackendApi.ts`, `CertificateOperationsBackendApi.ts` + `src/application/security/use-cases/*` | `/api/v1/security/*` | Existing: `src/shared/contracts/security/SecretTransportContracts.ts`, `src/shared/schemas/security/SecretApiSchemaContracts.ts`, `src/shared/schemas/security/CertificateAuthoritySchemaContracts.ts` |
| Runtime run control, queue, trace, results | `src/infrastructure/api/system-runtime/SystemRuntimeBackendApi.ts`, `RuntimeRequestRouter.ts`, SDK transports | `src/application/system-runtime/*` use cases via backend API | Authoritative HTTP + WSS channels for execution lifecycle and queue visibility | Existing: `src/shared/contracts/runtime/SystemRuntimeTransportContracts.ts`, `src/shared/schemas/runtime/SystemRuntimeTransportSchemaContracts.ts` |
| Deployment/runtime orchestration SDK | `src/infrastructure/api/deployment/sdk/*`, `src/infrastructure/api/system-runtime/sdk/*` | Deployment and runtime backend APIs | Authoritative HTTP for deploy control; WSS for live state where needed | Existing: `src/shared/contracts/deployment/DeploymentTransportContracts.ts`, `src/shared/schemas/deployment/DeploymentTransportSchemaContracts.ts` |

## Direct/raw access paths to migrate

These are the primary paths that violate the unified authoritative API direction for protected operations:

1. Desktop synchronous IPC key/value and secrets shortcuts in `electron/preload.ts` (`ai-loom-desktop-storage:*`, `ai-loom-desktop-secrets:*`).
2. Desktop raw model filesystem CRUD channels (`ai-loom-desktop-model-files:*`) implemented directly with `fs` in `electron/main/main.ts`.
3. Desktop workflow persistence shortcuts (`ai-loom-desktop-workflows:*`) bypassing authoritative transport contracts.
4. Managed service supervisor direct HTTP and SSE access (`HttpManagedServiceSupervisorClient`, `ManagedServiceEventStream` on `/events`) that is not brokered by authoritative API authorization.
5. Browser `localStorage` and in-memory persistence fallbacks for workflow/run/context state in `createUiDependencies.ts` and `BrowserFallbackRepositories.ts` when used beyond explicit degraded mode.

## Internal pathways that can remain internal

These can remain implementation details as long as protected business actions flow through authoritative APIs:

1. Host assembly/bootstrap composition (`src/hosts/*CompositionRoot.ts`, `*HostEntrypoint.ts`).
2. Persistent-platform repository composition in authoritative host startup (`src/hosts/server/AuthoritativeServerCompositionRoot.ts`).
3. Electron window lifecycle, CSP setup, and runtime window orchestration that do not expose protected resource mutation directly.
4. In-process execution event stream plumbing (`ExecutionUpdateStream`) when surfaced outward only via authoritative WSS contracts.

## Convergence phases

1. Contract consolidation: establish missing shared contract homes under `src/shared/contracts/*` and matching schema validators under `src/shared/schemas/*` for identity, workspaces transport, runtime/deployment transport. Status: completed for initial transport baselines.
2. Transport normalization: route desktop bridge operations through authoritative HTTP/WSS clients first, then reduce preload surface to minimal host bootstrap and non-sensitive shell capabilities.
3. Policy and session unification: require the same actor/session context envelope across desktop bridge mediated requests and thin-client HTTP/WSS.
4. Realtime convergence: expose run/queue/managed-service updates through authoritative websocket channels; relegate direct `/events` supervisor stream to host-internal.
5. Fallback containment: constrain browser-local repositories to explicitly flagged degraded mode with no protected/admin mutations.

## Migration guardrails

1. New protected operations must land first in authoritative backend API + HTTP/WSS transport and only then be consumed by desktop/web clients.
2. Any new shared payload contract must be rooted in `src/shared/contracts` and validated in `src/shared/schemas`.
3. Desktop IPC additions must be treated as temporary adapters and include a convergence note to target HTTP/WSS parity.
4. List/detail endpoints must preserve centralized authorization filtering and non-leaky deny behavior.

## Verification notes for this story

- Inventory and plan are documented in architecture docs and tied to concrete source entry points.
- Each target API domain has an identified shared contract home (existing or proposed path under `src/shared/contracts` or `src/shared/schemas`).
- Violating raw/direct access pathways are explicitly enumerated for migration.
- Authoritative runtime mutation/read endpoints now include shared run launch/cancel/trace/status/result and queue list/dequeue actions (`/api/v1/runtime/runs/start`, `/api/v1/runtime/runs/:executionId/cancel`, `/api/v1/runtime/runs/*`, `/api/v1/runtime/queue`, `/api/v1/runtime/queue/:queueItemId/dequeue`).

## Follow-on governance docs

- Production-facing extension and prohibition rules for future work are documented in `docs/architecture/unified-api-authoritative-surface.md` (Story 14.1.8).
- Contributor execution checklist is documented in `docs/unified-api-contributor-guide.md`.

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

## Story 14.3.4 migration note: thin-client operational runtime surfaces converge on shared APIs

- Thin-client operational run controls on `src/ui/pages/RunPage.tsx` now consume shared runtime service contracts for:
  - queue review (`listQueueItems`),
  - run inspection (`inspectRun` using shared status/result/trace reads),
  - approved mutation actions (`cancelRun`, `dequeueQueueItem`),
  - allowed launch flow (`startRun`) with approved-parameter metadata.
- Thin-client launch and inspection UX now follows canonical list/detail/mutation semantics:
  - list: queue read with shared status filters and pagination defaults,
  - detail: execution inspection projection backed by shared status/result/trace contracts,
  - mutation: start/cancel/dequeue routed through authoritative runtime routes with unified error envelopes.
- Runtime shared client query construction now aligns with shared list-query helper conventions in `src/shared/contracts/api/SharedApiQueryConventions.ts` for queue/result/trace reads.
- Page-level operational business semantics are now centralized in `RuntimeOperationsService`; the page renders thin-client inputs and result states without owning runtime transport decisions.

### Story 14.3.4 tests

- `src/ui/services/tests/RuntimeOperationsService.test.ts`
  - validates thin-client run launch, queue review, and inspection calls use workspace/session-scoped shared runtime client contracts.
- `src/ui/pages/tests/RunPage.test.ts`
  - validates thin-client operational screen wiring includes allowed launch, approved-parameter handling entry points, queue review, and shared inspection/mutation calls.

## Story 14.3.5 migration note: desktop/thin runtime realtime subscription convergence

- Shared runtime realtime subscription behavior is now centralized in `src/ui/shared/runtime/RuntimeRealtimeSubscriptionService.ts` and re-exported via `src/shared/runtime/RuntimeRealtimeSubscriptionService.ts`.
- Desktop and thin run/queue operational UX on `src/ui/pages/RunPage.tsx` now binds queue changes, run status changes, and runtime connectivity state updates to authoritative runtime realtime websocket topics (`runtime.queue`, `runtime.run.status`, `runtime.connectivity`).
- Reconnect and stale-data fallback behavior is normalized in the shared subscription service:
  - reconnect attempts with cursor resume (`resume-from-cursor`) after transient disconnects,
  - shared fallback refresh loop while channel state is stale/reconnecting/degraded,
  - centralized connection-state snapshots (`connecting`, `connected`, `reconnecting`, `degraded`, `disconnected`) for screen rendering.
- Run screen components no longer embed websocket mechanics directly; page-level code consumes shared callbacks and keeps operational rendering focused on state presentation.
- Identity websocket upgrade now accepts runtime auth token transport via runtime auth subprotocol for browser/Electron websocket compatibility while preserving bearer-header support.

### Story 14.3.5 tests

- `src/ui/shared/runtime/tests/RuntimeRealtimeSubscriptionService.test.ts`
  - validates canonical runtime topic subscription payloads, realtime event routing, reconnect cursor resume behavior, and stale-data fallback refresh execution.
- `src/ui/pages/tests/RunPage.test.ts`
  - validates Run screen wiring includes shared realtime subscription service usage and runtime connectivity/stale-state presentation.
- `src/infrastructure/transport/http-server/identity/tests/IdentityHttpServerRuntimeRealtimeWebSocket.test.ts`
  - validates websocket upgrade authentication supports runtime auth subprotocol token flow and preserves canonical realtime subscribe/ack behavior.
