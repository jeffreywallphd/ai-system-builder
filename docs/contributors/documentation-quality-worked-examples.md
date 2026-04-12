---
title: Documentation Quality Worked Examples
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/governance/documentation-quality-standard.md
  - docs/contributors/documentation-quality-enforced-standards-guide.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.md
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/documentation-registry.seed.json
  - docs/context/packs/context-pack-catalog.seed.json
  - docs/adr/records/adr-registry.json
  - docs/baselines/README.md
  - dev/tests/DocumentationQualityWorkedExamplesStory734Guardrails.test.ts
---

# Documentation Quality Worked Examples

## Purpose

Show concise passing and failing patterns for common AI Loom documentation asset types so contributors can apply enforced quality rules correctly during onboarding and routine maintenance.

## How to Use This Guide

For each category below:
1. Compare your change against the passing pattern.
2. If it looks closer to the failing pattern, apply the listed fix move before review.
3. Re-run `npm run docs:lint` (or the targeted check) and confirm failures are resolved.

## Worked Examples

### Example 1: Architecture Domain Overview/Reference Docs

Passing pattern:
- Domain docs keep clear role separation (`overview.md` for boundaries, `references/*.md` for detailed contracts).
- `## Related ADRs` links resolve to valid ADR record paths.
- Active docs keep metadata aligned (`status: active`, valid authority level).

Failing pattern:
- A single architecture doc mixes overview, deep implementation detail, and migration-history narrative in one file.
- `## Related ADRs` links point to missing ADR files or stale filenames.

Likely validator signals:
- `DOMAIN_*`
- `ARCHITECTURE_RELATED_ADR_INVALID`
- `DOC_INTERNAL_LINK_BROKEN`

Fix move:
- Split mixed content back into overview/reference docs and repair ADR/backlink paths.

### Example 2: ADR Records and ADR Registry Alignment

Passing pattern:
- ADR file lives under `docs/adr/records/` with companion `.ai.md`.
- ADR metadata and status are valid and ADR links are bi-directional with related architecture docs.
- `docs/adr/records/adr-registry.json` entry stays aligned with human and AI ADR paths.

Failing pattern:
- Decision note is added in a contributor doc instead of a formal ADR record.
- ADR file exists but `adr-registry.json` or related cross-links were not updated.

Likely validator signals:
- `ADR_*`
- `*_REFERENCE_INVALID`
- `DOC_INTERNAL_LINK_BROKEN`

Fix move:
- Move the decision into a proper ADR record and synchronize ADR registry + related links in the same PR.

### Example 3: Context Packs and Pack Catalog Assets

Passing pattern:
- Context pack metadata remains valid and pack paths resolve.
- `context-pack-catalog.seed.json` keeps `primaryDocPath`, `relatedDocPaths`, and `relatedDocRecordIds` aligned for indexed docs.
- Pack scope stays concise and task-oriented.

Failing pattern:
- New indexed docs are added to a pack in `relatedDocPaths` but `relatedDocRecordIds` is not updated.
- Pack content expands into broad mixed authority/history guidance instead of focused context assembly.

Likely validator signals:
- `CONTEXT_*`
- `REGISTRY_*`
- `ROUTING_RELATED_RECORD_MISSING`

Fix move:
- Realign pack catalog record IDs with indexed doc paths and trim pack scope to reusable task context.

### Example 4: Routing Assets (`task-to-context-routing.seed.json`)

Passing pattern:
- Routing `mappings` and `routingExamples` include coherent `relatedDocPaths` and matching `relatedDocRecordIds`.
- Documentation-change routes reference active canonical docs, not superseded/historical authority.

Failing pattern:
- Route includes an indexed documentation path but omits the matching stable record ID.
- Documentation-change route points contributors to baseline or superseded canonical targets as primary authority.

Likely validator signals:
- `ROUTING_*`
- `ROUTING_RELATED_RECORD_MISSING`
- `CATEGORY_*`

Fix move:
- Add missing `relatedDocRecordIds`, then replace non-active routing targets with active canonical equivalents.

### Example 5: Documentation Registry Entries

Passing pattern:
- New contributor guide is represented by one stable `recordId` in `documentation-registry.seed.json`.
- Entry fields (`path`, `aiPath`, `docType`, `domain`, `status`, `authoritativeness`, `summary`) are valid.
- Discovery indexes (`byDocType`, `byStatus`, `byDomain`, `byAuthoritativeness`, and relevant `byTaskCategory`) include the new record.

Failing pattern:
- New guide exists on disk but registry entry is missing or partially filled.
- `relatedDocs` links point to indexed docs but matching `relatedRecordIds` were not added.

Likely validator signals:
- `REGISTRY_ENTRY_INVALID`
- `REGISTRY_REFERENCE_INVALID`
- `REGISTRY_CROSS_REFERENCE_INVALID`

Fix move:
- Add/repair the registry entry and update discovery indexes plus stable relationship IDs in one change set.

### Example 6: Baseline/Historical Documentation Boundaries

Passing pattern:
- Baseline and historical docs stay evidence-oriented (`authoritativeness: historical`) and clearly separated from active implementation authority.
- Contributor and routing docs treat baseline assets as optional historical context, not default source-of-truth.

Failing pattern:
- Active contributor guidance cites baseline snapshots as current implementation instructions.
- Superseded or archived records are routed as primary authority in active workflows.

Likely validator signals:
- `NON_ACTIVE_*`
- `ACTIVE_PATH_REFERENCE_INVALID`
- `CATEGORY_*`

Fix move:
- Restore active-canonical routing, keep historical docs for traceability only, and maintain supersession links.

## Quick Review Checklist

- Does each changed docs asset keep valid metadata and lifecycle signals?
- Are routing and pack assets aligned to stable `relatedDocRecordIds` where indexed docs are referenced?
- Are ADR and architecture cross-links still resolvable both ways?
- Are baseline/historical docs treated as evidence-only unless the task explicitly targets history?

## Related Documentation

- `docs/context/governance/documentation-quality-standard.md`
- `docs/contributors/documentation-quality-enforced-standards-guide.md`
- `docs/contributors/documentation-quality-checks-run-and-fix-guide.md`
- `docs/contributors/docs-foundation-validation.md`
- `docs/contributors/active-vs-historical-docs-worked-examples.md`
