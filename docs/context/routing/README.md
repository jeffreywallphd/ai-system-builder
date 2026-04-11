# Context Routing Directory

## Audience
- Engineers and assistants wiring deterministic task-to-context selection.
- Maintainers defining and reviewing routing contracts.

## Purpose
- Keep routing policies and task-to-context mapping artifacts in one durable, machine-readable location.

## Belongs Here
- Routing contracts that define required mapping fields.
- Seed task-to-context mapping registries for future stories.
- Prompt routing contracts that define category-specific inclusion, exclusion, and fallback behavior.

## Does Not Belong Here
- Full context pack content.
- Runtime service implementation code.
- Operational runbooks.

## Start Here
- [Prompt Routing Contract and Task Categories](./prompt-routing-contract.md)
- [Task-to-Context Routing Contract](./task-to-context-routing.contract.json)
- [Task-to-Context Routing Seed](./task-to-context-routing.seed.json)
- [Initial Context Map](../context-map.json)
- [Routing Entry Template](../templates/task-to-context-routing-entry.template.json)
- [Context Asset Metadata Standard](../context-asset-metadata.md)
- [Context Packs Directory](../packs/README.md)
