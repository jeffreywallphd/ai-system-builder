# AI Companion: Host Composition Extension Guardrails (Story 12.4.3) Baseline

## Baseline Introduction

Snapshot date: 2026-04-11
Snapshot scope: Story 12.4.3 host guardrail rollout history
Why this baseline exists: Preserve historical rollout and test-hardening context outside active architecture guidance paths.
Current canonical guidance: `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
Historical handling note: This file is historical evidence and not authoritative for new host-extension decisions.

## Historical Snapshot

- Host composition guardrail tests were introduced (`dev/tests/HostCompositionArchitectureGuardrails.test.ts`) to enforce canonical host coverage, placement, boundary seams, and dependency-boundary conventions.
- The migration-era contributor workflow for adding new hosts was documented around host runtime catalog entries, metadata projection, composition roots, host entrypoints, and guardrail test updates.
- The intent of this story was to prevent host composition drift while the host framework expanded.

## Canonical Current Guidance

- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- `docs/architecture/host-service-registration-composition-rules.ai.md`
