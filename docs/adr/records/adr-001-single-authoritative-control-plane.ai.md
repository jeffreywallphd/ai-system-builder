---
title: ADR-001 Single Authoritative Control Plane
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 001
decision_status: accepted
decision_date: 2026-04-11
review_tier: heightened
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

Current architecture already converges on authoritative host composition, authoritative API route registration, and authoritative run orchestration seams. Without a durable ADR, future implementation can drift back toward host-local control authority or split orchestration ownership, creating conflicting lifecycle truth and trust ambiguity.

A single decision of record is required so human and AI contributors keep runtime authority, orchestration boundaries, and host/client interaction contracts aligned.

## Decision Drivers

- Keep control-plane authority explicit and durable across runtime hosts.
- Keep orchestration lifecycle and queue/assignment/dispatch truth deterministic.
- Preserve centralized trust boundaries for auth/session/authorization/audit behavior.
- Keep host/client interaction contracts stable for desktop and thin-client surfaces.
- Reduce repeated design debate over previously settled control-plane direction.

## Considered Options

1. Single authoritative control plane in server host (accepted): keeps one source of truth for control-plane state and protected orchestration behavior.
2. Host-local authority by runtime type (rejected): gives desktop/hybrid/web/worker local control-plane writes; rejected because it fragments authority and complicates reconciliation and audit lineage.
3. Distributed multi-authority orchestration with peer runtimes (rejected): spreads control ownership across runtimes; rejected because the current architecture does not implement distributed consensus and this would be speculative complexity.

## Chosen Approach

The authoritative server host assembly remains the only control-plane authority and mutation boundary. Host runtime catalog roles, authoritative route-family coverage, and authoritative orchestration use cases enforce this decision in current implementation seams.

Auth-minimal pre-login startup remains a narrowed startup mode of the same authoritative host assembly, not a second authority model. Desktop/hybrid/web/worker hosts may run local capabilities but consume authoritative contracts for protected control-plane operations and orchestration truth.

## Consequences

- Runtime: control-plane authority stays server-host only; other hosts remain non-authoritative for control-plane state mutation.
- Orchestration: lifecycle mutation, queue claims, assignment, dispatch, and update/finalization remain authoritative-use-case owned.
- Trust: identity/session/authorization/audit-sensitive control operations stay centralized at authoritative boundaries.
- Host/client interaction: preload/IPC and local adapters remain bridges and helpers, not alternate authoritative mutation channels.
- Tradeoff: authoritative runtime reliability is critical; degraded paths must preserve non-authoritative posture.

## Review Expectations

- Risk Class: runtime control authority (control-plane ownership and orchestration mutation boundaries).
- Required Reviewers:
  - Platform architecture owner.
  - Runtime/orchestration domain owner.
- Broader Architecture Review Trigger: required before acceptance or supersession if the change introduces non-authoritative mutation channels, host-role inversion, or new protected control-plane write paths.
- Recertification Cadence: re-review this ADR every 6 months or before any host-runtime authority model change is accepted.

## Related Documentation

- `docs/architecture/authoritative-server-host-assembly.ai.md`
- `docs/architecture/unified-api-authoritative-surface.ai.md`
- `docs/architecture/run-orchestration-queue-assignment-dispatch-control-plane.ai.md`
- `docs/architecture/host-runtime-composition-boundaries.ai.md`
- `docs/context/packs/runtime-and-host.pack.ai.md`
- `docs/context/context-map.ai.md`

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

- Use this ADR as a review gate for proposals that add host-local control-plane writes or alternate authority channels.
- Keep related architecture docs linked back to this ADR under `## Related ADRs`.
