---
title: ADR-001 Single Authoritative Control Plane
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 001
decision_status: accepted
decision_date: 2026-04-11
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts/HostRuntimeCatalog.ts
  - src/hosts/server/AuthoritativeServerCompositionRoot.ts
  - src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts
  - src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts
  - electron/main/main.ts
---

# ADR-001: Single Authoritative Control Plane

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio maintains one authoritative control plane in the server host runtime (`host:server:authoritative`). Control-plane mutations, orchestration lifecycle transitions, and protected host/client interactions must route through authoritative server APIs and application use cases. Desktop, hybrid, web, and worker hosts remain control-plane clients or execution surfaces, not independent control-plane authorities.

## Context and Problem Statement

Current architecture work already converges on authoritative host composition, authoritative API route registration, and authoritative run orchestration seams. Without a durable ADR, future features could reintroduce host-local write authority or split orchestration responsibility across runtimes, creating conflicting lifecycle truth, trust drift, and repeated design debate.

The system needs one decision of record that clarifies authority boundaries for runtime startup, orchestration, trust, and host/client interaction across contributors and AI-assisted implementation.

## Decision Drivers

- Durable control-plane authority boundaries across host runtimes.
- Deterministic orchestration lifecycle ownership and queue/assignment/dispatch truth.
- Centralized trust enforcement for identity/session/authorization/audit paths.
- Stable host/client interaction contract for desktop and thin-client surfaces.
- Reduced architectural drift and lower decision re-litigation cost.

## Considered Options

1. Single authoritative control plane in server host (accepted): keeps one system of record for control-plane state, orchestration transitions, and protected APIs.
2. Host-local authority by runtime type (rejected): allows desktop/hybrid/web/worker hosts to own local control-plane writes; rejected because it fragments authority, increases reconciliation complexity, and weakens trust/audit consistency.
3. Distributed multi-authority orchestration with peer runtimes (rejected): allows multiple runtimes to co-own dispatch and lifecycle authority; rejected because current architecture does not implement distributed consensus and would introduce speculative complexity and non-deterministic control ownership.

## Chosen Approach

The authoritative server host assembly remains the only control-plane authority and the required mutation boundary for control-plane behavior. Host runtime catalog roles, authoritative route-family coverage, and run orchestration use cases enforce this posture in code.

Auth-minimal pre-login startup remains a narrowed startup mode of the same authoritative server host assembly, not a separate authority model. Desktop/hybrid/web/worker hosts may compose local runtime capabilities, but they must consume authoritative contracts for protected control-plane operations and orchestration truth.

## Consequences

- Runtime: startup and composition boundaries stay explicit; only the authoritative server host may claim control-plane authority.
- Orchestration: queueing, assignment, dispatch, progress ingestion, cancellation/retry, and terminal finalization stay authoritative-use-case owned.
- Trust: authentication, session, authorization, and audit-sensitive control-plane mutations stay centralized at authoritative boundaries.
- Host/client interaction: preload/IPC and other host-local adapters remain transport bridges or runtime helpers, not authoritative mutation channels.
- Tradeoff: reliability and availability of the authoritative control-plane runtime become critical; degraded/fallback host behavior must not violate authority boundaries.

## Related Documentation

- `docs/architecture/authoritative-server-host-assembly.md`
- `docs/architecture/unified-api-authoritative-surface.md`
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.md`
- `docs/architecture/host-runtime-composition-boundaries.md`
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/context/context-map.md`

## Related Code Paths

- `src/hosts/HostRuntimeCatalog.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`
- `src/infrastructure/transport/http-server/AuthoritativeApiRouteRegistrationCatalog.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`
- `src/application/runs/use-cases/IngestRunExecutionUpdateUseCase.ts`
- `src/ui/shared/api/SharedApiClient.ts`
- `electron/main/main.ts`
- `electron/preload.ts`

## Follow-Up Actions

- Use this ADR as a review gate for any proposal that introduces host-local control-plane writes or alternate orchestration authority paths.
- Keep architecture references that define control-plane boundaries linked back to this ADR under `## Related ADRs`.
