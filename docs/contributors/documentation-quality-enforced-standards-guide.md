---
title: Documentation Quality Enforced Standards Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - package.json
  - docs/context/governance/documentation-quality-standard.md
  - docs/contributors/docs-foundation-validation.md
  - docs/contributors/docs-placement-guide.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.md
  - docs/contributors/documentation-quality-worked-examples.md
  - docs/contributors/router-overview-writing-standard.md
  - docs/context/templates/README.md
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/lint-docs.cjs
  - dev/scripts/validate-documentation-registry.cjs
  - dev/scripts/validate-adr-records.cjs
  - dev/scripts/validate-architecture-domains.cjs
  - dev/scripts/validate-docs-segmentation.cjs
  - dev/scripts/validate-docs-cross-references.cjs
  - dev/scripts/validate-docs-category-compliance.cjs
  - dev/tests/DocsLintEntrypointScript.test.ts
  - dev/tests/DocsCategoryComplianceValidationScript.test.ts
  - dev/tests/DocumentationQualityContributorStandardsStory716Guardrails.test.ts
  - dev/tests/DocumentationWorkflowIntegrationStory731Guardrails.test.ts
  - dev/tests/DocumentationCiFailurePolicyStory732Guardrails.test.ts
---

# Documentation Quality Enforced Standards Guide

## Purpose

Translate enforced documentation quality rules into a practical pre-PR checklist so contributors can avoid avoidable lint and validation failures.

## Canonical Standard and Scope

- Source of truth: `docs/context/governance/documentation-quality-standard.md`.
- This guide explains how to satisfy enforced rules before running validators.
- Rule groups covered:
  - Group 1: Structure and metadata integrity.
  - Group 2: Status and authority clarity.
  - Group 3: Authoritativeness and routing discipline.
  - Group 4: Cross-link and reference hygiene.
  - Group 5: Readability boundaries for enforced artifacts.

## Contributor Workflow (Do This Before Validation)

1. Confirm placement and document role.
   - Use `docs/contributors/docs-placement-guide.md`.
   - Verify `doc_type`, ownership, and authority expectations for the path.
2. Start from metadata and status.
   - Keep required frontmatter fields valid.
   - Ensure `status` and `authoritativeness` match document intent.
3. Validate references while editing.
   - Check local markdown links and JSON path references resolve.
   - Avoid linking active routers to superseded canonical paths.
4. Keep contract-critical headings intact.
   - Do not rename required headings in governance, routing, pack, or validation-contract docs without matching validator/test updates.
5. Run docs checks before review.

```bash
npm run docs:lint
```

Run individual validators when you need targeted debugging:

```bash
npm run docs:validate:foundation
npm run docs:validate:registry
npm run docs:validate:adr
npm run docs:validate:architecture-domains
npm run docs:validate:segmentation
npm run docs:validate:cross-references
npm run docs:validate:category-compliance
```

Integrated repository workflow entry points:

```bash
npm test
npm run test:unit
npm run validate
npm run validate:ci
```

## Rule Categories: What To Do

### Structure and Metadata (Rule Group 1)

- Use required frontmatter fields from `docs/context/documentation-metadata-header.md`.
- Keep `.md` and `.ai.md` companion pairs metadata-aligned when pairing is required.
- Use taxonomy values from `docs/context/documentation-taxonomy.md`.

### Status and Authority (Rule Group 2)

- For superseded docs, keep `superseded_by` and redirect targets valid.
- For non-active registry docs (`archived`, `superseded`, `deprecated`), keep required metadata fields, taxonomy enums, and required status/supersession sections present.
- Keep status markers and supersession conventions aligned with:
  - `docs/context/documentation-status-signals.md`
  - `docs/context/documentation-supersession-and-redirect-conventions.md`
- Keep active routers focused on active canonical destinations.

### Routing and Authoritativeness (Rule Group 3)

- Keep canonical docs discoverable from router/index surfaces.
- Keep routing and registry references synchronized:
  - `docs/context/context-map.json`
  - `docs/context/routing/task-to-context-routing.seed.json`
  - `docs/context/documentation-registry.seed.json`
