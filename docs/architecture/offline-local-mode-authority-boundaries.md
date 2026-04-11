# Offline Local-Mode Authority Boundaries

## Purpose

Define canonical authority, storage, and reconciliation boundaries for desktop offline local mode.

## Active Authority Scope

This document is authoritative for:
- server-authoritative ownership boundaries;
- allowed offline resource classes and capability posture;
- reconnect reconciliation decision boundaries and prohibited shortcuts.

Historical rollout chronology moved to:
- `docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.md`

## Non-Negotiable Authority Rules

- Offline support preserves continuity; it does not create a second control plane.
- Server state remains authoritative global truth.
- Offline local state remains explicitly local until reconnect outcomes are applied.
- Reconnect outcomes must be explicit (`apply`, `conflict`, `reject`) and visible.

## Canonical Boundary Surfaces

- Domain policy catalog:
  `src/domain/platform/OfflineLocalModeBoundaries.ts`
- Reconciliation planning and safety assertions:
  `src/application/common/OfflineLocalModeResynchronization.ts`
- Controlled resynchronization coordinator:
  `src/application/common/OfflineControlledResynchronizationCoordinator.ts`
- Desktop host profile and connectivity state:
  `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
  `src/hosts/desktop/DesktopConnectivityStateService.ts`
- Shared sync contracts:
  `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`

## Required Operational Guardrails

- Local drafts and pending operations remain explicitly tracked and replayable.
- Conflict and rejection outcomes remain queryable; no silent discard or silent merge.
- Secret plaintext and server-authoritative-only material remain uncached locally.
- Event publication is best-effort and cannot alter reconciliation decisions.

## Prohibited Shortcuts

- silent-global-divergence
- local-cache-as-global-authority
- unsignaled-authoritative-overwrite
- pre-marking queued operations as globally applied
- silent merge of local execution history into authoritative history

## Canonical Cross-References

- Identity trust and security domain overview:
  `docs/architecture/domains/identity-trust-and-security/overview.md`
- Offline contributor workflow:
  `docs/offline-local-mode-contributor-guide.md`

## Historical Material

Detailed rollout sequence and story chronology are preserved in:
- `docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.md`
