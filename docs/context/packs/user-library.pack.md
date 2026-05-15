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
