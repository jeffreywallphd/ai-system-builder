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

## Documentation Areas

- `docs/architecture/`: [Architecture Router](./architecture/README.md) for system boundaries and canonical design contracts.
- `docs/contributors/`: [Contributors Router](./contributors/README.md) for implementation workflows and extension guardrails.
- `docs/operations/`: [Operations Router](./operations/README.md) for runbooks, diagnostics, and support procedures.
- `docs/baselines/`: [Baselines Router](./baselines/README.md) for historical snapshots and migration artifacts.
- `docs/adr/`: [ADR Router](./adr/README.md) for architecture decisions and supersession history.
- `docs/context/`: [Context Router](./context/README.md) for taxonomy, metadata contract, and shared context packs.
- `docs/prompts/`: [Prompts Router](./prompts/README.md) for reusable prompt templates and helpers.
- `docs/ui/`: [UI Router](./ui/README.md) for UI behavior and UX implementation contracts.

## Route By Reader Type

- Architecture reviewer: start in [docs/architecture/](./architecture/README.md), then open relevant ADRs in [docs/adr/](./adr/README.md).
- Contributor implementing changes: start in [docs/contributors/](./contributors/README.md), then follow links to architecture or UI contracts.
- Operator/support maintainer: start in [docs/operations/](./operations/README.md) for runtime and troubleshooting guidance.
- AI assistant or cross-domain reader: start in [docs/context/](./context/README.md) for taxonomy and metadata conventions.

## Route By Task

- Place a new document: use [Docs Placement Guide](./contributors/docs-placement-guide.md).
- Apply taxonomy and metadata correctly: use [Documentation Taxonomy](./context/documentation-taxonomy.md), [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.md), [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.md), [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.md), and [Metadata Header Contract](./context/documentation-metadata-header.md).
- Locate current system design authority: use [Architecture Router](./architecture/README.md).
- Find historical delivery/migration records and Feature 1 handoff context: use [Baselines Router](./baselines/README.md).

## Common Reader Journeys

- Understand architecture boundaries and decisions: [Architecture Router](./architecture/README.md) -> [Domain And Application Core](./architecture/domain-and-application-core.md) -> [ADR Router](./adr/README.md).
- Contribute a code change safely: [Contributors Router](./contributors/README.md) -> [Documentation Placement Guide](./contributors/docs-placement-guide.md) -> [Architecture Router](./architecture/README.md).
- Operate or troubleshoot the system locally: [Operations Router](./operations/README.md) -> [Node Bootstrap Identity Operations](./node-bootstrap-identity-operations.md) -> [Secret Health And Operational Diagnostics](./secret-health-and-operational-diagnostics.md).
- Review historical baselines and migration context: [Baselines Router](./baselines/README.md) -> [Feature 1 Documentation Foundation Completion Handoff](./baselines/feature-1-documentation-foundation-handoff.md) -> [Documentation Migration Baseline](./documentation-migration-baseline.md).
- Prepare AI context for implementation or analysis: [Context Router](./context/README.md) -> [Documentation Taxonomy](./context/documentation-taxonomy.md) -> [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.md) -> [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.md) -> [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.md).

## Durability Rules

- Keep this root README navigation-first and concise.
- Keep authoritative detail in linked destination docs.
- Update this router only when top-level structure or primary entry paths change.
