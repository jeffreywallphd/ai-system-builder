---
title: "AI Companion: Architecture Documentation Router"
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts
  - src/composition
---

# AI Companion: Architecture Documentation Router

## Audience
- AI assistants routing architecture questions to canonical sources.
- Engineers validating where architecture authority lives.

## Purpose
- Route quickly into domain overviews, domain reference indexes, ADRs, and migration anchors without restating contract detail.

## Belongs Here
- Navigation into `docs/architecture/domains/*/overview.md` and `references/README.md`.
- Cross-cutting architecture navigation contracts and ADR backlink expectations.

## Does Not Belong Here
- Long-form design prose replacing domain/reference docs.
- Runbook procedures, contributor workflow checklists, or baseline archives.

## ADR Linking Expectations
- Add `## Related ADRs` when architecture scope is decision-constrained.
- Use `docs/adr/records/adr-<NNN>-<decision-slug>.ai.md` and keep reciprocal ADR `## Related Documentation` links.

## Start Here
- [Architecture Domain Taxonomy](./architecture-domain-taxonomy.md)
- [Domain Folder Contract](./domains/README.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Migration Sequence and Priority Order](./architecture-migration-sequence-and-priority.md)
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
  [Architecture Domain Navigation Worked Examples](../contributors/architecture-domain-navigation-worked-examples.ai.md)
- Need full task-to-context-pack assembly rules instead of architecture-only routing:
  [Context Routing Router](../context/routing/README.ai.md)

## Route By Document Type
- Domain boundary intent and invariants: use the selected domain `overview.md`.
- Domain contract surfaces: use `references/README.md` linked from [Domain Folder Contract](./domains/README.md).
- Decision rationale and supersession: [ADR Router](../adr/README.ai.md).
- Contributor authoring and placement standards: [Contributors Router](../contributors/README.ai.md).

## Active Flat References Pending Domain Migration
- [Multi-Surface UI Composition Foundation](./multi-surface-ui-composition-foundation.md) (`docs/architecture/multi-surface-ui-composition-foundation.md`)
- [Feature 17 / Epic 17.2 Story 17.2.8 Scheduling Integration](./run-orchestration-scheduling-authoritative-queue-selection-and-assignment-integration.md)
- [Unified API Endpoint Reference](./unified-api-endpoint-reference.md)
