# AI Companion: Offline Local-Mode Authority Boundaries

## Purpose

Story 19.1.1 defines the canonical offline/local-mode authority model so desktop clients can work during disconnect without creating competing global truth.

## Canonical files

- `src/domain/platform/OfflineLocalModeBoundaries.ts`
- `src/application/common/OfflineLocalModeResynchronization.ts`
- `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- `docs/architecture/offline-local-mode-authority-boundaries.md`

## Core stance

- Authoritative control-plane state remains server-owned.
- Desktop is a control-plane client and never an authoritative control-plane host.
- Offline state is split into explicit buckets:
  - offline cache
  - local draft state
  - mutation queue
  - local ephemeral state
  - server-authoritative-only

## Offline resource classes and capabilities

- `workspace-catalog`: cache/view only; server authoritative.
- `workflow-definition`: cache/view only; server authoritative.
- `workflow-draft`: local-draft authority; cache/view/edit + queue for explicit promotion.
- `run-submission-intent`: queue-capable authoritative intent; requires reconnect reconciliation.
- `local-runtime-session`: execute-capable local ephemeral state; never authoritative.
- `secret-plaintext-material`: non-cacheable and non-offline.

## Mutation and resync invariants

- Offline authoritative intents must be queued as explicit mutation envelopes.
- Queue envelopes require:
  - baseline authoritative revision
  - visible sync status (`queued-pending-sync` / `sync-conflict` / `sync-rejected`)
  - divergence disclosure token
- Queue envelopes cannot pre-mark themselves as globally applied.

## Reconnect outcomes

`planOfflineResynchronization(...)` yields:
- `apply-to-authoritative`
- `conflict-requires-review`
- `reject-not-allowed`

`assertResynchronizationPlanPreventsSilentGlobalDivergence(...)` enforces user-attention requirements for conflict/rejection paths.

## Prohibited patterns

- `silent-global-divergence`
- `local-cache-as-global-authority`
- `unsignaled-authoritative-overwrite`
