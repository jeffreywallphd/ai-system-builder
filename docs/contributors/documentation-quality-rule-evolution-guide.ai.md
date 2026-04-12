---
title: "AI Companion: Documentation Quality Rule Evolution Guide"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/governance/documentation-quality-standard.ai.md
  - docs/contributors/documentation-quality-enforced-standards-guide.ai.md
  - docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md
  - docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md
  - docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md
  - docs/contributors/documentation-quality-monitoring-and-feedback-guide.ai.md
  - dev/scripts/lint-docs.cjs
  - package.json
  - dev/tests/DocumentationRuleEvolutionStory735Guardrails.test.ts
  - dev/tests/DocumentationQualityToolingMaintenanceStory741Guardrails.test.ts
---

# AI Companion: Documentation Quality Rule Evolution Guide

## Purpose

Define a stable rollout pattern for new docs-quality rules so enforcement can improve without creating unpredictable contributor friction.

## Rule Evolution Lifecycle

1. Propose and define contract.
   - Specify rule purpose, stable rule ID, default severity, and explicit path scope.
   - Confirm deterministic and lightweight enforcement feasibility.
2. Warning-first trial.
   - Introduce as non-blocking first.
   - Observe real findings and tune scope for false positives.
3. Scoped cleanup.
   - Reduce highest-volume findings in active canonical docs.
   - Use strict mode only for scheduled cleanup windows: `npm run docs:lint -- --strict-important`.
4. Stable enforcement.
   - Promote to blocking only after trial quality and cleanup readiness are documented.
   - Keep scope boundaries explicit and predictable.

## When New Rules Start as Warning-Level

Default new rules to warning-level (`important` or `advisory`) when:

- Rule impact spans broad legacy doc families.
- Signal quality is still being validated in real contributor workflows.
- Rule targets maintainability/readability instead of core contract integrity.
- Adoption requires behavior change over multiple contributor cycles.

Reserve immediate `critical` rollout for rules that protect routing/indexing integrity, canonical authority correctness, or trust-critical contracts.

## Legacy Documentation Handling

Use a contributor-safe policy for legacy material:

- Do not block routine PRs on untouched legacy docs.
- Apply touch policy:
  - changed legacy docs should be improved in touched scope,
  - untouched legacy docs are cleaned up through tracked follow-up work.
- Keep baseline/historical/superseded assets under reduced enforcement except for metadata/status/redirect integrity.
- Track large legacy normalization as explicit backlog work with owners and scope.

## Enforcement Change Communication Checklist

Every rule/severity change should communicate in-doc and in-PR:

1. What changed:
   - rule ID, scope, severity.
2. Why changed:
   - risk addressed and expected contributor impact.
3. When escalation happens:
   - warning-start date and blocking-promotion date or condition.
4. How to remediate:
   - primary commands and guidance links.
5. How legacy is handled:
   - untouched legacy treatment and cleanup tracking plan.

Keep this information in canonical contributor/governance docs, not only in script output.

## Practical Rollout Defaults

- Keep default repository profile pragmatic:
  - block on `critical`,
  - warn on `important`,
  - report on `advisory`.
- Keep at least one normal development cycle in warning-first mode before promoting maintainability rules.
- Avoid blocking promotion when false-positive classes remain open.
- If emergency blocking is required, include rollback criteria and owner in the same change.

## Exception Signals and Rule Tuning (Story 7.4.2)

- Repeated exceptions for the same rule/path family indicate rule-design debt.
- If requests become frequent, tune scope/severity or split rules so legitimate non-standard cases are explicitly modeled.
- Keep exception handling narrow and path-bound; do not normalize repeated exceptions into silent global bypass.
- Use `docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.ai.md` to classify legitimate cases before changing rule policy.

## Monitoring Feedback Loop (Story 7.4.3)

- Use `docs/contributors/documentation-quality-monitoring-and-feedback-guide.ai.md` as recurring signal review loop.
- Treat repeated false positives, noisy-rule patterns, and contributor-friction signals as rollout-readiness gates for promotion.
- If monitoring shows stale standards (docs, validators, tests diverging), pause promotion and realign assets in one pull request.

## Contributor Workflow During Rollout

1. Run `npm run docs:lint`.
2. Resolve `critical` findings first.
3. Fix new warning findings in touched scope when practical.
4. Create scoped follow-up tasks for residual warning backlog.
5. Use `--strict-important` only for dedicated cleanup windows.

## Related Documentation

- `docs/context/governance/documentation-quality-standard.ai.md`
- `docs/contributors/documentation-quality-enforced-standards-guide.ai.md`
- `docs/contributors/documentation-quality-checks-run-and-fix-guide.ai.md`
- `docs/contributors/documentation-quality-tooling-maintenance-guide.ai.md`
- `docs/contributors/documentation-quality-worked-examples.ai.md`