- Keep category-specific placement contracts stable:
  - ADR records stay in `docs/adr/records/`.
  - Baseline docs keep baseline placement and historical authority semantics.
  - Routing references stay on active non-historical records.
- Treat context packs and routing artifacts as strict, high-risk assets.

### Cross-Link and Reference Hygiene (Rule Group 4)

- Resolve every local markdown and registry/catalog path you add.
- Keep ADR and architecture related-reference sections consistent.
- Keep high-value routing, index, and supersession cross-references aligned:
  - Routing doc paths and `relatedDocRecordIds`.
  - Documentation index links and record IDs.
  - Documentation registry superseded entries and architecture supersession registry targets.
- Keep docs-system JSON contracts/seed files parseable and shape-compatible.

### Readability Boundaries (Rule Group 5)

- Apply structural readability checks from `docs/contributors/router-overview-writing-standard.md`.
- Keep required heading anchors stable in contract-critical docs.
- Avoid mixed authority/history content in active canonical docs.

## Templates and Examples

- Metadata/header conventions: `docs/context/documentation-metadata-header.md`.
- Templates: `docs/context/templates/README.md`.
- Placement examples: `docs/contributors/docs-placement-guide.md`.
- Router/overview constraints: `docs/contributors/router-overview-writing-standard.md`.
- Supersession and segmentation examples:
  - `docs/context/documentation-supersession-and-redirect-conventions.md`
  - `docs/context/documentation-segmentation-seed-guidance.md`
- Validation command usage and common failure codes: `docs/contributors/docs-foundation-validation.md`.
- Step-by-step local run/fix workflow: `docs/contributors/documentation-quality-checks-run-and-fix-guide.md`.
- Passing/failing repository-grounded examples: `docs/contributors/documentation-quality-worked-examples.md`.

## Interpreting Common Failure Categories

Use category-first triage so fixes are fast and consistent:

- Metadata/shape failures (`FRONTMATTER_INVALID`, `HEADER_ENUM_INVALID`, `SEED_PAIR_MISMATCH`):
  - Fix frontmatter fields, taxonomy enums, and `.md`/`.ai.md` alignment first.
- Status/supersession failures (`STATUS_SIGNAL_MARKER_MISSING`, `SUPERSESSION_*`, `ACTIVE_PATH_REFERENCE_INVALID`, `NON_ACTIVE_*`):
  - Repair status markers, redirect targets, and active-router links.
- Reference integrity failures (`*_REFERENCE_INVALID`, `*_LINK_MISSING`):
  - Resolve broken markdown/JSON references and registry cross-links.
- Routing/registry contract failures (`CONTEXT_*`, `ROUTING_*`, `REGISTRY_*`):
  - Reconcile IDs, paths, and contract fields in routing/context assets.
- Category-compliance failures (`CATEGORY_*`):
  - Fix ADR path/category mismatches, baseline status/authority drift, and routing references to non-active historical records.
- Readability boundary failures (`DOCUMENTATION_QUALITY_STANDARD_INVALID`, `READ-*` scoped checks):
  - Restore required headings or measurable router/overview constraints.

## Severity and Review Expectations

- `critical`: merge-blocking; fix before approval.
- `important`: warning-level; fix in PR or record explicit follow-up.
- `advisory`: non-blocking guidance.

Escalate for manual review when changes affect authority meaning, supersession chains, or high-risk domains (identity, authorization, trust, secrets, runtime startup, routing contracts).

## CI and Shared Automation Behavior (Story 7.3.2)

- Default shared automation command is `npm run docs:lint`.
- Default blocking policy:
  - If output contains one or more `critical` findings, CI fails and the change is blocked.
  - `important` findings are non-blocking warnings by default; merge is allowed with explicit follow-up tracking when needed.
  - `advisory` findings are informational and non-blocking.
- If a validator fails without parseable issue codes, treat it as blocking until triage determines severity.
- Use strict mode only for scoped cleanup campaigns:

```bash
npm run docs:lint -- --strict-important
```

- `--strict-important` promotes `important` findings to blocking for that run; do not make it the default repository policy while transitional and historical docs are still being normalized.

