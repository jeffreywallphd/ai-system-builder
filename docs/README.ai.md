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

## Documentation Areas

- `docs/architecture/`: [Architecture Router](./architecture/README.ai.md) for canonical architecture contracts.
- `docs/contributors/`: [Contributors Router](./contributors/README.ai.md) for contributor implementation workflows.
- `docs/operations/`: [Operations Router](./operations/README.ai.md) for runtime/admin runbooks and diagnostics.
- `docs/baselines/`: [Baselines Router](./baselines/README.ai.md) for historical baselines and migration snapshots.
- `docs/adr/`: [ADR Router](./adr/README.ai.md) for decision records and supersession history.
- `docs/context/`: [Context Router](./context/README.ai.md) for taxonomy and metadata contract anchors.
- `docs/prompts/`: [Prompts Router](./prompts/README.ai.md) for reusable prompt helpers.
- `docs/ui/`: [UI Router](./ui/README.ai.md) for UI behavior and UX contract docs.

## Route By Reader Type

- Architecture reviewer: start in [docs/architecture/](./architecture/README.ai.md), then review decisions in [docs/adr/](./adr/README.ai.md).
- Contributor implementing a change: start in [docs/contributors/](./contributors/README.ai.md), then follow linked architecture/UI contracts.
- Operator or support maintainer: start in [docs/operations/](./operations/README.ai.md).
- AI assistant building context: start in [docs/context/](./context/README.ai.md).

## Route By Task

- Decide placement for a new doc: [Docs Placement Guide](./contributors/docs-placement-guide.md).
- Apply canonical metadata fields: [Documentation Taxonomy](./context/documentation-taxonomy.ai.md), [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.ai.md), and [Metadata Header Contract](./context/documentation-metadata-header.ai.md).
- Find current design authority: [Architecture Router](./architecture/README.ai.md).
- Find historical baselines and Feature 1 handoff context: [Baselines Router](./baselines/README.ai.md).

## Common Reader Journeys

- Understand architecture boundaries and decisions: [Architecture Router](./architecture/README.ai.md) -> [Domain And Application Core](./architecture/domain-and-application-core.ai.md) -> [ADR Router](./adr/README.ai.md).
- Contribute a code change safely: [Contributors Router](./contributors/README.ai.md) -> [Docs Placement Guide](./contributors/docs-placement-guide.ai.md) -> [Architecture Router](./architecture/README.ai.md).
- Operate or troubleshoot the system locally: [Operations Router](./operations/README.ai.md) -> [Node Bootstrap Identity Operations](./node-bootstrap-identity-operations.ai.md) -> [Secret Health And Operational Diagnostics](./secret-health-and-operational-diagnostics.ai.md).
- Review historical baselines and migration context: [Baselines Router](./baselines/README.ai.md) -> [Feature 1 Documentation Foundation Completion Handoff](./baselines/feature-1-documentation-foundation-handoff.ai.md) -> [Documentation Migration Baseline](./documentation-migration-baseline.ai.md).
- Prepare AI context for implementation or analysis: [Context Router](./context/README.ai.md) -> [Documentation Taxonomy](./context/documentation-taxonomy.ai.md) -> [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.ai.md).

## Durability Rules

- Keep this root README thin and routing-only.
- Link to authoritative docs rather than restating detailed guidance.
- Update only when top-level docs navigation changes.
