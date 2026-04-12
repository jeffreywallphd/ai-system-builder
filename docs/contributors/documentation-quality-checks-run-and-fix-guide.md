---
title: Documentation Quality Checks Run and Fix Guide
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
  - docs/context/governance/documentation-quality-standard.md
  - docs/contributors/documentation-quality-enforced-standards-guide.md
  - docs/contributors/documentation-quality-worked-examples.md
  - docs/contributors/docs-foundation-validation.md
  - docs/context/templates/README.md
  - dev/tests/DocumentationContributorQualityChecksStory733Guardrails.test.ts
---

# Documentation Quality Checks Run and Fix Guide

## Purpose

Use this guide to run docs quality checks locally, interpret failures quickly, and apply the fastest safe fix path.

## Start With the Main Lint Entrypoint

Run the full docs-quality gate exactly as CI does:

```bash
npm run docs:lint
```

Discover available targeted checks:

```bash
npm run docs:lint -- --list-checks
```

Run only the check family you are actively fixing:

```bash
npm run docs:lint -- --check foundation
npm run docs:lint -- --checks registry,segmentation
```

Escalate warning-level quality findings during focused cleanup windows:

```bash
npm run docs:lint -- --strict-important
```

## Fast Local Workflow

1. Run `npm run docs:lint`.
2. Read the failing check block (`## <check-id>`) and issue list.
3. Open the `file:` path reported for the highest-severity issue.
4. Fix one issue family at a time.
5. Re-run only the relevant check with `--check` or `--checks`.
6. Re-run `npm run docs:lint` before asking for review.

## Failure Categories and First Fix Moves

### 1) Metadata and Document Shape

Common signals: `FRONTMATTER_INVALID`, `HEADER_ENUM_INVALID`, `SEED_PAIR_MISMATCH`.

First fix moves:
- Repair required frontmatter fields and enum values.
- Keep `.md` and `.ai.md` companion metadata aligned.
- Validate against `docs/context/documentation-metadata-header.md` and taxonomy rules.

### 2) Status and Supersession Integrity

Common signals: `STATUS_SIGNAL_MARKER_MISSING`, `SUPERSESSION_*`, `ACTIVE_PATH_REFERENCE_INVALID`, `NON_ACTIVE_*`.

First fix moves:
- Restore required status sections and markers.
- Repair `superseded_by` targets and redirect links.
- Remove active-router links to superseded destinations.

### 3) Cross-Reference and Link Integrity

Common signals: `*_REFERENCE_INVALID`, `*_LINK_MISSING`, `DOC_INTERNAL_LINK_BROKEN`.

First fix moves:
- Repair broken markdown links and JSON path references.
- Keep registry/index/router cross-links synchronized.
- Re-run `cross-references` and `registry` checks together when in doubt.

### 4) Routing, ADR, and Architecture Contract Alignment

Common signals: `ROUTING_*`, `CONTEXT_*`, `REGISTRY_*`, `ADR_*`, `DOMAIN_*`.

First fix moves:
- Reconcile IDs, paths, and related-record mappings.
- Ensure ADR registry/index/backlinks stay consistent.
- Ensure architecture domain overview/reference links remain intact.

### 5) Category-Compliance and Lifecycle Placement

Common signals: `CATEGORY_*`, baseline/historical status-authority mismatch findings.

First fix moves:
- Keep ADR records under `docs/adr/records`.
- Keep baseline/historical docs status and authority semantics intact.
- Keep routing references focused on active non-historical records.

### 6) Readability Boundary and Guardrail Signals

Common signals: `READ-*`, `DOCUMENTATION_QUALITY_STANDARD_INVALID`.

First fix moves:
- Restore required contract-critical headings/anchors.
- Keep router/overview structure within measured limits.
- Preserve explicit required-vs-recommended policy language.

## Severity Triage Rules

- `critical`: blocking. Fix before merge.
- `important`: non-blocking by default; fix now when practical or track follow-up.
- `advisory`: informational guidance.

Default policy blocks on `critical` only. Use `--strict-important` only for scoped cleanup campaigns.

## Where to Find Standards, Contracts, and Templates

- Enforcement policy and severity model: `docs/context/governance/documentation-quality-standard.md`
- Contributor standards checklist and failure taxonomy: `docs/contributors/documentation-quality-enforced-standards-guide.md`
- Validator behavior and stable code list: `docs/contributors/docs-foundation-validation.md`
- Templates for new docs and paired assets: `docs/context/templates/README.md`
- Placement and authority boundaries: `docs/contributors/docs-placement-guide.md`
- Passing/failing repository examples by documentation asset type: `docs/contributors/documentation-quality-worked-examples.md`

## Efficient Fix Strategy for Multi-Issue Runs

1. Fix `critical` issues first, top-to-bottom by failing check.
2. Batch related edits in one doc family (for example routing + registry references).
3. Re-run only targeted checks until clean.
4. Run full `npm run docs:lint`.
5. Run normal repo gates when code also changed:
   - `npm test`
   - `npm run validate`
   - `npm run validate:ci`

## When to Escalate to Manual Review

Escalate even after lint passes when changes affect:

- authority meaning or decision semantics,
- supersession chains and redirect behavior,
- routing/context-map/registry mappings in high-risk areas,
- identity, authorization, trust, secrets, or runtime startup guidance.
