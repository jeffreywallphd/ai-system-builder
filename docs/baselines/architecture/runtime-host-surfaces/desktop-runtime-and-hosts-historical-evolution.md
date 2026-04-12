# Desktop Runtime and Hosts Historical Evolution

## Purpose

Preserve host/runtime rollout chronology that was removed from active architecture guidance to keep `docs/architecture/desktop-runtime-and-hosts.md` focused on current authority.

## Superseded Chronology Scope

This baseline preserves historical sequencing for desktop host, preload bridge, runtime orchestration, and image-runtime installation slices that previously accumulated in the active document.

The active authoritative document is:
- `docs/architecture/desktop-runtime-and-hosts.md`

## Chronology Summary

### Host and preload stabilization period
- Established desktop host composition-root posture and explicit preload bridge module boundaries.
- Reduced renderer coupling by routing capabilities through typed bridge contracts.

### Runtime orchestration and diagnostics expansion
- Introduced shared runtime dependency graph orchestration and richer readiness state model.
- Separated provisioning success from launchability success with explicit diagnostics and remediation signals.

### Studio/runtime window and installer evolution
- Added runtime launch contract, hydration, restore lifecycle, and diagnostics projection seams.
- Added repository installer contracts, Git installer implementation, and Comfy runtime orchestration phases.

### Desktop startup visibility hardening
- Added phased startup timing and memory checkpoints for pre-login vs post-login diagnostics.
- Added initialization-progress contract and timeout-aware startup handling in renderer bootstrap.

## Historical-Only Usage Guidance

Use this baseline for traceability and rollout sequence analysis.
Do not use this baseline as normative current implementation guidance.

## Canonical Current Guidance

- `docs/architecture/desktop-runtime-and-hosts.md`
- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
