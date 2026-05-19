# Context Pack: User Library and Cross-Workspace Reuse

- Pack name: `user-library`

## Purpose

- Provide compact Phase 7 routing context for User Library and Cross-Workspace Asset Reuse work.
- Keep promote/link/copy/import/provenance/propagation prompts aligned with canonical architecture and ADR guidance.

## Use When

Include this pack for tasks involving:

- promoting workspace assets to the User Library,
- linking user-library assets into workspaces,
- copying user-library assets into workspaces,
- importing assets from another workspace,
- cross-workspace reuse relationships,
- provenance for reusable assets,
- propagation policy or pinned/explicit-update semantics,
- effective asset source or effective resolution summary behavior,
- preventing accidental propagation or hidden sharing.

## Canonical Docs to Inspect

- `docs/architecture/user-library-and-cross-workspace-reuse.md`
- `docs/adr/ADR-0017-user-library-and-cross-workspace-reuse.md`
- `docs/architecture/workspace-model.md`
- `docs/architecture/asset-kernel.md`
- `docs/architecture/persistence-and-storage.md` when persistence/storage ownership is involved
- `docs/architecture/module-dependency-rules.md` when adding contracts, ports, adapters, transports, or UI seams

## Core Phase 7 Constraints

- Workspace isolation remains the default; workspace-owned data crosses workspace boundaries only through explicit reuse workflows.
- Missing workspace context must fail safely or remain gated for workspace-scoped operations; UI gating alone is not enforcement.
- The User Library is user-owned, not a workspace, not a hidden/default workspace, and not the system foundation.
- Promotion is explicit and must preserve safe provenance.
- Linking is a reference relationship with explicit propagation policy; hidden latest-following behavior is not the default.
- Copying user-library assets into a workspace is detached by default.
- Workspace-to-workspace reuse starts as import/copy into the target workspace, not live linking.
- `system.foundation@1.0.0` remains system-owned and reference-activated only.
- Legacy/global resources are not auto-migrated into workspaces or the User Library.

## Anti-Drift Rules

- Do not claim user-library behavior already exists before the relevant prompt implements it.
- Do not replace `AssetDefinition`, `AssetInstance`, `AssetReference`, `AssetComposition`, resource-backed views, or system foundation packs.
- Do not introduce hidden/default workspaces, startup seeding, system foundation mutation, or Phase 5 installer calls.
- Do not use route/renderer gating as the only workspace boundary.
- Do not add direct live Workspace A to Workspace B links unless a later ADR explicitly accepts that model.
- Do not expose raw resource bytes/content, paths, provider payloads, prompts, secrets, commands, environment values, or stack traces in provenance/effective summaries.

## Non-Goals

This pack does not authorize broad asset authoring, arbitrary asset editing, override editing, visual composition, canvas/wizard authoring, workflow execution, runtime task execution expansion, provider/network expansion, pack import/export, marketplace/package registry behavior, collaboration permissions, invites, sync, remote auth, organization libraries, automatic legacy migration, hidden default workspaces, system foundation mutation, startup seeding, or raw resource byte/content reads.

## Later Prompt Ownership

- Prompt 2 owns user-library contract vocabulary.
- Prompt 3 owns application ports and persistence adapters.
- Prompts 4-7 own promote, link, copy, and workspace import use cases.
- Prompt 8 owns effective asset resolution integration.
- Prompt 9 owns API/IPC/preload/server transport exposure.
- Prompt 10 owns minimal desktop/thin-client UI.
- Prompt 11 owns final docs, tests, and Phase 8 handoff.

### Phase 7 Prompt 9 transport exposure

Phase 7 user-library operations are now exposed at narrow API, Electron IPC, and desktop preload boundaries for future UI work. Transport requests keep workspace context explicit (`sourceWorkspaceId`, `targetWorkspaceId`, or `workspaceId` depending on operation) and missing workspace context fails at the boundary with sanitized validation responses. The exposed operations are promote, link, detached copy, workspace-to-workspace import, user-library asset reads, workspace user-library link reads, and effective asset source summary reads where the workspace asset read facade provides them.

This transport exposure does not add desktop or thin-client UI, propagation execution, live workspace-to-workspace linking, broad authoring, override editing, pack import/export, marketplace behavior, or Phase 8/9 behavior.


## Transport/UI status (Phase 7 final)

- API routes, Electron IPC handlers, and desktop preload methods expose promote/link/copy/import + user-library/effective-source reads with explicit workspace IDs where required.
- Desktop renderer and thin-client UIs provide minimal safe User Library actions and status display for Phase 7 reuse workflows only.
- Missing workspace context must fail safely at transport/UI boundaries; UI gating alone is not treated as authoritative enforcement.

## Deferrals and Phase 8 boundary guidance

Still deferred after Phase 7 closeout:

- broad authoring/customization/override editing,
- live workspace-to-workspace links,
- hidden propagation execution/scheduling,
- collaboration/permissions/invites/sync/remote auth,
- pack import/export and marketplace behavior.

Phase 8 should add **Asset Authoring, Customization, and Override Management** on top of explicit Phase 7 relationships, while preserving: workspace isolation default, explicit promotion, link vs copy distinction, detached import/copy defaults, system-owned foundation immutability, and no hidden/default workspaces.


## Phase 7 implementation status (Prompt 11 cleanup, 2026-05-19)
- Implemented in minimal desktop/thin-client UI: list saved reusable assets, list workspace links, list effective asset sources, and explicit link/copy actions with conservative pinned-version defaults.
- Deferred/unavailable in minimal UI: promote and import action flows, advanced editing, propagation execution, live workspace-to-workspace links, collaboration, pack import/export, marketplace, hidden/default workspaces, startup seeding, and legacy/global auto-migration.
- Transport and preload exposure may include promote/import operations, but minimal UI intentionally does not present them as available actions in this phase cleanup.
- Documentation and tests must stay aligned with implemented behavior; do not claim unsupported actions as complete.
