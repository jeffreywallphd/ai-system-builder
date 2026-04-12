# AI Companion: Context Routing Directory

## Audience
- AI assistants and engineers implementing deterministic context routing.
- Maintainers governing task-to-context map quality.

## Purpose
- Canonical location for machine-readable routing contracts and mapping seeds.
- Ensure deterministic context assembly ordering so first-tier context is loaded before optional support material.

## Belongs Here
- Task-to-context mapping contracts.
- Seed map artifacts with practical workflow routing entries.
- Prompt routing contracts with category-specific inclusion, exclusion, and fallback behavior.

## Does Not Belong Here
- Full pack narrative content.
- Runtime orchestration implementation details.
- Operations runbooks.

## Start Here
- [Human-Readable Prompt Routing Guidance](../prompt-routing.ai.md)
- [Prompt Routing Contract and Task Categories](./prompt-routing-contract.ai.md)
- [Task-to-Context Routing Contract](./task-to-context-routing.contract.json)
- [Task-to-Context Routing Seed](./task-to-context-routing.seed.json)
- [Initial Context Map](../context-map.json)
- [Routing Entry Template](../templates/task-to-context-routing-entry.template.json)
- [Context Asset Metadata Standard](../context-asset-metadata.ai.md)
- [Context Packs Directory](../packs/README.ai.md)
- [Context Engineering System Contributor Guide](../../contributors/context-engineering-system-guide.ai.md)

## Initial Workflow Coverage
- Architecture review work for host and system boundaries.
- Feature decomposition work for story slicing and sequencing.
- Core implementation work across `src/` application, domain, infrastructure, and hosts.
- Documentation refactor work for context and architecture routers/contracts.
- Runtime and host diagnostics triage workflows.
- Runtime security workflows for identity, policy enforcement, trust, and secrets-sensitive updates.
- Studio and system design workflows spanning UI and handoff contracts.
