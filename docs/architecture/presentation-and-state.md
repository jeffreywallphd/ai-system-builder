---
title: Presentation and State (Legacy Link Stub)
doc_type: architecture-reference
status: superseded
authoritativeness: historical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
superseded_by: docs/architecture/domains/studio-and-system-composition/references/studio-ui-composition-and-state.md
related_code_paths:
  - docs/architecture/domains/studio-and-system-composition/references/studio-ui-composition-and-state.md
  - docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md
---

# Presentation and State

## Supersession Notice

This document is a `migrated-link-stub` and is no longer authoritative. Use the canonical domain references below for implementation and review decisions.

## Split Routing for Previously Mixed Content

The prior version of this document mixed multiple architecture domains. Canonical authority is now split as follows:

- Studio and composition contracts:
  - `docs/architecture/domains/studio-and-system-composition/references/studio-ui-composition-and-state.md`
  - `docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md`
- Execution control-plane and workflow handoff contracts:
  - `docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md`
- Runtime host assembly/startup contracts:
  - `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
- Multi-surface UI layering reference still active pending migration:
  - `docs/architecture/multi-surface-ui-composition-foundation.md`

## Related ADRs

- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`
