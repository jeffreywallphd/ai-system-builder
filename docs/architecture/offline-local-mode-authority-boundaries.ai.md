# AI Companion: Offline Local-Mode Authority Boundaries

## Purpose

Feature 19 / Epic 19.1 defines limited local autonomy for desktop clients.  
Story 19.1.3 adds explicit resource classification and policy-driven posture evaluation so offline behavior is never accidental.

## Canonical files

- `src/domain/platform/OfflineLocalModeBoundaries.ts`
- `src/application/common/OfflineResourceClassificationPolicy.ts`
- `src/application/common/OfflineLocalModeResynchronization.ts`
- `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- `docs/architecture/offline-local-mode-authority-boundaries.md`

## Story 19.1.3 additions

- Added explicit eligibility metadata per resource class (`OfflineResourceEligibilityMetadata`):
  - behavior class
  - max sensitivity
  - trusted-device requirements
  - visibility/sharing constraints
- Added domain policy evaluator:
  - `evaluateOfflineResourcePolicy(resourceClass, policyInput)`
- Added application classification seam:
  - `classifyOfflineResourceLocalModePolicy(...)`
  - `classifyOfflineResourcePolicyMatrix(...)`
- Added resource-policy matrix projection:
  - `listOfflineResourceEligibilityPolicies()`

## Story 19.1.4 additions

- Added explicit local draft lifecycle model:
  - `createOfflineLocalDraftDocument(...)`
  - `appendOfflineLocalDraftChange(...)`
  - `transitionOfflineLocalDraftSynchronizationStatus(...)`
- Added structured queued-operation replay descriptor requirements:
  - rooted API path
  - replay HTTP method
  - idempotency key
  - durable replay payload
- Added explicit pending run-submission record model:
  - `createOfflinePendingRunSubmissionRecord(...)`
  - bound to queued `run-submission-intent` authoritative operations

## Story 19.1.4 model posture

- Local drafts carry both `baseAuthoritativeRevision` and `authoritativeSnapshotRevision` to preserve the authoritative baseline.
- Local edits always reassert `local-only` draft sync status and remove queued linkage.
- Sync status progression is explicit and validated (`local-only`, `queued-pending-sync`, `sync-conflict`, `sync-rejected`, `sync-applied`).
- Pending operations remain explicit queue artifacts and cannot silently mutate authoritative snapshots in place.

## Story 19.1.5 additions

- Added explicit reconciliation conflict classes:
  - `stale-base-edit`
  - `deleted-or-revoked-resource`
  - `permission-changed-during-disconnection`
  - `invalidated-run-submission`
  - `resource-version-mismatch`
  - `authoritative-state-unavailable`
- Added explicit decision rules to make reconciliation behavior testable and bounded:
  - auto-apply only when authoritative baseline matches
  - user/admin intervention required for reject/conflict paths
  - local draft preservation (`preserveLocalDraftAsUnsynced`) for draft-scope conflict/reject outcomes
- Added authoritative reconnect snapshot policy flags for classification:
  - resource existence/revocation
  - replay permission posture (+ admin intervention requirement)
  - run submission validity
  - revision comparability/version-line compatibility
- Added explicit deferred unsafe auto-merge posture:
  - non-comparable versions and unavailable authoritative snapshots are conflicted, not auto-resolved

## Classification inputs

- workspace visibility
- workspace access role
- workspace sharing posture
- sensitivity marking
- storage rule
- device trust posture

## Classification outputs

- explicit per-operation posture (`cache`, `read`, `edit`, `queueMutation`, `execute`)
- deterministic allow/deny reason for each operation
- `exclusionReasons` summary list
- explicit unsupported-resource handling (`supportedResourceClass = false`)

## Production behavior classes

- `cached-read-only`
- `local-draft`
- `queued-authoritative-intent`
- `local-ephemeral-execution`
- `server-only`

## Prohibited outcomes preserved

- no silent global divergence
- no local cache as authoritative source of truth
- no unsignaled authoritative overwrite

## Test coverage

- `src/domain/platform/tests/OfflineLocalModeBoundaries.test.ts`
  - matrix coverage
  - unsupported resource exclusion
  - policy-input gating (trust/sharing/sensitivity/storage)
- `src/application/common/tests/OfflineResourceClassificationPolicy.test.ts`
  - application seam behavior
  - full matrix evaluation coverage
