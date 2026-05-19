# Context Pack: Asset Authoring, Customization, and Overrides (Phase 8)

- Pack name: `asset-authoring`

## Purpose

Provide minimum-sufficient routing context for Phase 8 asset authoring, customization, override records, revisions/conflicts, and ownership-safe editing workflows.

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

- Do not introduce Phase 8 assumptions that depend on unavailable Phase 7 UI/composition behavior.
- Keep safe editable fields allowlisted and conservative.
- Treat prompt/workflow/provider/runtime/storage internals as deferred until explicitly scoped with safe schema/tests.
- Keep override behavior non-destructive and explicit.

## Relationship to Phase 7

When tasks combine reuse relationships (promote/link/copy/import/effective-source) with customization/overrides, include both:

- `docs/context/packs/user-library.pack.md`
- `docs/context/packs/asset-authoring.pack.md`

Phase 7 closeout constraints remain binding prerequisites.

## Phase 8 prompt ownership sequence

1. Prompt 1 — architecture baseline, ADR, docs, context pack.
2. Prompt 2 — contract vocabulary.
3. Prompt 3 — application ports + persistence adapters.
4. Review A — contracts/boundaries/persistence/anti-drift.
5. Prompt 4 — create/edit workspace-authored asset use cases.
6. Prompt 5 — override/customization use cases for linked/copied/imported assets.
7. Prompt 6 — versioning/conflict/provenance behavior.
8. Review B — use-case/provenance/versioning/workspace-isolation.
9. Prompt 7 — effective-source/read-model integration.
10. Prompt 8 — API/IPC/preload/server exposure.
11. Prompt 9 — minimal desktop/thin-client UI.
12. Review C — final Phase 8 closeout.

## Non-goals

This pack does not authorize implementation of collaboration permissions, live cross-workspace linking, pack import/export, marketplace behavior, broad arbitrary editor behavior, runtime execution features, or hidden/global migration behavior.
