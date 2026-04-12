---
title: Documentation Quality Rule Evolution Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/governance/documentation-quality-standard.md
  - docs/contributors/documentation-quality-enforced-standards-guide.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.md
  - dev/scripts/lint-docs.cjs
  - package.json
  - dev/tests/DocumentationRuleEvolutionStory735Guardrails.test.ts
---

# Documentation Quality Rule Evolution Guide

## Purpose

Define how new documentation quality rules are introduced so enforcement can evolve without creating unstable contributor experience.

## Rule Evolution Lifecycle

1. Proposal and contract definition.
   - Define rule intent, scope, stable rule ID, default severity, and explicit in-scope paths.
   - Confirm the rule is deterministic and lightweight enough for normal repository workflows.
2. Warning-first trial phase.
   - Ship the check as non-blocking first and validate signal quality on real contributor changes.
   - Gather false-positive patterns and adjust scope before any blocking promotion.
3. Targeted cleanup phase.
   - Fix highest-frequency findings in active canonical docs.
   - Use strict mode (`npm run docs:lint -- --strict-important`) only for scheduled cleanup windows, not default contributor flow.
4. Stable enforcement phase.
   - Promote to blocking only after trial outcomes and cleanup readiness are documented.
   - Keep rule scope explicit so contributors can predict where enforcement applies.

## When a New Rule Must Start as Warning-Level

Start new rules as warning-level (`important` or `advisory`) when any of the following are true:

- The rule touches broad existing doc families with known legacy drift.
- Failure patterns are still being refined from real repository usage.
- The rule measures maintainability/readability rather than contract integrity.
- The first rollout depends on contributor habit change instead of immediate correctness repair.

Use immediate `critical` blocking rollout only for contract and trust breakages that can misroute users, break retrieval/indexing, or invalidate canonical authority semantics.

## Legacy Documentation Handling Policy

Keep enforcement contributor-safe by separating active authority from legacy normalization work:

- Do not mass-fail untouched legacy docs in routine PRs.
- Apply touch policy:
  - If a legacy file is changed in a PR, leave it better than found and fix rule violations in the changed scope.
  - If a legacy file is untouched, track cleanup separately instead of blocking unrelated delivery.
- Keep baseline/historical/superseded material under reduced enforcement boundaries unless identity/status/redirect integrity is broken.
- Track large legacy cleanup as explicit backlog work with bounded scope and ownership.

## Enforcement Change Communication Checklist

For every rule introduction or severity change, communicate these items in the same PR:

1. What changed:
   - Rule ID, scope, and severity.
2. Why it changed:
   - Risk addressed and expected contributor impact.
3. When it escalates:
   - Start date for warning-only phase and date/condition for blocking enforcement.
4. How to fix:
   - Primary commands and affected docs references.
5. How legacy is handled:
   - Whether untouched legacy docs stay non-blocking and how cleanup is tracked.

Keep communication visible in canonical docs and contributor-facing guides, not only in implementation code or CI logs.

## Practical Rollout Defaults

- Default repository policy remains pragmatic:
  - block on `critical`,
  - warn on `important`,
  - report on `advisory`.
- Prefer at least one normal development cycle of warning-only operation before promoting new maintainability rules to blocking.
- Do not promote a rule to blocking while false-positive categories are still unresolved.
- If emergency blocking is required, document explicit rollback criteria and owner in the same change set.

## Contributor Workflow Expectations During Rule Rollout

1. Run `npm run docs:lint`.
2. Prioritize `critical` findings first.
3. Resolve new warning-level findings in touched docs when practical.
4. If warning volume is high, create a scoped follow-up task instead of silently ignoring drift.
5. Use `npm run docs:lint -- --strict-important` only in dedicated cleanup windows.

## Related Documentation

- `docs/context/governance/documentation-quality-standard.md`
- `docs/contributors/documentation-quality-enforced-standards-guide.md`
- `docs/contributors/documentation-quality-checks-run-and-fix-guide.md`
- `docs/contributors/documentation-quality-worked-examples.md`
