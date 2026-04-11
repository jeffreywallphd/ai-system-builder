---
title: ADR-002 Workspace-Centered Tenancy and Resource Ownership
doc_type: adr
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
adr_number: 002
decision_status: accepted
decision_date: 2026-04-11
review_tier: heightened
last_reviewed: 2026-04-11
related_code_paths:
  - src/shared/workspaces/WorkspaceOwnership.ts
  - src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts
  - src/domain/storage/StorageDomain.ts
  - src/application/storage/use-cases/StorageManagementServiceContracts.ts
  - src/application/workflow-persistence/WorkflowWorkspaceScoping.ts
  - src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts
---

# ADR-002: Workspace-Centered Tenancy and Resource Ownership

## Status

accepted

## Decision Date

2026-04-11

## Decision Statement

AI Loom Studio uses a workspace-centered tenancy model. Workspace identity is the primary ownership and isolation boundary for protected resources, and resource-level ownership metadata must remain anchored to that workspace scope. User-private resources are allowed, but only as workspace-scoped resources with `private` visibility and explicit policy controls rather than as a separate non-workspace tenancy model.

## Context and Problem Statement

Workspace, storage, authorization, and runtime execution contracts already depend on consistent workspace linkage. Without one durable ADR, implementation can drift into mixed tenancy assumptions (workspace-first in one slice, user-first in another, or resource-family-specific ownership models), causing policy inconsistency, ambiguous isolation guarantees, and recurring design debate.

The repository needs one explicit decision of record describing tenancy and ownership boundaries that downstream storage, assets, execution, policy, and user-private resource behavior must respect.

## Decision Drivers

- Keep tenancy boundaries explicit and stable across domains.
- Preserve strong isolation semantics for workspace-scoped resources.
- Avoid policy ambiguity across storage, assets, execution, and sharing flows.
- Keep user-private posture compatible with collaboration and audit models.
- Reduce architectural drift during human and AI-assisted implementation.

## Considered Options

1. Workspace-centered tenancy with workspace-scoped ownership metadata (accepted): one consistent boundary across resource families, storage policies, and runtime execution.
2. User-centered tenancy with workspace as collaboration overlay (rejected): treats user identity as primary owner and workspace as optional grouping; rejected because it weakens cross-domain workspace isolation guarantees and complicates shared policy enforcement.
3. Resource-family-specific tenancy models (rejected): lets each domain define its own ownership root; rejected because it fragments policy semantics and creates inconsistent access/isolation behavior.
4. Dual-root tenancy (workspace and user as independent top-level authorities) (rejected): rejected because it introduces ambiguous precedence and reconciliation overhead for policy, storage, and execution flows.

## Chosen Approach

Workspace identity is the canonical tenancy boundary. Protected resources must carry workspace ownership metadata and keep resource `workspaceId` aligned with ownership metadata `workspaceId`.

User-private behavior is modeled inside the same tenancy boundary through visibility and sharing policy (`private` and owner-only policy posture), not by bypassing workspace ownership. Cross-workspace interaction must use explicit policy-mediated projection/copy/share behavior and cannot implicitly transfer ownership authority.

Storage provisioning, asset contracts, run execution orchestration, and authorization policy evaluation must all consume workspace-centered ownership semantics as the source of truth.

## Consequences

- Storage: storage instances and access summaries must remain workspace-scoped, including ownership attribution and policy enforcement context.
- Assets: asset/resource contracts must preserve workspace ownership metadata and cannot define alternate top-level tenancy roots.
- Execution: workflow/run execution must resolve input/output resource access through workspace scope and policy, including user-private visibility constraints.
- Policy: authorization and visibility-sharing contracts must evaluate permissions against workspace ownership context before resource-family rules.
- User-private resources: private resources remain first-class but cannot escape workspace tenancy; private means restricted access within workspace-scoped ownership, not separate tenancy authority.
- Tradeoff: cross-workspace collaboration and personal/private convenience flows require explicit policy and projection steps, increasing orchestration rigor but preserving consistency and auditability.

## Review Expectations

- Risk Class: tenancy and isolation semantics (workspace ownership boundaries and cross-workspace access rules).
- Required Reviewers:
  - Platform architecture owner.
  - Tenancy/authorization domain owner.
- Broader Architecture Review Trigger: required before acceptance or supersession if cross-workspace ownership transfer rules, visibility defaults, or isolation guarantees change.
- Recertification Cadence: re-review this ADR every 6 months or when tenancy policy semantics are revised.

## Related Documentation

- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`
- `docs/architecture/workspace-foundation.ai.md`
- `docs/architecture/storage-foundation.ai.md`
- `docs/architecture/storage-access-semantics.ai.md`
- `docs/architecture/shared-asset-contracts.ai.md`
- `docs/architecture/workflow-execution-and-tools.ai.md`
- `docs/architecture/authorization-visibility-sharing-contracts.ai.md`
- `docs/context/packs/architecture-core.pack.ai.md`
- `docs/context/context-map.ai.md`

## Related Code Paths

- `src/shared/workspaces/WorkspaceOwnership.ts`
- `src/shared/contracts/authorization/ResourceVisibilitySharingContracts.ts`
- `src/shared/contracts/assets/ImageAssetAuthorizationContracts.ts`
- `src/domain/storage/StorageDomain.ts`
- `src/application/storage/use-cases/StorageManagementServiceContracts.ts`
- `src/application/workflow-persistence/WorkflowWorkspaceScoping.ts`
- `src/application/runs/use-cases/ProcessQueuedRunDispatchUseCase.ts`

## Follow-Up Actions

- Use this ADR as a review gate for proposals that introduce non-workspace tenancy roots or ownership metadata that diverges from workspace scope.
- Keep architecture references for workspace/storage/assets/execution/policy boundaries linked to this ADR under `## Related ADRs`.
