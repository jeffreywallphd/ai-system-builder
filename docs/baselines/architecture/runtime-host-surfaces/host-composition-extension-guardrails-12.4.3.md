# Host Composition Extension Guardrails (Story 12.4.3) Baseline

## Baseline Introduction

Snapshot date: 2026-04-11
Snapshot scope: Story 12.4.3 host-composition guardrail rollout
Why this baseline exists: Preserve migration-era guardrail rollout detail while directing current extension work to canonical runtime-host references.
Current canonical guidance: `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
Historical handling note: This file is historical rollout context and is non-authoritative for new implementation decisions.

## Historical Snapshot

Story 12.4.3 added architecture-level guardrails to keep host composition patterns enforceable as the codebase grew.

### Automated architecture validation introduced

`dev/tests/HostCompositionArchitectureGuardrails.test.ts` enforced:

- canonical host runtime coverage for `server`, `desktop`, `hybrid`, `web`, and `worker`
- canonical host file placement under `src/hosts/<kind>/`:
  - `*CompositionRoot.ts`
  - `*HostEntrypoint.ts`
- host composition-root implementations staying inside `src/hosts/**`
- required host-framework seams in each composition root:
  - executable boundary assertion
  - shared bootstrap pipeline and startup context composition
  - host service registration plan composition
  - host-specific service coverage assertion
- no direct `src/ui/` imports from host composition roots
- host entrypoints defaulting required dependency ids from host runtime startup dependency declarations
- explicit startup dependency boundary coverage with stable dependency-id prefixing

### Contributor workflow guardrails introduced

The story documented a contributor workflow for adding new hosts:

1. Add a runtime profile in `src/hosts/HostRuntimeCatalog.ts`.
2. Keep runtime metadata projection in `src/hosts/HostRuntimeMetadataCatalog.ts`.
3. Add a composition root in `src/hosts/<new-kind>/<NewKind>CompositionRoot.ts`.
4. Add an entrypoint in `src/hosts/<new-kind>/<NewKind>HostEntrypoint.ts`.
5. Add new host coverage to host-composition guardrail tests.

## Canonical Current Guidance

- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- `docs/architecture/host-service-registration-composition-rules.md`
