# System Builder

- Status: current
- Related decisions: `docs/adr/ADR-0005-builder-core-platform-capabilities-and-user-composable-assets.md`, `docs/adr/ADR-0016-asset-kernel-terminology-and-architecture-baseline.md`, `docs/adr/ADR-0020-asset-composition-planning.md`, `docs/adr/ADR-0024-system-builder-area-and-software-status-placement.md`, `docs/adr/ADR-0033-system-builds-releases-security-and-workflows.md`
- Verification: `docs/architecture/architecture-verification.md`

## Purpose

System Builder is the workspace-scoped product area where users construct systems by composing assets and larger asset compositions. It is not an application-health dashboard and must not become a second asset, planning, runtime, or execution architecture.

The repository currently establishes terminology, design-time contracts, navigation ownership, and data-model seams. ADR-0033 accepts revision-safe CRUD, composition editing, deterministic builds, and immutable releases as the target boundary; their support remains increment-gated until implementation evidence passes.

## Canonical concepts

- **Composed system**: a user-buildable `system` or `system-of-subsystems` Asset Kernel composition.
- **System Builder record**: the workspace-owned design-time aggregate used to identify a composed system and track its construction lifecycle.
- **System composition**: an `AssetComposition` specialization containing system roots, asset instances, bindings, rules, dependencies, provenance, and validation summary.
- **Source composition plan**: an optional reference to the non-executing asset composition plan from which a System Builder record is derived.
- **Materialized system definition**: an optional future reference to a versioned system `AssetDefinition`; the initial contract does not materialize or publish one.
- **Software status**: builder-application, host, runtime, installer, and resource diagnostics. This belongs to Settings and is never part of a System Builder record.

## Contract and data-model baseline

`modules/contracts/system-builder` is the family barrel for the initial baseline:

```ts
SystemBuilderRecord {
  systemId
  targetWorkspaceId
  name
  description?
  status
  composition
  sourceCompositionPlanId?
  systemDefinitionRef?
  createdAt
  updatedAt
  archivedAt?
}
```

The composition field narrows the existing Asset Kernel `AssetComposition` to `system` or `system-of-subsystems`. It does not copy its instance, binding, rule, dependency, provenance, lifecycle, or validation vocabularies.

Design-time statuses are `draft`, `in-composition`, `blocked`, `ready-for-validation`, `validated`, and `archived`. These statuses describe construction progress only. They do not mean runtime-ready, execution-ready, healthy, installed, running, stopped, or failed software.

## Ownership and dependency boundaries

- System Builder records are workspace-owned and require explicit workspace identity at every future contract, client, transport, use-case, repository, and persistence seam.
- Asset Kernel definitions, instances, bindings, compositions, and references remain canonical component vocabulary.
- Asset composition planning remains the non-executing compatibility/planning input. A system record may reference a plan but must not mutate the plan or effective asset projections implicitly.
- Runtime readiness, execution plan preparation, and controlled execution remain downstream and separate.
- Software diagnostics must not be persisted into composed-system records or used as their lifecycle status.
- Future application behavior belongs behind focused ports and use cases; UI must not write local files or invent renderer-only system records.

## Product-area placement

**Systems** is a top-level, workspace-required destination. It owns system lists, revision-safe creation/editing, validation, builds, releases, and system-level Run & Test through explicit contracts and use cases. Surfaces must remain truthful while each operation is increment-gated.

General asset composition planning may remain available in Assets / Plans as an input-building workflow. System-specific assembly and system-record management belong in Systems. The two surfaces must share the same contracts rather than fork planning and composition data.

**Settings / Software status** owns:

- desktop host and feature-lifecycle diagnostics;
- Python runtime status and explicit controls;
- ComfyUI install status and repair controls;
- builder-application resource and readiness diagnostics.

Opening Systems must never trigger these operational reads. Opening Settings or Software status must not create, mutate, validate, or execute a composed system.

## Current implementation gaps

- system repository ports and persistence adapters;
- create/read/list/update/archive use cases;
- plan-to-system materialization and validation services;
- API, IPC, preload, and client operations;
- visual or structured system editing;
- system publication/versioning and execution handoff;
- thin-client System Builder parity;
- collaboration, permissions, import/export, marketplace, and deployment synchronization.

The target choices for these boundaries are accepted by ADR-0033, but public support must not be inferred from documents or baseline contracts. Each operation remains unavailable until its implementation and verification are present. See `docs/architecture/system-build-and-release.md`.
