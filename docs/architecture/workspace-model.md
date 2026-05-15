# Workspace Model

## Scope and phase placement

Phase 6 is **Workspace Foundations**. It establishes persisted workspace records, explicit active-workspace selection, workspace-gated resource surfaces, workspace-owned operation context propagation, and reference-only activation of system-owned packs. It does not implement Phase 7 user-library reuse, asset authoring, override editing, composition authoring, collaboration permissions, pack import/export, marketplace behavior, or automatic legacy migration.

Current roadmap handoff:

- Phase 6: Workspace Foundations.
- Phase 7: User Library and Cross-Workspace Asset Reuse.
- Phase 8: Asset Authoring, Customization, and Override Management.
- Phase 9: Composition Planning and Authoring.
- Phase 10: Execution Binding and Runtime-Orchestrated Systems.
- Phase 11: Pack Import/Export, Sharing, and Distribution.
- Phase 12: Collaboration, Permissions, and Multi-User Workspaces.

## Workspace records and active selection

Workspace records are persisted through workspace repositories/use cases and are selected through host/server workspace transports. Renderer localStorage may not be the source of truth for workspace identity, and clients must not derive workspace ids from display names. Hosts must not create hidden/default workspaces to make workspace-scoped features appear populated.

The active workspace is an explicit user/host selection. Workspace-gated pages should show a workspace-required state when no active workspace exists instead of issuing workspace-owned reads without context or showing legacy/global records.

## Explicit context through every seam

UI gating is not sufficient. Every workspace-owned operation must carry explicit workspace context through contracts, clients, transport envelopes/routes, use cases, application ports, providers, and persistence seams. Missing workspace context must fail safely at normalization/use-case/provider boundaries or return sanitized diagnostics; it must not trigger global fallback.

This applies to implemented workspace-owned resources such as artifacts/uploads, image assets, generated-output descriptors and finalization, dataset/model preparation outputs, model inventory validation/publishing operations, runtime task outputs, and Asset Library resource-backed reads. Workspace A records must not be listed or read as Workspace B records.

## System Foundation activation by reference

`system.foundation@1.0.0` remains system-owned. A workspace may activate it only by storing a workspace system-pack activation reference with pack id/version/provenance/status. Workspace creation and selection must not call the Phase 5 installer, copy pack manifests or definitions into workspace storage, seed packs at startup, create hidden/default workspaces, or auto-migrate legacy global resources.

Asset Library effective views may show System Foundation definitions only when the workspace has the active trusted reference and the definitions retain strict system-default provenance. A bare `sourcePackId` is informational and is not authority to expose system defaults.

## Workspace resource ownership and legacy records

Workspace-owned resource records should carry workspace ownership in their own domain metadata or storage keyspace and should be queried through workspace-aware ports/providers. Until deeper storage layout work exists for a resource family, adapters may use safe metadata/source ownership filtering, but they must not expose raw paths, storage roots, prompts, workflow JSON, provider payloads, or other unsafe diagnostics.

Legacy global records are not silently assigned to a workspace, copied, migrated, or exposed as workspace-owned data. Any future migration/import must be explicit and user-visible.

## Phase 7 reuse boundary

Phase 7 introduces User Library and Cross-Workspace Asset Reuse as explicit reuse relationships only. Workspace isolation remains the default: workspace-local assets and resources stay visible only inside their owning workspace unless a later promote, link, copy, or import workflow creates a durable relationship. Direct workspace-to-workspace reuse begins as independent import/copy into the target workspace, not live linking.

The User Library is a separate user-owned scope, not a workspace and not the system foundation. Phase 7 must not use the User Library to justify missing workspace context, hidden/default workspaces, system foundation mutation, startup seeding, or legacy/global auto-migration.

## Collaboration placeholders

Workspace records may carry passive collaboration/readiness placeholders for future phases, but Phase 6 does not implement invites, memberships, permissions, sync, remote auth, multi-user conflict resolution, or sharing policy. Those behaviors belong to later collaboration and distribution phases.

## UI route boundary

Workspace-required UI routes must be blocked at the app route boundary before the requested page becomes the visible shell state. Page-level workspace gates remain defensive boundaries, but setup, loading, and unavailable-workspace surfaces must be stable and must not flash or mark the pending workspace page active until a valid active workspace is available.
