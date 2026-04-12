# AI Companion: Entrypoint Host Composition Migration (Story 12.4.1) Baseline

## Baseline Introduction

Snapshot date: 2026-04-11
Snapshot scope: Story 12.4.1 host-entrypoint migration history
Why this baseline exists: Preserve migration traceability outside active architecture guidance paths.
Current canonical guidance: `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
Historical handling note: This baseline is historical evidence and not authoritative for new implementation choices.

## Historical Snapshot

- `electron/main/main.ts` and browser-development Vite startup moved from direct `startIdentityServerHost(...)` to `startAuthoritativeServerHostAssembly(...)`.
- Desktop and browser-development retained local identity/control-plane behavior and existing CORS/bind/port posture.
- Runtime shutdown transitioned to host runtime handles (`runtime.stop()`), replacing direct host handle shutdown paths.
- Startup semantics became centralized through explicit host composition roots.

## Canonical Current Guidance

- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- `docs/architecture/authoritative-server-host-assembly.ai.md`
