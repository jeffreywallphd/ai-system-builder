---
title: "AI Companion: Documentation Quality Exceptions and Escape Hatches Guide"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/governance/documentation-quality-standard.ai.md
  - docs/contributors/documentation-quality-enforced-standards-guide.ai.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md
  - docs/contributors/documentation-quality-rule-evolution-guide.ai.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md
  - dev/scripts/lint-docs.cjs
  - package.json
  - dev/tests/DocumentationQualityExceptionsStory742Guardrails.test.ts
---

# AI Companion: Documentation Quality Exceptions and Escape Hatches Guide

## Purpose

Define a narrow exception path for legitimate non-standard cases so docs-quality enforcement stays usable without becoming optional.

## Exceptions Model Scope

Use exceptions only when compliance with a required rule would materially break correctness, compliance, or safe operation.

This is not a general bypass mechanism.

## Legitimate Exception Cases (Allowed)

Accept exceptions only for:

1. External contract mismatch.
   - External/vendor/regulatory formats require structure that conflicts with local doc constraints.
2. Security or legal constraint.
   - Redaction/disclosure requirements conflict with normal link or readability patterns.
3. Transitional migration constraint.
   - Temporary non-standard structure is required to keep migration/supersession safe.

If none apply, fix the doc and do not request an exception.

## Non-Legitimate Uses (Disallowed)

Reject escape-hatch requests based on:

- deadline pressure,
- convenience or style preference,
- broad legacy waivers,
- unclear ownership,
- bypassing fixable `critical` checks.

## Required Exception Record

Approved exceptions must include all required fields in PR description or linked tracking issue:

- `rule_ids`: exact IDs being exempted.
- `paths`: exact repo paths, no wildcards.
- `reason`: mapped to one allowed case.
- `scope_boundary`: what is exempted versus still enforced.
- `owner`: accountable person/team.
- `expiry_or_review_date`: concrete date for temporary exceptions, or explicit permanent rationale.
- `mitigation`: controls to limit drift while exception remains active.

Missing fields means the request is incomplete.

## Approval and Review Expectations

- Require one reviewer familiar with docs-quality governance.
- For high-risk areas (identity, authorization, trust, secrets, runtime startup, routing contracts), require an additional qualified reviewer.
- Approval applies only to declared `rule_ids` and `paths`.
- New unrelated findings are not auto-waived.

## Expiry and Renewal Rules

- Temporary exceptions should be short-lived and date-bound.
- Renewal requires evidence remediation is still blocked plus updated target date.
- Repeated renewals for same rule/path should trigger a rule-tuning or migration story.
- Remove expired or closed exceptions from active tracking.

## Anti-Abuse Guardrails

- Keep exceptions path-specific; no directory-wide exemptions.
- Scope one request per discrete constraint when practical.
- Do not hide routing, supersession, metadata identity, or canonical authority breakages without explicit high-risk review.
- Repeated patterns indicate policy/tooling debt and should become planned fix work.

## Fast Contributor Workflow

1. Run `npm run docs:lint`.
2. Try direct remediation first.
3. If blocked by an allowed case, submit the Required Exception Record.
4. Keep exception scope minimal and keep unaffected checks passing.
5. Link follow-up work for temporary exceptions.

## Related Documentation

- `docs/context/governance/documentation-quality-standard.ai.md`
- `docs/contributors/documentation-quality-enforced-standards-guide.ai.md`
- `docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md`
- `docs/contributors/documentation-quality-rule-evolution-guide.ai.md`
- `docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md`
