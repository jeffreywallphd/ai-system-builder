# AI Companion: Desktop Runtime and Hosts

## Core fact

Desktop host behavior is authoritative through explicit host composition and preload contracts; renderer code remains contract consumer only.

## Active authority scope

Use this doc for current runtime-host rules only:
- desktop host responsibility boundaries;
- preload bridge contract boundaries;
- runtime mode and degraded-readiness guardrails.

Historical chronology moved to:
- `docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.ai.md`

## Host boundary constraints

- Electron host owns startup sequencing and privileged capability assembly.
- Renderer must consume typed bridge contracts instead of direct host imports.
- Host code must not absorb inner-layer business semantics.

## Preload boundary constraints

- Preload remains a thin contract bridge.
- New bridge APIs should be domain-scoped and typed.
- Deferred capability readiness/unavailability stays explicit.

## Runtime and persistence constraints

- Desktop persistence is the durable host-backed path.
- Browser fallback is bounded and non-authoritative for protected behavior.
- Runtime readiness remains multi-state and diagnostics-driven.

## Canonical links

- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- `docs/architecture/domain-and-application-core.ai.md`

## Historical material

Full rollout chronology is preserved in:
- `docs/baselines/architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.ai.md`
