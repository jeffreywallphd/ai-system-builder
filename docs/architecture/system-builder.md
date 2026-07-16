# System Builder

- Status: current
- Related decisions: `docs/adr/ADR-0005-builder-core-platform-capabilities-and-user-composable-assets.md`, `docs/adr/ADR-0016-asset-kernel-terminology-and-architecture-baseline.md`, `docs/adr/ADR-0020-asset-composition-planning.md`, `docs/adr/ADR-0024-system-builder-area-and-software-status-placement.md`
- Verification: `docs/architecture/architecture-verification.md`

## Purpose

System Builder is the workspace-scoped product area where users construct systems by composing assets and larger asset compositions. It is not an application-health dashboard and must not become a second asset, planning, runtime, or execution architecture.

The current increment establishes terminology, design-time contracts, navigation ownership, and future data-model seams. It does not claim that system authoring or persistence is complete.

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

**Systems** is a top-level, workspace-required desktop destination. The initial page is a truthful preparation shell describing the composition model and deferred capabilities. Future System Builder workflows may add system lists, creation, editing, validation, and plan-to-system materialization through explicit contracts and use cases.

General asset composition planning may remain available in Assets / Plans as an input-building workflow. System-specific assembly and system-record management belong in Systems. The two surfaces must share the same contracts rather than fork planning and composition data.

**Settings / Software status** owns:

- desktop host and feature-lifecycle diagnostics;
- Python runtime status and explicit controls;
- ComfyUI install status and repair controls;
- builder-application resource and readiness diagnostics.

Opening Systems must never trigger these operational reads. Opening Settings or Software status must not create, mutate, validate, or execute a composed system.

## Deferred implementation

- system repository ports and persistence adapters;
- create/read/list/update/archive use cases;
- plan-to-system materialization and validation services;
- API, IPC, preload, and client operations;
- visual or structured system editing;
- system publication/versioning and execution handoff;
- thin-client System Builder parity;
- collaboration, permissions, import/export, marketplace, and deployment synchronization.

Each deferred boundary requires its own scoped implementation and verification. Public support must not be inferred from the presence of the baseline contracts or page shell.
