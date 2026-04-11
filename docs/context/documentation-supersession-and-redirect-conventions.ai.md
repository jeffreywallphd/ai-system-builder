---
title: "AI Companion: Documentation Supersession and Redirect Conventions"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs
  - docs/architecture
  - docs/contributors
  - docs/operations
  - docs/baselines
  - dev/tests/DocumentationSupersessionRedirectConventionsGuardrails.test.ts
---

# AI Companion: Documentation Supersession and Redirect Conventions (Story 5.1.4)

Use this contract when retiring, moving, or splitting docs so stale paths never compete with current authority.

## Required Supersession Signals

Use these four signals consistently:

1. Supersession note.
2. Redirect language.
3. Pointer file at old path (when continuity is required).
4. Deprecation marker for legacy-valid but non-current docs.

## Component Selection Rules

- Full single replacement: `status: superseded` + `superseded_by`.
- Multi-doc split replacement: `status: superseded` + explicit destination list in body.
- Legacy-only continued validity: `status: deprecated` + scope limit.
- Link continuity needed: retain short pointer file at old path.

## Required Content for Superseded or Deprecated Paths

Every retired path must include:

- Non-authoritative statement for current implementation.
- Canonical replacement destination link(s).
- Effective date (`YYYY-MM-DD`).
- One-sentence retirement reason.
- Removal trigger (for pointer retirement).

## Lightweight Stub Pattern

Required headings:

- `## Supersession Notice`
- `## Redirect`

Expected content:

- "This document is superseded and no longer authoritative for current behavior."
- Canonical destination path(s).
- Retention note for inbound-link stability.

## Area-Specific Application

- Architecture docs: route retired content to domain references or ADR lineage; keep old path as stub.
- Contributor guidance: keep old workflow paths as short redirect stubs only.
- Operational notes: deprecate for legacy-only use; supersede when fully replaced.
- Baselines/historical artifacts: keep historical authority signals; use pointer only for moved index continuity.

## Migration Sequence

1. Publish canonical destination first.
2. Convert source to superseded/deprecated stub.
3. Update routers and inbound links in the same change.
4. Preserve history in `docs/baselines/...` or ADR records.
5. Remove pointer after retention trigger is satisfied.

## Related Guidance

- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`
- `docs/contributors/docs-placement-guide.ai.md`
- `docs/contributors/docs-migration-safety-guide.ai.md`
- `docs/architecture/architecture-supersession-and-retirement-governance.ai.md`
