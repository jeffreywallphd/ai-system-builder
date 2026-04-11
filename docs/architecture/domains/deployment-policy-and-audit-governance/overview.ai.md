---
title: Deployment Policy and Audit Governance Domain Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/deployment
  - src/domain/audit
  - src/application/policy-administration
---
# Deployment Policy and Audit Governance Domain Overview

## Purpose

Define governance boundaries for deployment policy posture, policy explainability, and durable audit evidence.

## Domain Summary for Fast Context Selection

- Primary focus: Deployment policy governance, policy explainability, and durable audit evidence boundaries.
- Boundary line: Owns policy resolution/override and governance evidence contracts; does not own execution node internals or identity proof mechanics.
- Why it matters: Governance reliability depends on this domain to keep policy outcomes explainable and audit evidence reviewable over time.
- Context-pack relationship: This overview defines architecture boundaries. Context packs in `docs/context/packs/` assemble task-specific retrieval and should reference this domain instead of duplicating it.

## Scope and System Boundary

In scope:
- Policy profile resolution and override authority contracts.
- Audit ledger persistence, query, and event governance boundaries.
- Authoritative policy-administration command/query surfaces.

Out of scope:
- Run dispatch mechanics and execution node internals.
- Identity/session proof mechanics.
- Feature-local logging that is not governance evidence.

## Canonical Responsibilities

- Keep policy posture deterministic across profile presets and runtime-admin controls.
- Preserve source-attributed explainability for effective policy outcomes.
- Ensure governance evidence is durable and reviewable across policy mutations.

## Cross-Cutting Invariants

- Runtime overrides cannot bypass `profile-fixed` controls.
- Policy resolution output remains source-attributed and validation-safe.
- Governance evidence capture is mandatory for policy-admin mutations.

## Integration and Dependency Boundaries

- `execution-control-plane-and-scheduling` consumes resolved policy posture for placement and lifecycle gates.
- `identity-trust-and-security` provides trusted actor/session context for policy-admin authorization.
- `workspace-storage-and-assets` and other domains consume governance outcomes.
- `api-and-transport-surfaces` exposes policy-admin and audit APIs via shared contracts.

## Reference Map

Contract-level details are canonical in `./references/`:
- [Deployment Policy Resolution and Overrides](./references/deployment-policy-resolution-and-overrides.md)

## Canonical Source Documents Migrated into This Domain

- [Deployment Profile Policy Administration Foundation](../../deployment-profile-policy-administration-foundation.md)
- [Deployment Profile Policy Effective Resolution and Overrides](../../deployment-profile-policy-effective-resolution-and-overrides.md)
- [Audit Domain Foundation](../../audit-domain-foundation.md)
- [Audit Ledger Persistence Query and Access Control Architecture](../../audit-ledger-persistence-query-and-access-control-architecture.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)

## Related Contributor and Operations Guidance

- [Deployment Profile Policy Contributor Guide](../../../deployment-profile-policy-contributor-guide.md)
- [Audit Governance Contributor Guide](../../../audit-governance-contributor-guide.md)
- [Governance Audit Review Workflows](../../../governance-audit-review-workflows.md)

## Related Code Paths

- [src/domain/deployment](../../../../src/domain/deployment)
- [src/domain/audit](../../../../src/domain/audit)
- [src/application/policy-administration](../../../../src/application/policy-administration)
- [src/infrastructure/audit](../../../../src/infrastructure/audit)
