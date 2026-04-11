# AI Companion: Baselines Documentation Router

## Audience
- AI assistants that need historical project context.
- Engineers validating what changed across stories or epics.

## Purpose
- Entry point for documentation baseline and migration-history artifacts.

## Target Folder Strategy
- Default baseline destination: `docs/baselines/`.
- Preferred migration landing zones:
  - `docs/baselines/architecture/`
  - `docs/baselines/contributors/`
  - `docs/baselines/operations/`
  - `docs/baselines/context/`
  - `docs/baselines/ui/`
  - `docs/baselines/cross-cutting/`
- Old active paths may keep short superseded pointer notes only for link continuity.
- Decision supersession lineage remains in `docs/adr/records/`.

## Belongs Here
- Baseline reports tied to stories/epics.
- Migration inventories and snapshot artifacts.
- Historical completion records preserved for traceability.

## Does Not Belong Here
- Active operational procedures.
- Current contributor extension workflows.
- Canonical architecture design references.

## Start Here
- [Feature 1 Documentation Foundation Completion Handoff](./feature-1-documentation-foundation-handoff.ai.md)
- [Documentation Migration Baseline](../documentation-migration-baseline.ai.md)
- [Documentation Migration Inventory](../documentation-migration-baseline.inventory.json)
- [Baseline and Historical Folder Strategy](../context/documentation-baseline-and-historical-folder-strategy.ai.md)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.ai.md)
- [Docs Top-Level Contract](../README.ai.md)
- [Context Router](../context/README.ai.md)
