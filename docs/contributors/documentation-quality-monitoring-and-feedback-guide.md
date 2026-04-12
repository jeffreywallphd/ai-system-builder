---
title: Documentation Quality Monitoring and Feedback Guide
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
  - docs/contributors/documentation-quality-exceptions-and-escape-hatches-guide.md
  - docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md
  - dev/scripts/lint-docs.cjs
  - package.json
  - dev/tests/DocumentationQualityMonitoringStory743Guardrails.test.ts
---

# Documentation Quality Monitoring and Feedback Guide

## Purpose

Define a lightweight monitoring loop so maintainers can detect false positives, noisy rules, stale standards, and contributor friction early, then tune enforcement without running a heavy metrics program.

## Monitoring Principles

- Prefer low-overhead, repeatable checks over dashboards or custom telemetry.
- Evaluate signal quality, not just finding volume.
- Treat contributor friction as a maintenance signal, not a contributor failure.
- Keep actions small and reversible: tune scope/severity first, then consider broader rule changes.

## What to Monitor

Track these qualitative signals during normal maintenance:

1. False positives.
   - Findings that are technically emitted but not true quality defects for the target doc category/status.
2. Noisy rules.
   - Rules that repeatedly emit low-value findings with little remediation impact.
3. Rule drift and stale standards.
   - Governance docs, contributor guides, validator behavior, and tests no longer describe the same policy.
4. Contributor friction.
   - Repeated confusion, high remediation churn, or frequent review back-and-forth for the same rule family.
5. Exception churn.
   - Repeated exception requests/renewals for the same `rule_ids` and `paths`, indicating rule-design debt.

## Lightweight Evidence Sources

Use existing workflows instead of new instrumentation:

- `npm run docs:lint` output from active pull requests.
- Pull request review comments and author notes.
- Exception records captured per `documentation-quality-exceptions-and-escape-hatches-guide`.
- Guardrail/script test changes in `dev/tests` and `dev/scripts`.
- Periodic maintainer scan of warning trends by rule ID in recent docs-related PRs.

Avoid introducing a separate metrics pipeline for this governance slice.

## Practical Monitoring Cadence

Run this loop at a practical cadence (for example, every two to four weeks, or at release boundary review):

1. Collect signals from recent documentation and docs-tooling PRs.
2. Classify each recurring issue:
   - false positive,
   - expected warning backlog,
   - stale policy/validator mismatch,
   - contributor enablement gap.
3. Decide the smallest next action:
   - tune rule scope,
   - adjust severity,
   - clarify contributor guidance,
   - schedule scoped cleanup work.
4. Record the decision in the PR or linked maintenance issue with owner and target date.

## Triage Heuristics for Common Signals

- Frequent false positives in historical/superseded docs:
  - tighten path/status scope before escalating severity.
- Persistent noisy warnings with low remediation value:
  - keep warning-level or deprecate/replace the rule.
- Standard says one thing but validator enforces another:
  - treat as rule drift and update docs + validators + tests in one PR.
- Contributor confusion about remediation steps:
  - improve run/fix guidance and examples before adding stricter enforcement.
- Repeated exception renewals for same constraint:
  - open a rule-tuning or migration story instead of continuing renewals indefinitely.

## Lightweight Health Check Questions

During each cadence review, ask:

1. Are we blocking on true contract failures (`critical`) rather than avoidable noise?
2. Are warning-level findings (`important`) actionable and worth fixing?
3. Do contributors understand how to remediate common findings quickly?
4. Are exceptions narrow, temporary, and trending down for repeated cases?
5. Are governance docs, validators, and guardrail tests still aligned?

If multiple answers are "no", schedule a scoped enforcement-tuning pull request.

## Continuous Improvement Actions (Low Overhead)

- Prefer narrow scope edits and wording clarifications first.
- Promote warning rules to blocking only after false positives are controlled.
- Retire or replace checks that no longer provide reliable signal.
- Keep follow-up tasks explicit with owner, scope, and review date.
- Re-validate with `npm run docs:lint` and relevant `bun test` suites after each tuning change.

## Completion Boundary for This Governance Slice (Story 7.4.3)

This story defines how to monitor enforcement quality and trigger practical tuning work.

Out of scope here:

- building custom metrics infrastructure,
- adding mandatory quantitative KPIs,
- introducing broad new validator families.

Those belong in separate stories if lightweight monitoring proves insufficient.

Use `docs/contributors/documentation-quality-rollout-boundaries-and-follow-on-opportunities-guide.md` to keep this monitoring loop aligned with current rollout scope and future-expansion boundaries.
