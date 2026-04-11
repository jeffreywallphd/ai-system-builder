# Desktop Runtime and Hosts

## Purpose

Define current authoritative runtime-host boundaries for desktop delivery and host-mode composition.

## Active Authority Scope

This document is authoritative for:
- desktop host responsibility boundaries;
- preload bridge boundary and contract posture;
- runtime capability orchestration boundaries and degraded-mode rules.

Historical rollout chronology moved to:
- `docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.md`

## Desktop Host Boundary

Electron host responsibilities remain outer-layer only:
- bootstrap and host lifecycle sequencing;
- window and preload bridge composition;
- local capability exposure through typed contracts.

Renderer responsibilities remain:
- UI composition and interaction logic;
- consumption of typed host bridge APIs;
- no direct Node/Electron privileged access.

## Preload Contract Boundary

- Preload is a contract bridge, not a second application layer.
- New host capability exposure must use typed bridge contracts and explicit domain bridge modules.
- Deferred feature availability must remain explicit through readiness checks and unavailable responses.

## Persistence and Runtime Modes

- Desktop canonical persistence remains durable and host-backed.
- Browser fallback paths remain non-authoritative and development-safe.
- Runtime health/readiness signaling remains explicit and multi-state, not binary.

## Guardrails

- Do not move business policy decisions from inner layers into host/preload code.
- Do not bypass preload contracts with renderer-side host imports.
- Do not treat fallback storage as equivalent to desktop authoritative persistence for protected operations.

## Canonical Cross-References

- Runtime host domain overview:
  `docs/architecture/domains/runtime-host-surfaces/overview.md`
- Runtime host composition contracts:
  `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- Core inner-layer boundary companion:
  `docs/architecture/domain-and-application-core.md`

## Historical Material

Detailed migration and story chronology is preserved in:
- `docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.md`
