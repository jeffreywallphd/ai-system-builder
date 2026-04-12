---
title: "AI Companion: Documentation Quality Enforced Standards Guide"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - package.json
  - docs/context/governance/documentation-quality-standard.ai.md
  - docs/contributors/docs-foundation-validation.ai.md
  - docs/contributors/docs-placement-guide.ai.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md
  - docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md
  - docs/contributors/documentation-quality-rule-evolution-guide.ai.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md
  - docs/contributors/documentation-quality-monitoring-and-feedback-guide.ai.md
  - docs/contributors/documentation-quality-worked-examples.ai.md
  - docs/contributors/router-overview-writing-standard.ai.md
  - docs/context/templates/README.ai.md
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

# AI Companion: Documentation Quality Enforced Standards Guide

## Purpose

Map enforced documentation quality rules to contributor actions so assistants and engineers can prevent predictable lint and validation failures before review.

## Canonical Standard and Scope

- Canonical policy: `docs/context/governance/documentation-quality-standard.ai.md`.
- This guide is execution-focused and pre-validation oriented.
- Rule groups in scope:
  - Group 1: Structure and metadata integrity.
  - Group 2: Status and authority clarity.
  - Group 3: Authoritativeness and routing discipline.
  - Group 4: Cross-link and reference hygiene.
  - Group 5: Readability boundaries for enforced artifacts.

## Pre-Validation Workflow

1. Confirm path placement and role.
   - Use `docs/contributors/docs-placement-guide.ai.md`.
   - Confirm `doc_type`, authority role, and ownership.
2. Validate metadata and lifecycle signaling.
   - Keep required frontmatter fields valid.
   - Keep `status` and `authoritativeness` aligned with document purpose.
3. Resolve references while editing.
   - Verify markdown links and docs-system JSON references.
   - Keep active routers free of superseded canonical targets.
4. Preserve required heading anchors.
   - Keep contract-critical headings stable unless validator and guardrail updates ship in the same PR.
5. Run docs validators before requesting review.

```bash
npm run docs:lint
```

Run individual validators directly when narrowing failures:

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

## Rule Categories and Contributor Actions

### Structure and Metadata (Rule Group 1)

- Follow required frontmatter from `docs/context/documentation-metadata-header.ai.md`.
- Keep `.md` and `.ai.md` metadata synchronized when companion pairing is contractual.
- Use valid taxonomy enums from `docs/context/documentation-taxonomy.ai.md`.

### Status and Authority (Rule Group 2)

