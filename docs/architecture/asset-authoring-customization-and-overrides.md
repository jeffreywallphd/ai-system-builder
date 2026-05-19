# Asset Authoring, Customization, and Override Management (Phase 8 Baseline)

## Purpose

Phase 8 defines the architecture baseline for **asset authoring**, **safe customization**, and **explicit override management** without weakening Phase 6 workspace isolation or Phase 7 user-library reuse boundaries.

This document is the canonical Phase 8 architecture reference for Prompts 1–9 and Reviews A–C.

## Relationship to earlier phases

- Phase 6 established explicit workspace scoping and isolation.
- Phase 7 established explicit promote/link/copy/import relationships and conservative provenance/effective-source semantics.
- Phase 8 extends these foundations with controlled authoring/customization vocabulary.

Phase 8 depends on finalized Phase 7 closeout status documented in `docs/architecture/user-library-and-cross-workspace-reuse.md` and ADR-0017. If transport/UI composition claims in Phase 7 Review D risk checks regress, Phase 8 implementation prompts must treat those surfaces as prerequisites/deferrals and must not assume they are available. In particular, Prompt 11 closeout explicitly keeps promote/import UI flows unavailable and treats broader effective-source composition surfaces as conservative/minimal; Phase 8 must not imply those unavailable behaviors already exist. 

## Vocabulary

- **Authored asset**: an asset created by a user through explicit authoring workflows, with an owning scope and revision history.
- **Workspace-authored asset**: an authored asset owned by a specific workspace.
- **User-authored asset**: an authored asset owned directly by the User Library scope (deferred unless a later prompt explicitly introduces direct User Library authoring).
- **Customization**: a user-initiated, explicit change to safe editable fields of an existing asset context.
- **Override**: a non-destructive customization layer applied against a base asset reference.
- **Override record**: a durable workspace-scoped record capturing override intent, changed fields, status, and provenance.
- **Customized asset**: the effective asset view produced by applying safe customizations/overrides to a base asset context.
- **Derived asset**: a workspace-owned asset produced from another source (linked, copied, imported, or system-derived) with provenance to that source.
- **Editable draft**: a mutable pre-publication authored/customization revision.
- **Published authored asset**: an immutable published authored revision unless later prompts explicitly introduce controlled amendment.
- **Asset revision**: an explicit revision/version unit for authored assets or override evolution.
- **Base asset**: the source asset that customization/override targets.
- **Customization target**: the specific asset relationship being customized (linked reference, detached copy, imported copy, or system-derived source).
- **Override scope**: where an override is valid (Phase 8 baseline: workspace-local scope).
- **Override status**: lifecycle state of an override (draft, published/active, superseded, conflicted, archived/deprecated as later prompts define).
- **Override provenance**: safe lineage metadata for override origin and transformation context.
- **Detached customization**: customization on a detached workspace-owned copy.
- **Linked customization**: customization applied against a linked reference via workspace-local override behavior.
- **Conflict**: explicit mismatch between base version assumptions and current base state.
- **Resolution**: explicit user-visible action to reconcile a conflict; never silent.
- **Promotable authored asset**: a workspace-authored or customized asset revision eligible for explicit later promotion workflows.
- **Safe editable fields**: explicitly allowlisted, validated, user-facing fields permitted in Phase 8 editing.
- **Non-editable source fields**: protected fields and internals that cannot be modified in Phase 8 baseline.

## Scope definitions

### What asset authoring means

Asset authoring means creating new assets with explicit ownership scope, safe editable fields, revision state, validation diagnostics, and provenance metadata.

### What asset customization means

Asset customization means changing allowlisted safe fields on an existing asset context while preserving ownership boundaries and source immutability constraints.

### What an override means

An override is the explicit non-destructive representation of divergence from a base asset reference. Overrides do not mutate the source record directly.

### Workspace-local authored assets

Workspace-local authored assets are owned by one workspace and require explicit workspace ID at creation/read/edit boundaries.

### Customized assets

A customized asset is an effective result combining a base asset relationship and one or more explicit safe overrides/draft revisions within allowed scope.

### Override records

Override records are durable, explicit, workspace-visible records that capture what changed, against which base version, under which scope/status/provenance.

## Ownership and scope rules

1. Workspace isolation remains default.
2. Workspace-scoped authoring requires explicit workspace ID.
3. User Library remains separate from workspace and system foundation scopes.
4. System-owned assets remain system-owned.
5. `system.foundation@1.0.0` is immutable.
6. Linked user-library customization must never silently mutate user-library source.
7. Detached copy customization edits the workspace-owned copy.
8. Imported workspace asset customization edits target workspace copy only.
9. Customizations must be explicit and user-visible.
10. Override records must be durable and safe.
11. No hidden propagation execution.
12. No live workspace-to-workspace linking.
13. No collaboration permissions/multi-user auth model in Phase 8.
14. No pack import/export or marketplace behavior.
15. No hidden/default workspace behavior.
16. No startup seeding.
17. No legacy/global auto-migration.
18. Public contracts/provenance/diagnostics/UI must never expose raw paths, storage roots, provider payloads, prompt text, workflow JSON, tokens/secrets, stack traces, command lines, environment values, bytes/blobs/base64, or signed URLs.

## Ownership model by source relationship

### Workspace-local authored assets

- Created directly into workspace scope.
- Workspace-owned by default.
- Not visible cross-workspace unless later explicit promote/copy/link/import/export workflows are performed.

