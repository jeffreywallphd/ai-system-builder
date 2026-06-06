# Context Pack: Asset Authoring, Customization, and Overrides

- Pack name: `asset-authoring`

## Purpose

Provide minimum-sufficient routing context for asset authoring, customization, override records, revisions/conflicts, and ownership-safe editing workflows.

## Use When

Include this pack when prompts materially involve:

- authoring workspace-local assets,
- editable drafts/published authored revisions,
- customized assets and override records,
- linked/customized vs detached/customized behavior,
- customization of imported workspace copies,
- conservative safe editable field policy,
- authored/customized promotion readiness,
- revision/conflict vocabulary and resolution semantics.

## Canonical docs to inspect

- `docs/architecture/asset-authoring-customization-and-overrides.md`
- `docs/adr/ADR-0018-asset-authoring-customization-and-overrides.md`
- `docs/architecture/workspace-model.md`
- `docs/architecture/user-library-and-cross-workspace-reuse.md`
- `docs/adr/ADR-0017-user-library-and-cross-workspace-reuse.md`
- `docs/architecture/asset-kernel.md`

## Core constraints

- Workspace isolation remains default; explicit workspace context is mandatory for workspace-owned operations.
- User Library scope is separate from workspace and system foundation scopes.
- `system.foundation@1.0.0` remains immutable/system-owned.
- Linked user-library customization must not silently mutate source user-library assets.
- Detached/imported copies are customized in target workspace only.
- Customizations/overrides are explicit, user-visible, durable, and safe.
- No hidden propagation, live workspace-to-workspace links, collaboration permissions, pack import/export, marketplace behavior, hidden/default workspaces, startup seeding, or legacy/global auto-migration.
- No raw paths/storage roots/provider payloads/prompt text/workflow JSON/tokens/secrets/stack traces/command lines/environment values/bytes/blobs/base64/signed URLs in public contracts, diagnostics, provenance, or UI.

## Anti-drift rules

- Do not introduce authoring assumptions that depend on unavailable User Library UI/composition behavior.
- Keep safe editable fields allowlisted and conservative.
- Treat prompt/workflow/provider/runtime/storage internals as deferred until explicitly scoped with safe schema/tests.
- Keep override behavior non-destructive and explicit.

## Relationship to User Library Reuse

When tasks combine reuse relationships (promote/link/copy/import/effective-source) with customization/overrides, include both:

- `docs/context/packs/user-library.pack.md`
- `docs/context/packs/asset-authoring.pack.md`

User Library reuse constraints remain binding prerequisites.

## Non-goals

This pack does not authorize implementation of collaboration permissions, live cross-workspace linking, pack import/export, marketplace behavior, broad arbitrary editor behavior, runtime execution features, or hidden/global migration behavior.

## Current Truthfulness Notes

Use conservative wording in prompts and reviews:

- treat effective-summary listing as partial/deferred unless the current backend confirms availability;
- treat create-override flows as available only when safe target selection/validation and a real customization-target reader are composed; otherwise present them as unavailable/unsupported;
- treat draft publication as creating new authored assets only;
- do not claim workflow execution, materialized outputs, rebase/conflict-resolution flows, source mutation, or `system.foundation` mutation.
