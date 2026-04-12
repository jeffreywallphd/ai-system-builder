---
title: "AI Companion: Documentation Router"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - dev/tests/DocsTopLevelContractGuardrails.test.ts
---

# AI Companion: Documentation Router

Use this router to pick the correct documentation entry point by reader role or task. Keep deeper content in destination docs.

## Active Documentation Quick Start

- Architecture authority: [Architecture Router](./architecture/README.ai.md)
- Contributor implementation workflows: [Contributors Router](./contributors/README.ai.md)
- Runtime/admin runbooks: [Operations Router](./operations/README.ai.md)
- Context taxonomy and routing rules: [Context Router](./context/README.ai.md)
- UI behavior contracts: [UI Router](./ui/README.ai.md)
- Prompt helpers: [Prompts Router](./prompts/README.ai.md)
- Decision lineage: [ADR Router](./adr/README.ai.md)

## Documentation Areas

- Active current-guidance routers:
  `docs/architecture/` [Architecture](./architecture/README.ai.md), `docs/contributors/` [Contributors](./contributors/README.ai.md), `docs/operations/` [Operations](./operations/README.ai.md), `docs/context/` [Context](./context/README.ai.md), `docs/ui/` [UI](./ui/README.ai.md), `docs/prompts/` [Prompts](./prompts/README.ai.md), `docs/adr/` [ADR](./adr/README.ai.md).
- Historical and migration routers:
  `docs/baselines/` [Baselines](./baselines/README.ai.md).

## Route By Reader Type

- Architecture reviewer: start in [docs/architecture/](./architecture/README.ai.md), then review decisions in [docs/adr/](./adr/README.ai.md).
- Contributor implementing a change: start in [docs/contributors/](./contributors/README.ai.md), then follow linked architecture/UI contracts.
- Operator or support maintainer: start in [docs/operations/](./operations/README.ai.md).
- AI assistant building context: start in [docs/context/](./context/README.ai.md), then load [repository-overview.pack.ai.md](./context/packs/repository-overview.pack.ai.md) as the default first foundation pack for non-trivial prompts.

## Route By Task

- Decide placement for a new doc: [Docs Placement Guide](./contributors/docs-placement-guide.md).
- Apply canonical metadata fields: [Documentation Taxonomy](./context/documentation-taxonomy.ai.md), [Documentation Indexing Model and Goals](./context/documentation-indexing-model.ai.md), [Documentation Index Coverage Rules](./context/documentation-index-coverage-rules.ai.md), [Indexed Document Metadata Contract](./context/documentation-indexed-document-metadata.ai.md), [Documentation Registry Structure](./context/documentation-registry.ai.md), [Documentation Identity, Stable Keys, and Reference Conventions](./context/documentation-identity-and-reference-conventions.ai.md), [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.ai.md), [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.ai.md), [Documentation Status Signals](./context/documentation-status-signals.ai.md), [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.ai.md), and [Metadata Header Contract](./context/documentation-metadata-header.ai.md).
- Browse indexed documentation by category/domain/status: [Documentation Index View](./context/documentation-index.ai.md).
- Plan high-value registry population order: [Documentation Registry Population Inventory](./documentation-registry-population-inventory.ai.md).
- Start with current authoritative guidance (default path): [Architecture Router](./architecture/README.ai.md), [Contributors Router](./contributors/README.ai.md), [Operations Router](./operations/README.ai.md), and [Context Router](./context/README.ai.md).
- Plan historical-isolation migration work: [Documentation Segmentation Migration Inventory](./documentation-segmentation-migration-inventory.ai.md).
- Find current design authority: [Architecture Router](./architecture/README.ai.md).
- Find historical baselines and Feature 1 handoff context: [Baselines Router](./baselines/README.ai.md).

## Common Reader Journeys

- Understand architecture boundaries and decisions: [Architecture Router](./architecture/README.ai.md) -> [Domain And Application Core](./architecture/domain-and-application-core.ai.md) -> [ADR Router](./adr/README.ai.md).
- Contribute a code change safely: [Contributors Router](./contributors/README.ai.md) -> [Docs Placement Guide](./contributors/docs-placement-guide.ai.md) -> [Architecture Router](./architecture/README.ai.md).
- Operate or troubleshoot the system locally: [Operations Router](./operations/README.ai.md) -> [Node Bootstrap Identity Operations](./node-bootstrap-identity-operations.ai.md) -> [Secret Health And Operational Diagnostics](./secret-health-and-operational-diagnostics.ai.md).
- Review historical baselines and migration context: [Baselines Router](./baselines/README.ai.md) -> [Feature 1 Documentation Foundation Completion Handoff](./baselines/feature-1-documentation-foundation-handoff.ai.md) -> [Documentation Migration Baseline](./documentation-migration-baseline.ai.md).
- Plan segmentation and historical-isolation migration batches: [Documentation Segmentation Migration Inventory](./documentation-segmentation-migration-inventory.ai.md) -> [Baseline and Historical Folder Strategy](./context/documentation-baseline-and-historical-folder-strategy.ai.md) -> [Baselines Router](./baselines/README.ai.md).
- Prepare AI context for implementation or analysis: [Context Router](./context/README.ai.md) -> [Documentation Taxonomy](./context/documentation-taxonomy.ai.md) -> [Documentation Identity, Stable Keys, and Reference Conventions](./context/documentation-identity-and-reference-conventions.ai.md) -> [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.ai.md) -> [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.ai.md) -> [Documentation Status Signals](./context/documentation-status-signals.ai.md) -> [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.ai.md).

## Durability Rules

- Keep this root README thin and routing-only.
- Link to authoritative docs rather than restating detailed guidance.
- Keep the default path active-first; route to baselines only when historical evidence is needed.
- Update only when top-level docs navigation changes.
