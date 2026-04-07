# Offline Local-Mode Authority Boundaries

This document defines the canonical offline/local-mode model for desktop clients in Feature 19 / Epic 19.1.

The objective is limited local autonomy with explicit authority boundaries:
- desktop clients can continue selected local work during disconnect,
- authoritative global truth remains server-owned,
- reconnect/resynchronization is explicit and conflict-aware,
- silent competing truth is prohibited.

## Canonical implementation seams

- Domain boundary catalog and policy evaluator:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
- Application resynchronization policy:
  - `src/application/common/OfflineLocalModeResynchronization.ts`
- Application classification seam:
  - `src/application/common/OfflineResourceClassificationPolicy.ts`
- Desktop host profile binding:
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- Shared offline-state and synchronization contracts:
  - `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
  - `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
  - `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`
  - usage notes: `docs/architecture/offline-sync-shared-contracts.md`

## Shared offline/sync contract package (Story 19.1.2)

Canonical shared contracts define stable cross-layer DTO/state shapes for:
- cached resource metadata
- offline draft state and local change records
- pending operation envelopes and queue state
- synchronization status summaries
- conflict indicators and reconciliation outcomes
- connectivity-aware surface state
- workspace snapshot payloads for offline/resync views

This keeps offline/sync payload semantics consistent across desktop host logic, API DTO/schema validation, and UI surfaces without ad hoc local object shapes.

## Resource classification model (Story 19.1.3)

Offline behavior is now classified through explicit policy metadata and evaluators instead of implicit per-surface assumptions.

Policy input dimensions:
- workspace visibility: `private` / `team` / `public`
- workspace access role: `owner` / `admin` / `member` / `viewer`
- workspace sharing posture: `workspace-only` / `tenant-wide` / `external-shared` / `public-link`
- sensitivity marking: `standard` / `sensitive` / `restricted` / `secret`
- storage rule: `allow-offline-cache` / `require-encrypted-offline-cache` / `disallow-offline-cache`
- device trust posture: `trusted` / `pending-verification` / `untrusted` / `revoked`

Policy output:
- deterministic operation posture for `cache`, `read`, `edit`, `queueMutation`, `execute`
- explicit `allowed` + `reason` decision per operation
- explicit `exclusionReasons` list for denied paths
- explicit unsupported classification for unknown resource classes

## Authority model

- Authoritative control-plane truth remains server-owned.
- Desktop host remains `control-plane-client` only and cannot claim control-plane authority while offline.
- Local offline state is split into distinct storage/authority buckets:
  - offline cache (`offline-cache`): read-optimized snapshots of server-owned resources
  - local draft state (`local-draft-state`): explicitly local authoring state not yet globally authoritative
  - mutation queue (`mutation-queue`): explicit pending operations requiring authoritative reconciliation
  - local ephemeral state (`local-ephemeral-state`): local runtime/session state that never becomes global truth
  - server-authoritative-only (`server-authoritative-only`): non-cacheable sensitive data

## Production resource-policy matrix

| Resource class | Behavior class | Authority scope | Cache | View | Edit | Queue | Execute | Default bucket |
|---|---|---|---|---|---|---|---|---|
| `workspace-catalog` | `cached-read-only` | `authoritative-server` | yes | yes | no | no | no | `offline-cache` |
| `workflow-definition` | `cached-read-only` | `authoritative-server` | yes | yes | no | no | no | `offline-cache` |
| `workflow-draft` | `local-draft` | `local-draft` | yes | yes | yes | yes | no | `local-draft-state` |
| `run-submission-intent` | `queued-authoritative-intent` | `authoritative-server` | yes | yes | yes | yes | no | `mutation-queue` |
| `local-runtime-session` | `local-ephemeral-execution` | `local-ephemeral` | yes | yes | yes | no | yes | `local-ephemeral-state` |
| `secret-plaintext-material` | `server-only` | `authoritative-server` | no | no | no | no | no | `server-authoritative-only` |

Unknown/unsupported resource classes are explicitly excluded:
- `supportedResourceClass = false`
- all operation posture values denied
- exclusion reason indicates absence from the registered offline eligibility catalog

## Policy-driven behavior examples

- `workflow-draft` with trusted device and workspace-only sharing can remain editable and queue-capable offline.
- `run-submission-intent` with `external-shared` or `public-link` posture is forced read-only (no edit/queue mutation).
- `workflow-definition` with `sensitive` marking but non-encrypted cache policy is denied cache/read offline.
- `restricted` resources deny offline posture when sharing is broader than workspace-only.
- `untrusted` or `revoked` devices deny all offline operations across resource classes.
- `secret` sensitivity marking always resolves to server-only posture.

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

- New offline-capable resource types must be added to `OfflineLocalModeBoundaries` with:
  - capability matrix,
  - authority scope,
  - storage bucket,
  - behavior class and eligibility metadata.
- New resource classes must be covered in policy-matrix tests and evaluator test cases.
- If a resource can queue offline mutations, it must use queued mutation envelopes with visible status and divergence token.
- Desktop/offline host changes must preserve `control-plane-client` posture in `DesktopOfflineLocalModeProfile`.
- Do not add optimistic "auto-merged global success" paths that bypass explicit conflict/review signaling.
