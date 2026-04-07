# Offline Local-Mode Authority Boundaries

This document defines the canonical offline/local-mode model for desktop clients in Feature 19 / Epic 19.1.

The objective is limited local autonomy with explicit authority boundaries:
- desktop clients can continue selected local work during disconnect,
- authoritative global truth remains server-owned,
- reconnect/resynchronization is explicit and conflict-aware,
- silent competing truth is prohibited.

## Canonical implementation seams

- Domain boundary catalog:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
- Application resynchronization policy:
  - `src/application/common/OfflineLocalModeResynchronization.ts`
- Desktop host profile binding:
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`

## Authority model

- Authoritative control-plane truth remains server-owned.
- Desktop host remains `control-plane-client` only and cannot claim control-plane authority while offline.
- Local offline state is split into distinct storage/authority buckets:
  - offline cache (`offline-cache`): read-optimized snapshots of server-owned resources
  - local draft state (`local-draft-state`): explicitly local authoring state not yet globally authoritative
  - mutation queue (`mutation-queue`): explicit pending operations requiring authoritative reconciliation
  - local ephemeral state (`local-ephemeral-state`): local runtime/session state that never becomes global truth
  - server-authoritative-only (`server-authoritative-only`): non-cacheable sensitive data

## Offline-capable resource classes

| Resource class | Authority scope | Cache | View | Edit | Queue | Execute | Default bucket |
|---|---|---|---|---|---|---|---|
| `workspace-catalog` | `authoritative-server` | yes | yes | no | no | no | `offline-cache` |
| `workflow-definition` | `authoritative-server` | yes | yes | no | no | no | `offline-cache` |
| `workflow-draft` | `local-draft` | yes | yes | yes | yes | no | `local-draft-state` |
| `run-submission-intent` | `authoritative-server` | yes | yes | yes | yes | no | `mutation-queue` |
| `local-runtime-session` | `local-ephemeral` | yes | yes | yes | no | yes | `local-ephemeral-state` |
| `secret-plaintext-material` | `authoritative-server` | no | no | no | no | no | `server-authoritative-only` |

## Draft vs synchronized mutations

- Local draft edits are allowed only for `workflow-draft` local state.
- Any operation intended to affect authoritative state must become a queued mutation envelope with:
  - baseline authoritative revision (`baseAuthoritativeRevision`)
  - explicit user-visible sync status (`queued-pending-sync`, `sync-conflict`, or `sync-rejected`)
  - explicit divergence disclosure token (`divergenceDisclosureToken`)
- Queued offline mutations are prohibited from self-marking as globally applied before authoritative acceptance.

## Reconnection and controlled resynchronization

On reconnect:
1. authoritative revision snapshots are fetched for queued mutation targets;
2. each queued mutation is classified as one of:
   - `apply-to-authoritative`
   - `conflict-requires-review`
   - `reject-not-allowed`
3. conflict/rejection outcomes must require user attention and remain visible until resolved.

This behavior is enforced by `planOfflineResynchronization(...)` and `assertResynchronizationPlanPreventsSilentGlobalDivergence(...)`.

## Prohibited patterns

- `silent-global-divergence`: local state appears globally authoritative without explicit sync outcome.
- `local-cache-as-global-authority`: cached snapshots treated as write authority.
- `unsignaled-authoritative-overwrite`: reconnect path overwrites server state without explicit divergence disclosure/review.

## Contributor extension rules

- New offline-capable resource types must be added to `OfflineLocalModeBoundaries` with explicit capability matrix, authority scope, storage bucket, and reconnection policy.
- If a resource can queue offline mutations, it must use queued mutation envelopes with visible status and divergence token.
- Desktop/offline host changes must preserve `control-plane-client` posture in `DesktopOfflineLocalModeProfile`.
- Do not add optimistic "auto-merged global success" paths that bypass explicit conflict/review signaling.
