---
title: "AI Companion: Documentation Quality Tooling Maintenance Guide"
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
  - docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md
  - docs/contributors/documentation-quality-rule-evolution-guide.ai.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md
  - dev/tests/DocumentationQualityToolingMaintenanceStory741Guardrails.test.ts
---

# AI Companion: Documentation Quality Tooling Maintenance Guide

## Purpose

Define sustainable maintenance expectations for documentation quality tooling so enforcement remains trustworthy as architecture docs, context assets, ADRs, indexing, and segmented guidance evolve.

## Maintenance Ownership Model

Use clear ownership so quality checks do not become orphaned:

- Rule and severity ownership: `team:developer-experience` maintains stable rule IDs, scope, and default severity.
- Validator implementation ownership: maintainers of `dev/scripts/*.cjs` own deterministic behavior and issue-code stability.
- Domain validation ownership: feature/domain maintainers own semantic correctness in their documentation surfaces; documentation tooling owners own shared lint mechanics.
- Review ownership: pull requests that change rule scope or severity require at least one reviewer familiar with docs quality governance.

## Rule Maintenance Expectations

When changing rules, update all affected assets in one pull request:

1. Update canonical policy and contributor guidance.
   - `docs/context/governance/documentation-quality-standard.ai.md`
   - `docs/contributors/documentation-quality-enforced-standards-guide.ai.md`
   - `docs/contributors/documentation-quality-rule-evolution-guide.ai.md`
2. Update validator behavior and issue-code reporting in `dev/scripts/`.
3. Update guardrail and script tests in `dev/tests/`.
4. Update routing/discovery docs if contributor navigation changed.

Do not merge rule changes that are only documented in script output or only implemented in code.

## Validation Ownership and Execution Cadence

Keep validation lightweight and routine:

- Pre-PR contributor expectation: run `npm run docs:lint` for any documentation or docs-tooling change.
- Focused triage: use `npm run docs:lint -- --check <id>` or `--checks <id,id>` while fixing scoped findings.
- Scheduled maintenance expectation: run full docs lint in shared CI (already wired through `npm test`, `npm run validate`, and `npm run validate:ci`).
- Contract break response: `critical` failures are fix-now defects; warning-level backlog should be tracked with explicit owner and scope.

## Guardrail Test Upkeep Expectations

Tests are part of the contract and should evolve with the rule set:

- Every new rule or changed severity must include matching test updates in the same pull request.
- Guardrail tests should assert durable behavior (required sections, required commands, stable cross-links), not transient wording.
- Script tests should assert deterministic outcomes and stable issue codes.
- When a rule is retired, remove or replace obsolete assertions immediately rather than leaving permanently skipped checks.

## Broken or Obsolete Check Update Workflow

Use this workflow when checks fail after documentation architecture evolves:

1. Classify the failure.
   - `implementation defect`: validator bug or path drift.
   - `policy drift`: standard changed but validator/tests did not.
   - `intentional retirement`: rule no longer valuable.
2. Apply the matching change path.
   - For implementation defects: patch validator/tests and keep rule ID stable.
   - For policy drift: update governance + contributor docs, then validator/tests.
   - For intentional retirement: remove or deprecate the check, document replacement coverage, and clean stale references.
3. Verify no orphaned enforcement references remain.
   - `package.json` scripts
   - `docs/contributors` run/fix and standards guides
   - `docs/context/governance` quality standard
   - related guardrail tests and registry links
4. Re-run `npm run docs:lint` and relevant `bun test` suites before merge.

## Sustainable Change Boundaries

To keep maintenance cost proportional:

- Favor small deterministic checks over broad heuristic linting.
- Keep warning-first rollout for maintainability/readability rules until false positives are controlled.
- Avoid broad legacy cleanup gates on untouched files; use touch-policy and scoped follow-up work.
- Keep high-risk contract checks strict (routing, registry, supersession, authority integrity).

## Exception Path Governance (Story 7.4.2)

- Keep exceptions lightweight but explicit: include stable rule IDs, exact paths, owner, mitigation, and expiry/review date.
- Treat repeated exception patterns as maintenance signals for rule tuning or migration planning.
- Prevent hidden permanent bypasses: require renewal evidence and retire expired exceptions.
- Keep exception workflow updates aligned across policy docs, contributor guides, and guardrail tests in the same pull request.

## Required Documentation Updates for Tooling Changes

Any pull request that changes docs-quality tooling or rule behavior should update, when relevant:

- `documentation-quality-standard`
- `documentation-quality-enforced-standards-guide`
- `documentation-quality-checks-run-and-fix-guide`
- `documentation-quality-exceptions-and-escape-hatches-guide`
- `documentation-quality-rule-evolution-guide`
- this maintenance guide

## Completion Boundary for This Governance Slice (Story 7.4.1)

This story defines maintenance expectations and ownership/governance workflow boundaries.

Out of scope here:

- introducing new validator families,
- broad rule rewrites,
- large legacy remediation campaigns.

Those should be delivered as separate scoped stories using this guide as the operating policy.
