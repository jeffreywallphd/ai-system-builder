---
title: Architecture Domain Taxonomy
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain
  - src/application
  - src/hosts
  - src/infrastructure
---

# Architecture Domain Taxonomy

## Purpose

Define the target domain taxonomy for `docs/architecture` so migration work groups architecture knowledge by stable system boundaries instead of by document history.

## Why This Taxonomy Exists

- The current architecture set has strong technical coverage but many flat, feature-shaped documents.
- Domain folders are needed to make boundaries explicit for contributors and AI assistants.
- Future migration stories need one stable taxonomy to prevent overlapping or competing domain groupings.

## Taxonomy Design Constraints

- Domains must map to real ownership and runtime boundaries already present in `src/`.
- Domains must align with accepted ADRs in `docs/adr/records/adr-registry.json`.
- The taxonomy must avoid tiny or temporary domains that encode implementation convenience.
- Cross-domain concerns must be routed by explicit boundary rules rather than duplicate authority.

## Target Architecture Domains

| Domain ID | Why this domain exists | Primary boundary signals | Grounding evidence |
| --- | --- | --- | --- |
| `core-platform-and-composition` | Preserve the inner architecture contracts that define system meaning independently of host/runtime adapters. | Domain/application contracts, layering rules, composition seams. | `src/domain`, `src/application`, `docs/architecture/domain-and-application-core.md`, `docs/architecture/layers-and-boundaries.md`, `docs/adr/records/adr-001-single-authoritative-control-plane.md` |
| `runtime-host-surfaces` | Separate runtime host assembly and startup lifecycle rules from inner business policy. | Host authority, bootstrap pipelines, pre-login vs post-login startup, host-specific composition roots. | `src/hosts`, `electron/main`, `docs/architecture/desktop-runtime-and-hosts.md`, `docs/architecture/authoritative-server-host-assembly.md`, `docs/architecture/host-bootstrap-pipeline.md` |
| `identity-trust-and-security` | Keep identity proof, authorization, trust establishment, and secret handling as explicit fail-closed architecture boundaries. | Authentication/session trust, authorization policy enforcement, trusted device/node trust, redaction. | `src/application/identity`, `src/application/authorization`, `src/infrastructure/security`, `docs/architecture/authorization-foundation.md`, `docs/architecture/secrets-foundation.md`, `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md` |
| `workspace-storage-and-assets` | Capture tenancy, resource ownership, and asset/storage lifecycle boundaries as a coherent platform resource domain. | Workspace tenancy and ownership, storage provisioning and access semantics, image/generated asset models. | `src/domain/workspaces`, `src/domain/storage`, `src/domain/assets`, `docs/architecture/workspace-foundation.md`, `docs/architecture/storage-foundation.md`, `docs/architecture/image-asset-domain-foundation.md`, `docs/adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md`, `docs/adr/records/adr-003-storage-as-managed-platform-resource.md` |
| `execution-control-plane-and-scheduling` | Bound run submission, orchestration, scheduling policy, and execution readiness under one control-plane authority model. | Run lifecycle state authority, queueing/dispatch rules, policy-aware scheduling, execution-node readiness. | `src/domain/runs`, `src/domain/execution`, `src/domain/scheduling`, `docs/architecture/run-submission-validation-policy-eligibility.md`, `docs/architecture/run-orchestration-domain-foundation.md`, `docs/architecture/execution-node-domain-model-image-backend-hosting.md`, `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md` |
| `studio-and-system-composition` | Keep studio UX surfaces aligned to shared system/workflow/asset contracts instead of becoming separate model authorities. | Studio handoff contracts, system and workflow composition boundaries, presenter/projector responsibilities. | `src/ui/studio-shell`, `src/application/system-studio`, `src/application/workflow-studio`, `docs/architecture/studio-handoff-contract.md`, `docs/architecture/shared-composition-taxonomy.md`, `docs/architecture/image-system-domain-foundation.md`, `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md` |
| `api-and-transport-surfaces` | Centralize external and internal API contracts so transport adapters and route families stay consistent with application ports. | Unified API surface, transport contracts, endpoint families, request/response and event contracts. | `src/infrastructure/transport`, `src/infrastructure/api`, `docs/architecture/unified-api-authoritative-surface.md`, `docs/architecture/unified-api-endpoint-reference.md`, `docs/architecture/run-orchestration-transport-contracts.md`, `docs/architecture/shared-api-contract-package.md` |
| `deployment-policy-and-audit-governance` | Bound deployment policy administration and audit recording as governance architecture, not feature-local behavior. | Deployment profile policy evaluation/overrides, audit ledger/event contracts, operational explainability/redaction boundaries. | `src/domain/deployment`, `src/domain/audit`, `src/application/policy-administration`, `docs/architecture/deployment-profile-policy-administration-foundation.md`, `docs/architecture/audit-domain-foundation.md`, `docs/architecture/deployment-profile-policy-taxonomy-registry.md` |

## Domain Boundary Rules

1. `core-platform-and-composition` owns layer direction and inner model policy; runtime-specific startup mechanics belong in `runtime-host-surfaces`.
2. `identity-trust-and-security` owns access and trust enforcement. Tenant or resource scoping stays in `workspace-storage-and-assets` unless the rule is security policy logic.
3. `execution-control-plane-and-scheduling` owns run lifecycle transitions and scheduling behavior; workflow modeling contracts stay in `core-platform-and-composition` or `studio-and-system-composition` depending on surface.
4. `api-and-transport-surfaces` owns route/event wire contracts, not business policy. Policy source-of-truth remains in the domain that defines it.
5. `deployment-policy-and-audit-governance` owns governance controls and evidence recording, but does not own runtime dispatch logic or identity proofing.

## Target Domain Folder Model (Migration Target)

Later migration stories should converge on this folder shape:

```text
docs/architecture/
  README.md
  architecture-domain-taxonomy.md
  domains/
    <domain-id>/
      overview.md
      references/
        *.md
```

Folder naming rule:
- Use the domain IDs in this taxonomy as folder names under `docs/architecture/domains/`.
- Keep one `overview.md` per domain as the routing and boundary contract.
- Place detailed contracts under `references/` for that same domain.

## Migration Guidance for Later Stories

1. Move documents into domain folders by authoritative source boundary, not by feature ticket number.
2. Prefer one canonical home per document and use links for cross-domain relationships.
3. Add `## Related ADRs` to domain overviews/references where ADR constraints apply.
4. Update context packs and routing seeds after each migration batch so retrieval remains accurate.

## Related ADRs

- [ADR-001: Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.md)
- [ADR-002: Workspace-Centered Tenancy and Resource Ownership](../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.md)
- [ADR-003: Storage as Managed Platform Resource](../adr/records/adr-003-storage-as-managed-platform-resource.md)
- [ADR-004: Studios as Views Over Shared System and Asset Model](../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md)
- [ADR-005: Trust, Identity, and Security Boundary Enforcement](../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md)
- [ADR-006: Policy-Aware Scheduling and Controlled Execution](../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md)
