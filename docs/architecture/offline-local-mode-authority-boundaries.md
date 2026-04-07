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

## Local draft and pending-operation model (Story 19.1.4)

Disconnected work is now represented as explicit local state with lifecycle transitions, instead of implicit in-place edits over authoritative snapshots.

Canonical domain seams:
- `createOfflineLocalDraftDocument(...)`
- `appendOfflineLocalDraftChange(...)`
- `transitionOfflineLocalDraftSynchronizationStatus(...)`
- `createOfflineQueuedMutationEnvelope(...)`
- `createOfflinePendingRunSubmissionRecord(...)`

Model guarantees:
- local drafts include `authoritativeSnapshotRevision` and `baseAuthoritativeRevision` so the offline edit baseline is explicit;
- draft sync progression is explicit (`local-only` -> `queued-pending-sync` -> `sync-conflict`/`sync-rejected`/`sync-applied`);
- queued operations include a structured replay descriptor (`method`, rooted API `path`, `idempotencyKey`, payload);
- pending run submissions are first-class local records bound to queued authoritative intents;
- local edits reset draft sync status back to `local-only` and clear queued linkage, preventing silent in-place mutation of authoritative snapshots.

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
  - authoritative snapshot reference preserved on the local draft (`authoritativeSnapshotRevision`)
  - structured replay descriptor (`method`, `path`, `idempotencyKey`, payload)
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

## Conflict classes and reconciliation decision rules (Story 19.1.5)

Supported conflict classes are explicit and intentionally bounded for the first production model:
- `stale-base-edit`
- `deleted-or-revoked-resource`
- `permission-changed-during-disconnection`
- `invalidated-run-submission`
- `resource-version-mismatch`
- `authoritative-state-unavailable`

Representative reconciliation matrix for supported scope:

| Conflict class | Typical trigger | Reconciliation action | Decision rule | Intervention | Local draft preservation |
|---|---|---|---|---|---|
| `stale-base-edit` | authoritative revision differs from queued baseline | `conflict-requires-review` | `preserve-unsynced-draft-and-require-user-review` | user | yes |
| `deleted-or-revoked-resource` | target deleted or access revoked while offline | `reject-not-allowed` | `preserve-unsynced-draft-and-reject-replay` | user | yes (draft scope only) |
| `permission-changed-during-disconnection` | replay no longer authorized after reconnect | `reject-not-allowed` | `reject-replay-and-require-user-review` or `reject-replay-and-require-admin-review` | user or admin | yes (draft scope only) |
| `invalidated-run-submission` | run submission intent invalidated while offline | `reject-not-allowed` | `reject-replay-and-require-user-review` | user | no |
| `resource-version-mismatch` | version line/format cannot be safely compared | `conflict-requires-review` | `unsafe-auto-merge-deferred` | user | yes (draft scope only) |
| `authoritative-state-unavailable` | authoritative snapshot unavailable at reconnect | `conflict-requires-review` | `unsafe-auto-merge-deferred` | user | yes (draft scope only) |

Auto-merge is intentionally narrow:
- only `auto-apply-when-authoritative-baseline-matches` is eligible for automatic apply;
- any conflict/rejection outcome requires visible intervention and cannot be silently applied;
- admin-only intervention is reserved for explicit authorization failures requiring administrative policy action.

Unsafe/impossible auto-merge cases are intentionally deferred:
- mismatched version lines or non-comparable revisions;
- missing authoritative snapshot state;
- any scenario where deterministic merge safety cannot be proven from bounded reconnect metadata.

## Offline local execution posture (Story 19.1.6)

First production offline execution support is intentionally narrow and explicit.

Eligibility is computed with:
- resource classification policy (`evaluateOfflineResourcePolicy`)
- device trust posture
- node operational mode
- workstation mode
- policy flags for local execution + reconnect registration

Canonical evaluator:
- `evaluateOfflineLocalExecutionEligibility(...)`

Desktop host binding:
- `DesktopOfflineSupportedExecutionClasses`
- `evaluateDesktopOfflineLocalExecutionEligibility(...)`

Supported first-production execution classes:
- `local-workflow-preview`
- `local-workflow-validation`

Explicitly out-of-scope execution classes for first production:
- `remote-orchestrated-run-replay`
- `distributed-cluster-run`
- `secret-materialized-execution`

### Local execution metadata and registration path

Offline execution is modeled as explicit local activity, not authoritative orchestration success:
- local record: `createOfflineLocalExecutionRecord(...)`
- reconnect registration envelope: `createOfflineLocalExecutionRegistrationEnvelope(...)`

Captured metadata includes:
- execution identity/class/resource linkage
- actor identity
- start/completion timestamps
- input digest
- output digests/artifact classes
- node operational mode + workstation mode
- explicit history scope (`explicit-local-activity`)

Later sync behavior:
- local execution records are queued as explicit registration envelopes
- envelopes carry divergence disclosure + replay descriptor
- pre-marking registration as applied is rejected
- replay endpoints are scoped to offline local-execution registration paths

This prevents silent blending of local offline execution into authoritative remote orchestration run history.

## Prohibited patterns

- `silent-global-divergence`: local state appears globally authoritative without explicit sync outcome.
- `local-cache-as-global-authority`: cached snapshots treated as write authority.
- `unsignaled-authoritative-overwrite`: reconnect path overwrites server state without explicit divergence disclosure/review.
- silent local-execution history blur: offline local execution cannot claim authoritative run-orchestration success before explicit registration outcome.

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
