# AI Companion: Offline Local-Mode Contributor Guide

## Human doc

- `docs/offline-local-mode-contributor-guide.md`
- `docs/architecture/offline-local-mode-authority-boundaries.md`
- `docs/architecture/offline-sync-shared-contracts.md`

## Purpose

Keep offline-aware feature work aligned to one bounded local-autonomy model and prevent silent competing authority.

## Required implementation order

1. Shared offline contracts/schemas.
2. Domain offline boundary catalog and policy model.
3. Application classification/resynchronization/cache seams.
4. Desktop host profile + offline cache runtime gating.
5. Infrastructure adapter and persistence updates.
6. Adapter/UI consumption updates.

## Invariants to preserve

- offline local state is not authoritative global truth;
- reconnect conflict/rejection outcomes are visible and explicit;
- queued operations keep divergence disclosure and replay descriptors;
- desktop host remains control-plane-client and non-authoritative.
- authoritative snapshot cache stores logical payload + sync metadata, not filesystem references.
- snapshot cache writes respect eligibility and protected-storage requirements.

## Prohibited patterns

- local cache as global write authority;
- pre-marking queued mutations as globally applied;
- silent auto-merge of conflict/rejection outcomes;
- bypassing domain/application offline seams from UI or transport layers.

## Test and doc checklist

- update relevant offline tests across domain/application/host/shared contract modules;
- keep `.md` and `.ai.md` offline docs paired and updated together.
