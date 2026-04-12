# AI Companion: Offline Local-Mode Authority Boundaries

## Core fact

Offline local mode is bounded local autonomy; authoritative global truth remains server-owned.

## Active authority scope

Use this doc for current boundary rules only:
- authority and storage posture;
- allowed offline capability classes;
- reconnect decision and prohibited-shortcut constraints.

Historical chronology moved to:
- `docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.ai.md`

## Required invariants

- Offline state remains explicitly local until reconnect outcomes apply.
- Reconnect outcomes must remain explicit and auditable.
- Server-authoritative-only resources stay uncached and non-local.
- Reconciliation control flow must not depend on best-effort event publication.

## Canonical seams

- `src/domain/platform/OfflineLocalModeBoundaries.ts`
- `src/application/common/OfflineLocalModeResynchronization.ts`
- `src/application/common/OfflineControlledResynchronizationCoordinator.ts`
- `src/hosts/desktop/DesktopOfflineLocalModeProfile.ts`
- `src/hosts/desktop/DesktopConnectivityStateService.ts`
- `src/shared/contracts/runtime/OfflineSynchronizationContracts.ts`

## Prohibited shortcuts

- silent-global-divergence
- local-cache-as-global-authority
- unsignaled-authoritative-overwrite
- pre-marking queued operations as globally applied
- silent merge of local execution history into authoritative history

## Canonical links

- `docs/architecture/domains/identity-trust-and-security/overview.md`
- `docs/offline-local-mode-contributor-guide.ai.md`

## Historical material

Full rollout chronology is preserved in:
- `docs/baselines/architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.ai.md`
