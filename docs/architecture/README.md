---
title: Architecture Documentation Router
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - src/composition
---

# Architecture Documentation Router

## Audience
- Engineers reviewing or changing architecture boundaries.
- Contributors mapping work to the correct architecture domain.

## Purpose
- Route readers to canonical architecture domains, references, ADRs, and migration inventories without duplicating detailed content.

## Belongs Here
- Quick routing into domain overviews and domain reference indexes.
- Cross-cutting architecture navigation docs and ADR linking expectations.

## Does Not Belong Here
- Long implementation walkthroughs or endpoint-level reference detail.
- Runbooks, contributor process checklists, and historical narrative content.

## ADR Linking Expectations
- Architecture docs should include `## Related ADRs` when decisions shape scope or constraints.
- Link ADRs with `docs/adr/records/adr-<NNN>-<decision-slug>.md` and maintain reverse links from ADR `## Related Documentation`.

## Start Here
- [Architecture Domain Taxonomy](./architecture-domain-taxonomy.md)
- [Domain Folder Contract](./domains/README.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
- [Architecture Domain Cross-Linking Rules](./architecture-domain-cross-linking-rules.md)

## Route By Domain
- [Core Platform and Composition](./domains/core-platform-and-composition/overview.md)
- [Runtime Host Surfaces](./domains/runtime-host-surfaces/overview.md)
- [Identity Trust and Security](./domains/identity-trust-and-security/overview.md)
- [Workspace Storage and Assets](./domains/workspace-storage-and-assets/overview.md)
- [Execution Control Plane and Scheduling](./domains/execution-control-plane-and-scheduling/overview.md)
- [Studio and System Composition](./domains/studio-and-system-composition/overview.md)
- [API and Transport Surfaces](./domains/api-and-transport-surfaces/overview.md)
- [Deployment Policy and Audit Governance](./domains/deployment-policy-and-audit-governance/overview.md)

## Route By Document Type
- Domain boundaries and invariants: start in the relevant `overview.md` above.
- Contract detail: open each domain `references/README.md` from [Domain Folder Contract](./domains/README.md).
- Decision rationale: [ADR Router](../adr/README.md).
- Cross-domain authoring and placement standards: [Contributors Router](../contributors/README.md).

## Active Flat References Pending Domain Migration
- [Multi-Surface UI Composition Foundation](./multi-surface-ui-composition-foundation.md)
- [Run Orchestration Scheduling Authoritative Queue Selection and Assignment Integration](./run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md)
- [Unified API Endpoint Reference](./unified-api-endpoint-reference.md)
