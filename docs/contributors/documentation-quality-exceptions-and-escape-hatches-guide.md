---
title: Documentation Quality Exceptions and Escape Hatches Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/governance/documentation-quality-standard.md
  - docs/contributors/documentation-quality-enforced-standards-guide.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.md
  - docs/contributors/documentation-quality-rule-evolution-guide.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.md
  - dev/scripts/lint-docs.cjs
  - package.json
  - dev/tests/DocumentationQualityExceptionsStory742Guardrails.test.ts
---

# Documentation Quality Exceptions and Escape Hatches Guide

## Purpose

Define a narrow, practical exception model for legitimate non-standard cases so documentation quality enforcement remains usable without becoming optional.

## Exceptions Model Scope

Use exceptions only when a document cannot reasonably satisfy a required rule without harming correctness, compliance, or safe operation.

This guide does not allow blanket bypasses of the documentation quality standard.

## Legitimate Exception Cases (Allowed)

A request is in scope only when it matches one of these cases:

1. External contract mismatch.
   - A vendor, regulator, or externally-owned format requires structure that conflicts with enforced local conventions.
2. Security or legal constraint.
   - Required redaction, disclosure limits, or legal text handling conflicts with normal readability or linking patterns.
3. Transitional migration constraint.
   - Temporary non-standard structure is required to keep active migration/supersession paths safe and traceable.

If none of these apply, fix the document instead of requesting an exception.

## Non-Legitimate Uses (Disallowed)

Do not use escape hatches for:

- deadline pressure,
- convenience or style preference,
- broad "legacy waiver" requests,
- unknown ownership or no follow-up plan,
- avoiding `critical` contract checks that can be fixed in-scope.

## Required Exception Record

Every approved exception must include all fields below in the pull request description or linked tracking issue:

- `rule_ids`: exact rule/check IDs being exempted.
- `paths`: exact repository paths (no wildcard globs).
- `reason`: concrete case mapping to one allowed category.
- `scope_boundary`: what is exempted and what is still enforced.
- `owner`: person/team accountable for follow-up.
- `expiry_or_review_date`: specific date for temporary exceptions, or explicit "permanent with rationale".
- `mitigation`: controls that reduce drift while the exception exists.

Exceptions missing any required field should be rejected as incomplete.

## Approval and Review Expectations

- Require one reviewer familiar with docs-quality governance for any exception.
- For high-risk areas (identity, authorization, trust, secrets, runtime startup, routing contracts), require an additional qualified reviewer.
- Exception approval applies only to the declared `rule_ids` and `paths`.
- New unrelated findings in the same files are not auto-waived.

## Expiry and Renewal Rules

- Temporary exceptions should be short-lived and date-bound.
- Renewals must include evidence that remediation is still blocked and a new target date.
- Repeated renewals for the same rule/path pair should trigger a rule-tuning or migration story.
- Closed or expired exceptions should be removed from active tracking.

## Anti-Abuse Guardrails

To prevent routine bypass behavior:

- Keep scope path-specific; do not approve directory-wide exemptions.
- Prefer one exception request per discrete constraint.
- Do not approve exceptions that hide routing, supersession, metadata identity, or canonical authority breakages without explicit high-risk review.
- If the same exception pattern appears repeatedly, treat it as policy/tooling debt and schedule a documented fix.

## Fast Workflow for Contributors

1. Run `npm run docs:lint`.
2. Attempt direct fix first.
3. If blocked by a legitimate case, submit the Required Exception Record.
4. Apply minimal scope exception and keep all unaffected checks passing.
5. Link follow-up work before merge when exception is temporary.

## Related Documentation

- `docs/context/governance/documentation-quality-standard.md`
- `docs/contributors/documentation-quality-enforced-standards-guide.md`
- `docs/contributors/documentation-quality-checks-run-and-fix-guide.md`
- `docs/contributors/documentation-quality-rule-evolution-guide.md`
- `docs/contributors/documentation-quality-tooling-maintenance-guide.md`
