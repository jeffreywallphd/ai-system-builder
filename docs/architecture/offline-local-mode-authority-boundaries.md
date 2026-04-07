# Offline Local-Mode Authority Boundaries

Feature 19 / Epic 19.1 establishes production-grade limited local autonomy for desktop clients.

## Offline/local-mode philosophy

Offline support exists to preserve user continuity, not to create a second control plane.

Non-negotiable philosophy:
- desktop clients may continue bounded local work while disconnected;
- server state remains authoritative global truth;
- offline work must remain explicit local state until reconnect decisions are made;
- reconnect behavior must be visible and conflict-aware;
- client code must not treat offline local state as silently authoritative global truth.

## Canonical implementation seams

- domain policy and offline boundary catalog:
  - `src/domain/platform/OfflineLocalModeBoundaries.ts`
- application resynchronization policy and decision model:
  - `src/application/common/OfflineLocalModeResynchronization.ts`
- application classification seam:
  - `src/application/common/OfflineResourceClassificationPolicy.ts`
- application authoritative snapshot cache service and contracts:
  - `src/application/common/OfflineAuthoritativeSnapshotCache.ts`
- desktop host local-mode profile binding:
  - `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- desktop host cache runtime factory:
  - `src/hosts/desktop/DesktopOfflineSnapshotCacheHost.ts`
- desktop offline snapshot cache persistence adapter:
  - `src/infrastructure/desktop/DesktopOfflineSnapshotCacheRepository.ts`
- shared contract package for runtime DTO/schema/state:
  - `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`
  - `src/shared/dto/runtime/OfflineSynchronizationDtos.ts`
  - `src/shared/schemas/runtime/OfflineSynchronizationSchemaContracts.ts`

## Authority model and storage buckets

Local state is split into explicit buckets so authority is always visible:
- `offline-cache`: read-optimized snapshots of authoritative resources;
- `local-draft-state`: explicit local authoring state;
- `mutation-queue`: pending authoritative mutation intents;
- `local-ephemeral-state`: local runtime/session activity that is never authoritative;
- `server-authoritative-only`: non-cacheable server-only material.

Authoritative snapshot cache records must include:
- workspace context (`workspaceId`) and logical resource identity (`resourceClass`, `resourceId`);
- authoritative version metadata (`authoritativeRevision`, `authoritativeSnapshotRevision`);
- sync timing metadata (`cachedAt`, `lastSynchronizedAt`, optional `expiresAt`);
- eligibility markers (`workspace visibility/role/sharing`, `sensitivity`, `storageRule`, `deviceTrustPosture`);
- authority and storage posture markers (`authorityScope`, `storageBucket`, `behaviorClass`, cache protection posture);
- logical snapshot payload + digest only (no raw file-system references).

Authority scopes remain explicit:
- `authoritative-server`
- `local-draft`
- `local-ephemeral`

## Allowed offline capabilities (resource eligibility baseline)

| Resource class | Behavior class | Authority scope | Cache | View | Edit | Queue | Execute | Default bucket |
|---|---|---|---|---|---|---|---|---|
| `workspace-catalog` | `cached-read-only` | `authoritative-server` | yes | yes | no | no | no | `offline-cache` |
| `workflow-definition` | `cached-read-only` | `authoritative-server` | yes | yes | no | no | no | `offline-cache` |
| `workflow-draft` | `local-draft` | `local-draft` | yes | yes | yes | yes | no | `local-draft-state` |
| `run-submission-intent` | `queued-authoritative-intent` | `authoritative-server` | yes | yes | yes | yes | no | `mutation-queue` |
| `local-runtime-session` | `local-ephemeral-execution` | `local-ephemeral` | yes | yes | yes | no | yes | `local-ephemeral-state` |
| `secret-plaintext-material` | `server-only` | `authoritative-server` | no | no | no | no | no | `server-authoritative-only` |

Unknown resource classes are denied by default (`supportedResourceClass=false`) and must be explicitly registered before they are offline-capable.

## Classification policy inputs and gates

Offline eligibility is deterministic from policy inputs:
- workspace visibility (`private`/`team`/`public`)
- workspace access role (`owner`/`admin`/`member`/`viewer`)
- sharing posture (`workspace-only`/`tenant-wide`/`external-shared`/`public-link`)
- sensitivity (`standard`/`sensitive`/`restricted`/`secret`)
- storage rule (`allow-offline-cache`/`require-encrypted-offline-cache`/`disallow-offline-cache`)
- device trust posture (`trusted`/`pending-verification`/`untrusted`/`revoked`)

Policy output is operation-level posture for `cache`, `read`, `edit`, `queueMutation`, and `execute`, with explicit allow/deny reason and exclusion reasons.

## Local draft semantics and pending-operation handling

Disconnected edits are represented as explicit local draft and queue artifacts, not in-place authoritative mutation.

Local draft seams:
- `createOfflineLocalDraftDocument(...)`
- `appendOfflineLocalDraftChange(...)`
- `transitionOfflineLocalDraftSynchronizationStatus(...)`

Queued-operation seams:
- `createOfflineQueuedMutationEnvelope(...)`
- `createOfflinePendingRunSubmissionRecord(...)`

Required semantics:
- drafts carry `baseAuthoritativeRevision` and `authoritativeSnapshotRevision`;
- draft sync progression remains explicit (`local-only` -> `queued-pending-sync` -> `sync-conflict`/`sync-rejected`/`sync-applied`);
- queued operations include replay descriptor (`method`, rooted `path`, `idempotencyKey`, `payload`);
- queued operations require `divergenceDisclosureToken`;
- queued operations cannot be pre-marked `sync-applied`;
- local edits reset sync state to `local-only` and clear queued linkage.

## Sync and reconciliation boundaries

Reconnect decisions are explicit and bounded:
1. load authoritative revision snapshots for queued targets;
2. classify each queued mutation as:
   - `apply-to-authoritative`
   - `conflict-requires-review`
   - `reject-not-allowed`
3. require visible intervention for conflict/rejection outcomes.

Enforced by:
- `planOfflineResynchronization(...)`
- `assertResynchronizationPlanPreventsSilentGlobalDivergence(...)`

## Conflict categories and decision rules

Canonical conflict classes:
- `stale-base-edit`
- `deleted-or-revoked-resource`
- `permission-changed-during-disconnection`
- `invalidated-run-submission`
- `resource-version-mismatch`
- `authoritative-state-unavailable`

Canonical decision-rule baseline:
- `auto-apply-when-authoritative-baseline-matches`
- `preserve-unsynced-draft-and-require-user-review`
- `preserve-unsynced-draft-and-require-admin-review`
- `preserve-unsynced-draft-and-reject-replay`
- `reject-replay-and-require-user-review`
- `reject-replay-and-require-admin-review`
- `unsafe-auto-merge-deferred`

Auto-merge is intentionally narrow and only allowed when authoritative baseline matches.

## Offline local execution boundary

First production local execution is explicit and limited.

Supported execution classes:
- `local-workflow-preview`
- `local-workflow-validation`

Out-of-scope execution classes:
- `remote-orchestrated-run-replay`
- `distributed-cluster-run`
- `secret-materialized-execution`

Execution seams:
- `evaluateOfflineLocalExecutionEligibility(...)`
- `createOfflineLocalExecutionRecord(...)`
- `createOfflineLocalExecutionRegistrationEnvelope(...)`
- desktop profile enforcement via:
  - `DesktopOfflineSupportedExecutionClasses`
  - `evaluateDesktopOfflineLocalExecutionEligibility(...)`

Offline local execution history must remain `explicit-local-activity` until authoritative registration outcome is applied.

## Server-authoritative-only examples

The following must remain server-authoritative and cannot be finalized offline:
- authoritative acceptance/rejection of queued run-submission intents;
- permission and policy replay authorization on reconnect;
- authoritative lifecycle mutation for shared/global resources;
- secret plaintext retrieval and decryption materialization;
- authoritative orchestration history and run-state truth;
- final conflict/rejection disposition for reconnect replay.

## Prohibited shortcuts

- `silent-global-divergence`: local state appears globally authoritative without explicit sync outcome.
- `local-cache-as-global-authority`: cached snapshots treated as write authority.
- `unsignaled-authoritative-overwrite`: reconnect path overwrites authoritative state without explicit divergence disclosure.
- marking queued operations as globally applied before authoritative acceptance.
- blending offline local execution history into authoritative orchestration history without registration outcome.

## Extension rules for contributors

- register new offline resource classes in `OfflineLocalModeBoundaries` with authority scope, capability matrix, storage bucket, behavior class, and eligibility metadata;
- update classification/reconciliation behavior in application seams, not UI or transport handlers;
- keep desktop host in control-plane-client posture (`DesktopOfflineLocalModeProfile`);
- add contract-level updates to shared offline DTO/schema packages before adapter/UI updates;
- ensure new queued mutation paths use replay descriptors and divergence tokens;
- preserve explicit conflict categories and decision rules; do not add silent auto-resolution paths.

For implementation workflow and checklist details, use `docs/offline-local-mode-contributor-guide.md`.