### User-library authored assets

- Direct authoring into User Library is **deferred** in Phase 8 baseline unless later prompts explicitly scope it.
- Phase 8 should assume workspace-first authoring and explicit later promotion patterns.

### Customizing linked user-library assets

Phase 8 allows only explicit safe options:

- create a workspace-local override record against the linked relationship; or
- create a detached workspace copy and customize that copy; or
- require explicit user choice between local customization and later controlled source update workflow.

Silent source mutation is forbidden.

### Customizing detached copies

- Detached copies are workspace-owned.
- Customization applies to detached workspace asset.
- Provenance must preserve source lineage.

### Customizing workspace imports

- Imported assets in target workspace are target-owned detached copies.
- Customization applies only to target copy.
- Source workspace record remains unchanged.

### Customizing system-owned assets

- System source remains immutable.
- Any customization must be represented as workspace-local override and/or derived workspace asset.
- No mutation/copy of `system.foundation@1.0.0` ownership semantics.

## Authoring model (architectural shape)

Authored assets should conceptually include:

- authored asset ID;
- workspace ID or owning scope;
- asset kind/type;
- display name;
- summary/description;
- safe editable fields;
- revision/version;
- status/lifecycle;
- provenance;
- created/updated timestamps;
- validation diagnostics;
- safe metadata.

Phase 8 starts with conservative editing scope and does not permit arbitrary mutation of all asset internals.

## Override model (architectural shape)

Override records should conceptually include:

- override ID;
- target workspace ID;
- base asset reference;
- base asset version;
- base source kind;
- override scope;
- editable fields changed;
- override values or safe patch summary;
- status/lifecycle;
- provenance;
- created/updated timestamps;
- actor/request context when available;
- diagnostics/safe metadata.

Override records must **not** contain:

- raw file bytes/blobs/base64;
- raw local paths or storage roots;
- provider payloads;
- prompt text (until explicitly/safely designed in later prompt);
- workflow JSON (until explicitly/safely designed in later prompt);
- tokens/secrets;
- stack traces;
- command lines;
- environment values;
- signed URLs.

## Safe editing scope baseline

### Safe editable fields (initial)

- display name;
- summary/description;
- tags/classification when existing contracts support them;
- explicitly allowlisted user-facing configuration fields;
- safe metadata keys that satisfy sanitization rules.

### Deferred/higher-risk fields

- raw prompt text;
- workflow JSON;
- provider payloads;
- runtime execution settings;
- storage locations;
- binary/resource content;
- credentials/tokens;
- environment variables;
- arbitrary JSON blobs.

These remain deferred pending explicit schemas, validation, diagnostics, and tests.

## Versioning and conflict baseline

1. Draft and published authored revisions are distinct.
2. Revisions/version identifiers are explicit and durable.
3. Editing authored assets creates explicit new drafts/revisions.
4. Editing overrides similarly creates explicit draft/revision transitions.
5. Base-version mismatches must surface explicit conflicts.
6. Pinned links: linked customization stays pinned; base changes surface conflict/available-update status, not silent remap.
7. Explicit-update links: updates require explicit user action; override compatibility/conflict must be surfaced.
8. Detached copies: no automatic source following; conflicts only within local revision history.
9. Workspace imports: target copy remains detached; source changes do not auto-apply.

Conservative defaults:

- published revisions immutable unless later prompt defines controlled amendment;
- conflicts detected/surfaced, never silently resolved;
- no hidden linked override propagation;
- detached/imported copies do not auto-follow source updates.

## Effective-source relationship extension (vocabulary only)

Phase 8 prepares effective-source classifications for future contracts/read-models, including:

- `workspace-authored`;
- `workspace-customized`;
- `user-library-customized`;
- `system-derived-override`;
- `linked-with-workspace-override`;
- `imported-customized`.

Prompt 1 defines vocabulary only; contract implementation is deferred.

## Implemented in Phase 8 vs deferred

### Phase 8 target scope

- Explicit architecture vocabulary for authoring/customization/override.
- Conservative authored/override record conceptual models.
- Application/persistence/use-case/transport/UI implementation delivered incrementally in prompts 2–9 with review gates.

### Deferred beyond this prompt

- Contract and port implementations (Prompt 2/3 onward).
- Persistence adapters/use cases/API/IPC/preload/UI behavior (later prompts).
- Raw prompt/workflow editing, arbitrary internals editing, runtime-execution-linked editing.
- Collaboration permissions/multi-user authorization.
- Pack import/export, marketplace, live workspace-to-workspace linking.

## Phase 8 implementation sequence

1. Prompt 1 — Architecture baseline, ADR, docs, context pack.
2. Prompt 2 — Asset authoring/customization contract vocabulary.
3. Prompt 3 — Application ports and persistence adapters.
4. Review A — Contract, boundary, persistence, and anti-drift review.
5. Prompt 4 — Create/edit workspace-local authored asset use cases.
6. Prompt 5 — Override/customization use cases for linked/copied/imported assets.
7. Prompt 6 — Versioning, conflict, and provenance behavior.
8. Review B — Use-case, provenance, versioning, and workspace isolation review.
9. Prompt 7 — Effective-source/read-model integration for customized/overridden assets.
10. Prompt 8 — API/IPC/preload/server exposure.
11. Prompt 9 — Minimal desktop/thin-client UI.
12. Review C — Final Phase 8 closeout review.
