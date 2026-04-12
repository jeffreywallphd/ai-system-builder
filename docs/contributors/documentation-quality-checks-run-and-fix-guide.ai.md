---
title: "AI Companion: Documentation Quality Checks Run and Fix Guide"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - package.json
  - dev/scripts/lint-docs.cjs
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/validate-documentation-registry.cjs
  - dev/scripts/validate-adr-records.cjs
  - dev/scripts/validate-architecture-domains.cjs
  - dev/scripts/validate-docs-segmentation.cjs
  - dev/scripts/validate-docs-cross-references.cjs
  - dev/scripts/validate-docs-category-compliance.cjs
  - docs/context/governance/documentation-quality-standard.ai.md
  - docs/contributors/documentation-quality-enforced-standards-guide.ai.md
  - docs/contributors/documentation-quality-rule-evolution-guide.ai.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md
  - docs/contributors/documentation-quality-worked-examples.ai.md
  - docs/contributors/docs-foundation-validation.ai.md
  - docs/context/templates/README.ai.md
  - dev/tests/DocumentationContributorQualityChecksStory733Guardrails.test.ts
---

# AI Companion: Documentation Quality Checks Run and Fix Guide

## Purpose

Use this guide to run docs quality checks locally, classify failures quickly, and apply the shortest safe remediation path.

## Primary Entrypoint

Run the same docs-quality gate used in CI:

```bash
npm run docs:lint
```

List available checks for scoped debugging:

```bash
npm run docs:lint -- --list-checks
```

Run a single check or a focused subset:

```bash
npm run docs:lint -- --check foundation
npm run docs:lint -- --checks registry,segmentation
```

Promote warning-level findings to blocking only during explicit cleanup campaigns:

```bash
npm run docs:lint -- --strict-important
```

## Fast Triage Loop

1. Run `npm run docs:lint`.
2. Locate the failing `## <check-id>` block.
3. Prioritize by severity (`critical` before `important` before `advisory`).
4. Open the reported `file:` path and repair that contract family.
5. Re-run only the affected check with `--check` or `--checks`.
6. Re-run `npm run docs:lint` once targeted checks pass.

## Failure Categories and First Remediation Moves

### Metadata and Document Shape

Typical signals: `FRONTMATTER_INVALID`, `HEADER_ENUM_INVALID`, `SEED_PAIR_MISMATCH`.

First moves:
- Repair required frontmatter fields and enum values.
- Keep `.md` and `.ai.md` companion metadata aligned.
- Validate against `documentation-metadata-header` and taxonomy contracts.

### Status and Supersession Integrity

Typical signals: `STATUS_SIGNAL_MARKER_MISSING`, `SUPERSESSION_*`, `ACTIVE_PATH_REFERENCE_INVALID`, `NON_ACTIVE_*`.

First moves:
- Restore required status anchors/sections.
- Fix supersession redirect metadata and destination paths.
- Remove active-router references to superseded canonical targets.

### Link and Cross-Reference Integrity

Typical signals: `*_REFERENCE_INVALID`, `*_LINK_MISSING`, `DOC_INTERNAL_LINK_BROKEN`.

First moves:
- Repair markdown links and docs-system JSON path references.
- Reconcile index/registry/router cross-links.
- Re-run `cross-references` and `registry` checks together when touching references.

### Routing, ADR, and Architecture Contract Alignment

Typical signals: `ROUTING_*`, `CONTEXT_*`, `REGISTRY_*`, `ADR_*`, `DOMAIN_*`.

First moves:
- Reconcile IDs, mapped paths, and related-record references.
- Keep ADR registry/index/backlinks consistent.
- Keep architecture domain overview/reference route links intact.

### Category-Compliance and Lifecycle Placement

Typical signals: `CATEGORY_*` and baseline/historical status-authority mismatches.

First moves:
- Keep ADR records in `docs/adr/records`.
- Preserve baseline/historical lifecycle signaling and authority semantics.
- Keep routing references focused on active non-historical records.

### Readability Boundary Signals

Typical signals: `READ-*`, `DOCUMENTATION_QUALITY_STANDARD_INVALID`.

First moves:
- Restore contract-critical heading anchors exactly.
- Keep router/overview docs within measured readability constraints.
- Keep required-vs-recommended policy language explicit.

## Severity Expectations

- `critical`: merge-blocking contract break.
- `important`: non-blocking warning by default; fix now or track follow-up.
- `advisory`: informational guidance.

Default enforcement blocks only on `critical` unless strict escalation is intentionally enabled.

## Canonical References for Fixing

- Quality policy and severity model: `docs/context/governance/documentation-quality-standard.ai.md`
- Contributor standards and rule-group expectations: `docs/contributors/documentation-quality-enforced-standards-guide.ai.md`
- New-rule rollout and enforcement-change policy: `docs/contributors/documentation-quality-rule-evolution-guide.ai.md`
- Ongoing tooling ownership and obsolete-check update workflow: `docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md`
- Validator behavior and stable issue-code catalog: `docs/contributors/docs-foundation-validation.ai.md`
- Authoring templates: `docs/context/templates/README.ai.md`
- Placement and authority routing: `docs/contributors/docs-placement-guide.ai.md`
- Passing/failing repository examples by documentation asset type: `docs/contributors/documentation-quality-worked-examples.ai.md`

## Efficient Multi-Issue Remediation Plan

1. Resolve all `critical` findings first.
2. Group fixes by contract family to avoid churn.
3. Run targeted checks until clean.
4. Run `npm run docs:lint`.
5. Run normal repository verification when code is also modified:
   - `npm test`
   - `npm run validate`
   - `npm run validate:ci`

## Escalation Triggers

Require manual review even with clean lint output when updates change:

- canonical authority meaning,
- supersession chains and redirect targets,
- routing/context-map/registry behavior in high-risk areas,
- identity, authorization, trust, secrets, or runtime startup guidance.
