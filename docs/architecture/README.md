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

## Active Authority Scope
- This router is for current architecture authority and active implementation boundaries.
- Use [Architecture Baselines Router](../baselines/architecture/README.md) only for historical snapshots and prior-state migration context.

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
- [Architecture Migration Sequence and Priority Order](./architecture-migration-sequence-and-priority.md)
- [Architecture Domainization Rollout Boundaries and Follow-On Work](./architecture-domainization-rollout-boundaries.md)
- [Architecture Supersession and Retirement Governance](./architecture-supersession-and-retirement-governance.md)
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

## Route By Common Contributor Task
- Understand the core system architecture and layer boundaries:
  [Core Platform and Composition](./domains/core-platform-and-composition/overview.md)
- Review runtime design, startup boundaries, and host lifecycle behavior:
  [Runtime Host Surfaces](./domains/runtime-host-surfaces/overview.md)
- Work on studio-facing behavior and studio/system composition seams:
  [Studio and System Composition](./domains/studio-and-system-composition/overview.md)
- Examine security-sensitive trust, authz, and secret-handling boundaries:
  [Identity Trust and Security](./domains/identity-trust-and-security/overview.md)
- Need worked navigation examples for architecture review, decomposition, runtime diagnostics, security-sensitive changes, and doc refactors:
  [Architecture Domain Navigation Worked Examples](../contributors/architecture-domain-navigation-worked-examples.md)
- Need worked examples for deciding active versus historical sources during decomposition, review, migration planning, and troubleshooting:
  [Active vs Historical Docs Worked Examples](../contributors/active-vs-historical-docs-worked-examples.md)
- Need contributor workflow guidance for index-first discovery and metadata-based authority checks:
  [Documentation Index Daily Usage Guide](../contributors/documentation-index-daily-usage-guide.md)
- Need repository task examples showing index-assisted discovery across routing, taxonomy, and status signals:
  [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.md)
- Need passing and failing examples for architecture docs, ADRs, routing, registry, context packs, and baseline handling under docs-quality enforcement:
  [Documentation Quality Worked Examples](../contributors/documentation-quality-worked-examples.md)
- Need full task-to-context-pack assembly rules instead of architecture-only routing:
  [Context Routing Router](../context/routing/README.md)

## Route By Document Type
- Domain boundaries and invariants: start in the relevant `overview.md` above.
- Contract detail: open each domain `references/README.md` from [Domain Folder Contract](./domains/README.md).
- Decision rationale: [ADR Router](../adr/README.md).
- Cross-domain authoring and placement standards: [Contributors Router](../contributors/README.md).

## Active Flat References Pending Domain Migration
- [Multi-Surface UI Composition Foundation](./multi-surface-ui-composition-foundation.md)
- [Run Orchestration Scheduling Authoritative Queue Selection and Assignment Integration](./run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md)
- [Unified API Endpoint Reference](./unified-api-endpoint-reference.md)
