# AI Companion: Development and Test Startup Host Migration (Story 12.4.2) Baseline

## Baseline Introduction

Snapshot date: 2026-04-11
Snapshot scope: Story 12.4.2 startup-model migration history
Why this baseline exists: Preserve migration traceability while keeping active startup docs focused on current contracts.
Current canonical guidance: `docs/architecture/domains/runtime-host-surfaces/overview.md`
Historical handling note: This file is historical evidence and not authoritative for new startup architecture decisions.

## Historical Snapshot

- Host-first local startup aliases were added (`dev:host:*`) and mapped to canonical host entrypoints.
- Combined local control-plane + worker mode used concurrent host-assembly startup.
- Desktop startup split into prepare/start with Node symlink-preservation flags for Windows reliability.
- Native module repair and compatibility checks were hardened for `better-sqlite3` and `sharp` runtime behavior.
- Server test harness startup moved to host assembly entrypoints, and startup script guardrail tests were introduced.

## Canonical Current Guidance

- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- `docs/architecture/host-bootstrap-pipeline.ai.md`
