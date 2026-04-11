---
title: Documentation Router
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - dev/tests/DocsTopLevelContractGuardrails.test.ts
---

# Documentation Router

Use this page to pick the right documentation path quickly. It routes by reader intent and points to authoritative docs without repeating long-form content.

## Active Documentation Quick Start

- Architecture authority: [Architecture Router](./architecture/README.md)
- Contributor implementation workflows: [Contributors Router](./contributors/README.md)
- Runtime/admin runbooks: [Operations Router](./operations/README.md)
- Context taxonomy and routing rules: [Context Router](./context/README.md)
- UI behavior contracts: [UI Router](./ui/README.md)
- Prompt helpers: [Prompts Router](./prompts/README.md)
- Decision lineage: [ADR Router](./adr/README.md)

## Documentation Areas

- Active current-guidance routers:
  `docs/architecture/` [Architecture](./architecture/README.md), `docs/contributors/` [Contributors](./contributors/README.md), `docs/operations/` [Operations](./operations/README.md), `docs/context/` [Context](./context/README.md), `docs/ui/` [UI](./ui/README.md), `docs/prompts/` [Prompts](./prompts/README.md), `docs/adr/` [ADR](./adr/README.md).
- Historical and migration routers:
  `docs/baselines/` [Baselines](./baselines/README.md).

## Route By Reader Type

- Architecture reviewer: start in [docs/architecture/](./architecture/README.md), then open relevant ADRs in [docs/adr/](./adr/README.md).
- Contributor implementing changes: start in [docs/contributors/](./contributors/README.md), then follow links to architecture or UI contracts.
- Operator/support maintainer: start in [docs/operations/](./operations/README.md) for runtime and troubleshooting guidance.
- AI assistant or cross-domain reader: start in [docs/context/](./context/README.md) for taxonomy and metadata conventions.

## Route By Task

- Place a new document: use [Docs Placement Guide](./contributors/docs-placement-guide.md).
- Apply taxonomy and metadata correctly: use [Documentation Taxonomy](./context/documentation-taxonomy.md), [Documentation Indexing Model and Goals](./context/documentation-indexing-model.md), [Indexed Document Metadata Contract](./context/documentation-indexed-document-metadata.md), [Documentation Registry Structure](./context/documentation-registry.md), [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.md), [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.md), [Documentation Status Signals](./context/documentation-status-signals.md), [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.md), and [Metadata Header Contract](./context/documentation-metadata-header.md).
- Start with current authoritative guidance (default path): use [Architecture Router](./architecture/README.md), [Contributors Router](./contributors/README.md), [Operations Router](./operations/README.md), and [Context Router](./context/README.md).
- Plan historical-isolation migration work: use [Documentation Segmentation Migration Inventory](./documentation-segmentation-migration-inventory.md).
- Locate current system design authority: use [Architecture Router](./architecture/README.md).
- Find historical delivery/migration records and Feature 1 handoff context: use [Baselines Router](./baselines/README.md).

## Common Reader Journeys

- Understand architecture boundaries and decisions: [Architecture Router](./architecture/README.md) -> [Domain And Application Core](./architecture/domain-and-application-core.md) -> [ADR Router](./adr/README.md).
- Contribute a code change safely: [Contributors Router](./contributors/README.md) -> [Documentation Placement Guide](./contributors/docs-placement-guide.md) -> [Architecture Router](./architecture/README.md).
- Operate or troubleshoot the system locally: [Operations Router](./operations/README.md) -> [Node Bootstrap Identity Operations](./node-bootstrap-identity-operations.md) -> [Secret Health And Operational Diagnostics](./secret-health-and-operational-diagnostics.md).
- Review historical baselines and migration context: [Baselines Router](./baselines/README.md) -> [Feature 1 Documentation Foundation Completion Handoff](./baselines/feature-1-documentation-foundation-handoff.md) -> [Documentation Migration Baseline](./documentation-migration-baseline.md).
- Plan segmentation and historical-isolation migration batches: [Documentation Segmentation Migration Inventory](./documentation-segmentation-migration-inventory.md) -> [Baseline and Historical Folder Strategy](./context/documentation-baseline-and-historical-folder-strategy.md) -> [Baselines Router](./baselines/README.md).
- Prepare AI context for implementation or analysis: [Context Router](./context/README.md) -> [Documentation Taxonomy](./context/documentation-taxonomy.md) -> [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.md) -> [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.md) -> [Documentation Status Signals](./context/documentation-status-signals.md) -> [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.md).

## Durability Rules

- Keep this root README navigation-first and concise.
- Keep authoritative detail in linked destination docs.
- Keep the default path active-first; do not route everyday readers through baselines unless they need historical evidence.
- Update this router only when top-level structure or primary entry paths change.
