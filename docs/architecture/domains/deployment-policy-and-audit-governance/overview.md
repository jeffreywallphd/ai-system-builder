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

Own governance architecture for deployment policy administration, policy explainability, and audit evidence recording.

## Boundary

- Defines deployment policy resolution/override boundaries and audit recording authority contracts.
- Delegates runtime dispatch mechanics to execution-control-plane-and-scheduling and identity proofing to identity-trust-and-security.

## Foundational Concepts

- Deployment profiles (`home`, `classroom`, `organization`) define baseline posture through explicit inheritance and typed policy-family settings.
- Policy control modes (`profile-fixed`, `profile-default-admin-overridable`, `runtime-admin`) separate immutable profile intent from mutable runtime administration.
- Effective policy snapshots are source-attributed (`profile-preset`, `policy-default`, `admin-state`) for explainability and auditability.
- Policy evaluation is restricted to domain/application seams; UI/transport/infrastructure shortcut evaluation is prohibited.
- Audit governance captures durable evidence of policy and administration actions without coupling to feature-local logging patterns.

## Domain-Wide Invariants

- Runtime admin overrides must respect control-mode boundaries and cannot bypass `profile-fixed` settings.
- Policy catalogs and presets require typed validation, inheritance safety, and cycle prevention.
- Governance events must be attributable and durable enough for operational review.
- Audit recording and policy explainability are platform-level concerns, not endpoint-by-endpoint ad hoc behavior.

## Cross-Domain Dependency Rules

- `execution-control-plane-and-scheduling` consumes resolved policy posture for placement, dispatch, and lifecycle gating.
- `identity-trust-and-security` supplies actor/session trust context for policy-admin authorization.
- `workspace-storage-and-assets` and other resource domains consume governance policy outcomes for operational behavior.
- `api-and-transport-surfaces` exposes policy-admin and audit query/mutation routes with shared contracts.

## Seed Scope Guidance

- Seed references for policy administration authority and audit ledger/event contracts first.
- Keep governance architecture authoritative here while linking outward for runtime behavior details.
- Avoid embedding implementation task plans; keep this domain focused on durable governance contracts.

## Canonical Source Documents Migrated into This Overview

- [Deployment Profile Policy Administration Foundation](../../deployment-profile-policy-administration-foundation.md)
- [Deployment Profile Policy Effective Resolution and Overrides](../../deployment-profile-policy-effective-resolution-and-overrides.md)
- [Audit Domain Foundation](../../audit-domain-foundation.md)
- [Audit Ledger Persistence Query and Access Control Architecture](../../audit-ledger-persistence-query-and-access-control-architecture.md)

## What Belongs in the Overview

- Domain boundary intent, ownership seams, and cross-domain dependency rules.
- Domain-wide invariants that shape multiple reference contracts.
- Concise routing links to the canonical reference documents in ./references/.

## What Does Not Belong in the Overview

- Endpoint-level schemas, API payload matrices, and low-level interface catalogs.
- Step-by-step operational runbooks and troubleshooting procedures.
- Contributor process checklists, implementation task plans, or release notes.

## Related Domain References

- [Domain References Index](./references/README.md)

## Related ADRs

- [adr-001-single-authoritative-control-plane.md](../../../adr/records/adr-001-single-authoritative-control-plane.md)
- [adr-006-policy-aware-scheduling-and-controlled-execution.md](../../../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)

## Related Context Packs

- [Architecture Core](../../../context/packs/architecture-core.pack.md)
- [Repository Overview](../../../context/packs/repository-overview.pack.md)
