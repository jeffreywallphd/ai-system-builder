---
title: "AI Companion: Shared Asset Contracts (Legacy Link Stub)"
doc_type: architecture-reference
status: superseded
authoritativeness: historical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
superseded_by: docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.md
related_code_paths:
  - docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.md
  - docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.md
---

# Shared Asset Contracts

## Supersession Notice

This document is a `migrated-link-stub` and is not canonical.

## Split Routing for Previously Mixed Content

The prior version mixed workspace/storage, API, and studio concerns. Canonical authority now routes as follows:

- Workspace asset model and selection authority:
  - `docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.md`
- API/transport contract authority:
  - `docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.md`
- Studio composition authority:
  - `docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md`
- Execution handoff authority:
  - `docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md`

## Related ADRs

- `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md`
- `docs/adr/records/adr-003-storage-as-managed-platform-resource.ai.md`
- `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md`
