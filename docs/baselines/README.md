# Baselines Documentation Router

## Audience
- Engineers and reviewers validating historical delivery context.
- Maintainers checking migration and completion snapshots.

## Purpose
- Historical baseline and migration artifacts used for traceability.

## Target Folder Strategy
- Use `docs/baselines/` as the default destination for historical snapshots and migration evidence.
- Prefer these migration landing zones when applicable:
  - `docs/baselines/architecture/`
  - `docs/baselines/contributors/`
  - `docs/baselines/operations/`
  - `docs/baselines/context/`
  - `docs/baselines/ui/`
  - `docs/baselines/cross-cutting/`
- Keep old-path documents in active areas as short superseded pointers only when link continuity is needed.
- Use `docs/adr/records/` for superseded architecture decision lineage, not baseline snapshot bundles.

## Belongs Here
- Story or epic baseline snapshots and completion records.
- Migration inventories and point-in-time documentation captures.
- Historical handoff artifacts preserved for auditability.

## Does Not Belong Here
- Current operational runbooks.
- Active contributor implementation workflows.
- Canonical architecture references for current behavior.

## Start Here
- [Feature 1 Documentation Foundation Completion Handoff](./feature-1-documentation-foundation-handoff.md)
- [Documentation Migration Baseline](../documentation-migration-baseline.md)
- [Documentation Migration Inventory](../documentation-migration-baseline.inventory.json)
- [Documentation Segmentation Migration Inventory (Story 5.2.1)](../documentation-segmentation-migration-inventory.md)
- [Documentation Segmentation Migration Inventory JSON](../documentation-segmentation-migration-inventory.inventory.json)
- [Baseline and Historical Folder Strategy](../context/documentation-baseline-and-historical-folder-strategy.md)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.md)
- [Docs Top-Level Contract](../README.md)
- [Context Router](../context/README.md)