- Keep superseded docs explicit with valid `superseded_by` and redirect targets.
- For non-active registry docs (`archived`, `superseded`, `deprecated`), keep required metadata fields, taxonomy enums, and required status/supersession sections present.
- Follow lifecycle/status conventions:
  - `docs/context/documentation-status-signals.ai.md`
  - `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
- Keep router links aligned to active canonical destinations.

### Routing and Authoritativeness (Rule Group 3)

- Keep canonical docs discoverable via routers and context indexes.
- Keep routing/registry/context references synchronized:
  - `docs/context/context-map.json`
  - `docs/context/routing/task-to-context-routing.seed.json`
  - `docs/context/documentation-registry.seed.json`
- Keep category-specific placement contracts stable:
  - ADR records stay in `docs/adr/records/`.
  - Baseline docs keep baseline placement and historical authority semantics.
  - Routing references stay on active non-historical records.
- Treat context packs and routing assets as strict/high-risk enforcement surfaces.

### Cross-Link and Reference Hygiene (Rule Group 4)

- Keep local links and contract references resolvable.
- Keep ADR and architecture relationship references coherent.
- Keep high-value routing/index/supersession cross-references aligned:
  - Routing doc paths and `relatedDocRecordIds`.
  - Documentation-index links and record IDs.
  - Documentation-registry superseded entries and architecture supersession registry targets.
- Keep docs-system JSON contracts/seeds parseable and shape-compatible.

### Readability Boundaries (Rule Group 5)

- Apply measurable readability guardrails from `docs/contributors/router-overview-writing-standard.ai.md`.
- Preserve required heading anchors in contract-critical docs.
- Avoid mixed authority/history content in active canonical docs.

## Templates and Examples

- Metadata and header contract: `docs/context/documentation-metadata-header.ai.md`.
- Templates: `docs/context/templates/README.ai.md`.
- Placement examples: `docs/contributors/docs-placement-guide.ai.md`.
- Router and overview constraints: `docs/contributors/router-overview-writing-standard.ai.md`.
- Supersession and segmentation examples:
  - `docs/context/documentation-supersession-and-redirect-conventions.ai.md`
  - `docs/context/documentation-segmentation-seed-guidance.ai.md`
- Failure-code and validator reference: `docs/contributors/docs-foundation-validation.ai.md`.
- Step-by-step local run/fix workflow: `docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md`.
- Sustainable rollout policy for new rules: `docs/contributors/documentation-quality-rule-evolution-guide.ai.md`.
- Ongoing ownership and maintenance workflow for docs tooling: `docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md`.
- Ongoing monitoring loop for false positives, rule drift, and contributor friction: `docs/contributors/documentation-quality-monitoring-and-feedback-guide.ai.md`.
- Passing/failing repository-grounded examples: `docs/contributors/documentation-quality-worked-examples.ai.md`.

## Interpreting Common Failure Categories

- Metadata and pair alignment (`FRONTMATTER_INVALID`, `HEADER_ENUM_INVALID`, `SEED_PAIR_MISMATCH`):
  - Correct frontmatter shape, enum values, and companion metadata alignment.
- Status and redirect integrity (`STATUS_SIGNAL_MARKER_MISSING`, `SUPERSESSION_*`, `ACTIVE_PATH_REFERENCE_INVALID`, `NON_ACTIVE_*`):
  - Repair status markers, redirect targets, and active-router destination links.
- Reference hygiene (`*_REFERENCE_INVALID`, `*_LINK_MISSING`):
  - Fix broken markdown paths, ADR/documentation cross-links, and registry references.
- Routing/registry contracts (`CONTEXT_*`, `ROUTING_*`, `REGISTRY_*`):
  - Reconcile IDs, mapped paths, and contract fields across context-system artifacts.
- Category-compliance (`CATEGORY_*`):
  - Fix ADR path/category mismatches, baseline status/authority drift, and routing references to non-active historical records.
- Readability boundaries (`DOCUMENTATION_QUALITY_STANDARD_INVALID`, `READ-*` scoped checks):
  - Restore required anchors or measurable router/overview constraints.

## Severity and Review Expectations

- `critical`: merge-blocking contract failure.
- `important`: warning-level drift risk; fix in PR or track explicit follow-up.
- `advisory`: non-blocking guidance.

Escalate to additional manual review when authority meaning, supersession chains, or high-risk domains (identity, authorization, trust, secrets, runtime startup, routing contracts) are affected.

## Exceptions and Escape Hatches (Story 7.4.2)

- Allow exceptions only for legitimate non-standard cases:
  - external contract mismatch,
  - security/legal constraints,
  - temporary migration constraints.
- Do not allow exceptions for convenience, deadline pressure, or broad legacy waivers.
- Keep scope narrow and path-specific; avoid directory-wide bypasses.
- Record required fields (`rule_ids`, `paths`, `reason`, `owner`, `expiry_or_review_date`, `mitigation`) in PR text or a linked issue.
- Use `docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md` for approval, expiry, and anti-abuse workflow.

## CI and Shared Automation Behavior (Story 7.3.2)

- Default shared automation command is `npm run docs:lint`.
- Default blocking behavior:
  - `critical` findings block merge (CI fails).
  - `important` findings are non-blocking warnings by default and should be fixed now or tracked explicitly.
  - `advisory` findings are informational and non-blocking.
- Non-zero validator exits without parseable issue codes remain blocking until triaged because severity cannot be trusted.
- Scoped cleanup campaigns can enable strict escalation:

```bash
npm run docs:lint -- --strict-important
```

- `--strict-important` promotes `important` findings to blocking for that run only; default repo policy remains warning-first for transitional and historical documentation hygiene.

