---
title: "AI Companion: Documentation Quality Worked Examples"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/governance/documentation-quality-standard.ai.md
  - docs/contributors/documentation-quality-enforced-standards-guide.ai.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/documentation-registry.seed.json
  - docs/context/packs/context-pack-catalog.seed.json
  - docs/adr/records/adr-registry.json
  - docs/baselines/README.ai.md
  - dev/tests/DocumentationQualityWorkedExamplesStory734Guardrails.test.ts
---

# AI Companion: Documentation Quality Worked Examples

## Purpose

Provide concise passing/failing patterns for common AI Loom documentation asset types so assistants and contributors can satisfy enforced quality rules during onboarding and day-to-day maintenance.

## Usage Pattern

For each category:
1. Compare your change with the passing pattern.
2. If it matches the failing pattern, apply the fix move before review.
3. Re-run `npm run docs:lint` (or targeted checks) and verify clean output.

## Worked Examples

### Example 1: Architecture Domain Overview/Reference Docs

Passing pattern:
- `overview.md` remains boundary-focused and `references/*.md` carries detailed contracts.
- `## Related ADRs` links resolve to valid ADR record paths.
- Active metadata stays valid (`status: active`, aligned authority).

Failing pattern:
- One architecture document mixes boundary overview, implementation detail, and migration history.
- `## Related ADRs` points at missing or stale ADR paths.

Likely validator signals:
- `DOMAIN_*`
- `ARCHITECTURE_RELATED_ADR_INVALID`
- `DOC_INTERNAL_LINK_BROKEN`

Fix move:
- Re-separate overview/reference content and repair ADR cross-links.

### Example 2: ADR Records and ADR Registry Alignment

Passing pattern:
- ADR record is under `docs/adr/records/` with `.md` + `.ai.md` pair.
- ADR metadata/status is valid and related documentation links are reciprocal.
- `docs/adr/records/adr-registry.json` remains aligned with ADR paths.

Failing pattern:
- Architectural decision is documented in contributor guidance instead of an ADR record.
- ADR file exists but ADR registry/backlinks were not updated.

Likely validator signals:
- `ADR_*`
- `*_REFERENCE_INVALID`
- `DOC_INTERNAL_LINK_BROKEN`

Fix move:
- Move decision content into ADR format and synchronize ADR registry + backlinks in the same PR.

### Example 3: Context Packs and Pack Catalog Assets

Passing pattern:
- Pack metadata and paths are valid.
- `context-pack-catalog.seed.json` keeps `primaryDocPath`, `relatedDocPaths`, and `relatedDocRecordIds` aligned for indexed docs.
- Pack scope stays compact and task-specific.

Failing pattern:
- Indexed doc path is added to pack relationships but stable `relatedDocRecordIds` is not updated.
- Pack includes broad mixed authority/history narrative instead of reusable context assembly guidance.

Likely validator signals:
- `CONTEXT_*`
- `REGISTRY_*`
- `ROUTING_RELATED_RECORD_MISSING`

Fix move:
- Align record IDs to indexed doc paths and trim pack scope to reusable task context.

### Example 4: Routing Assets (`task-to-context-routing.seed.json`)

Passing pattern:
- `mappings` and `routingExamples` keep coherent `relatedDocPaths` plus matching `relatedDocRecordIds`.
- Documentation-change routes point to active canonical docs.

Failing pattern:
- Route references an indexed doc path but omits matching stable record ID.
- Route uses baseline/superseded docs as active implementation authority.

Likely validator signals:
- `ROUTING_*`
- `ROUTING_RELATED_RECORD_MISSING`
- `CATEGORY_*`

Fix move:
- Add missing `relatedDocRecordIds` and replace non-active authority targets.

### Example 5: Documentation Registry Entries

Passing pattern:
- New contributor guide has one stable `recordId` in `documentation-registry.seed.json`.
- Required metadata fields are complete and valid.
- Discovery indexes include the record (`byDocType`, `byStatus`, `byDomain`, `byAuthoritativeness`, and relevant `byTaskCategory`).

Failing pattern:
- Guide exists but registry record is missing or incomplete.
- `relatedDocs` points to indexed docs without matching `relatedRecordIds`.

Likely validator signals:
- `REGISTRY_ENTRY_INVALID`
- `REGISTRY_REFERENCE_INVALID`
- `REGISTRY_CROSS_REFERENCE_INVALID`

Fix move:
- Add/repair registry entry and related index/relationship updates in one change set.

### Example 6: Baseline/Historical Documentation Boundaries

Passing pattern:
- Baseline/historical docs remain evidence-oriented (`authoritativeness: historical`) and separate from active authority.
- Contributor/routing guidance uses baselines only when historical evidence is explicitly needed.

Failing pattern:
- Active contributor workflow points to baseline snapshots as current instructions.
- Superseded or archived docs are routed as primary authority for active tasks.

Likely validator signals:
- `NON_ACTIVE_*`
- `ACTIVE_PATH_REFERENCE_INVALID`
- `CATEGORY_*`

Fix move:
- Restore active-canonical routing and retain historical docs for traceability only.

## Quick Review Checklist

- Metadata and lifecycle signals stay valid for changed assets.
- Routing/pack references include stable `relatedDocRecordIds` for indexed docs.
- ADR and architecture links remain bi-directional and resolvable.
- Baseline/historical docs remain non-authoritative unless history is the explicit task target.

## Related Documentation

- `docs/context/governance/documentation-quality-standard.ai.md`
- `docs/contributors/documentation-quality-enforced-standards-guide.ai.md`
- `docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md`
- `docs/contributors/docs-foundation-validation.ai.md`
- `docs/contributors/active-vs-historical-docs-worked-examples.ai.md`
