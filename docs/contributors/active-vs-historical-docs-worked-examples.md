---
title: Active vs Historical Docs Worked Examples
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/contributors/baseline-and-historical-material-usage-guide.md
  - docs/context/documentation-segmentation-taxonomy.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.md
  - docs/context/prompt-routing.md
  - docs/architecture/README.md
  - docs/baselines/README.md
  - dev/tests/DocumentationActiveHistoricalWorkedExamplesStory535Guardrails.test.ts
---

# Active vs Historical Docs Worked Examples

## Purpose

Show contributors how to choose active authority versus optional historical context for realistic AI Loom Studio tasks without contaminating implementation workflows with stale guidance.

## Usage Pattern

For each task:
1. Start from active canonical docs.
2. Add baseline context only when the task explicitly needs parity or migration evidence.
3. Keep superseded pointers and transition notes excluded unless the task is specifically about redirects or history reconstruction.

## Worked Examples

### Example 1: Feature Decomposition for Run-Orchestration Enhancements

Scenario:
- You are decomposing a story that changes run readiness validation and queue assignment behavior.

Start with active docs:
- `docs/architecture/README.md`
- `docs/architecture/domains/execution-control-plane-and-scheduling/overview.md`
- `docs/architecture/domains/execution-control-plane-and-scheduling/references/run-lifecycle-state-authority.md`
- `docs/contributors/architecture-domain-navigation-worked-examples.md`

Consult baselines only if:
- You must prove current behavior preserves a prior migration parity target.
- A reviewer asks for evidence of what changed in a completed baseline snapshot.

Keep excluded by default:
- `docs/baselines/` documents as implementation authority.
- Superseded pointer docs that are only redirect stubs.

### Example 2: Architecture Review for Trust and Authorization Changes

Scenario:
- You are reviewing a change that impacts identity proof, session trust, and authorization boundaries.

Start with active docs:
- `docs/architecture/domains/identity-trust-and-security/overview.md`
- `docs/architecture/domains/identity-trust-and-security/references/identity-proof-and-session-trust-contracts.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`

Consult baselines only if:
- The review needs historical comparison to confirm no retired trust model is being reintroduced.

Keep excluded by default:
- Historical snapshots as override authority when they conflict with active contracts.
- Transition-only notes that do not define present behavior.

### Example 3: Migration Planning for Documentation Reclassification

Scenario:
- You are planning how to move mixed-content docs so active guidance and historical narrative are separated.

Start with active docs:
- `docs/contributors/docs-placement-guide.md`
- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.md`
- `docs/context/documentation-supersession-and-redirect-conventions.md`

Consult baselines only if:
- You need historical inventory evidence to verify nothing is lost during migration.
- You need a record of completed transition steps for traceability.

Keep excluded by default:
- Old path transition stubs as a source for new canonical wording.
- Prior migration notes as current placement authority.

### Example 4: Runtime Troubleshooting for Post-Login API Failures

Scenario:
- Desktop host startup succeeds but authenticated API calls fail after login.

Start with active docs:
- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/api-and-transport-surfaces/overview.md`
- `docs/unified-api-observability-troubleshooting.md`
- `docs/operations/README.md`

Consult baselines only if:
- You are debugging a regression suspected to be introduced during a known migration window.

Keep excluded by default:
- Baseline snapshots as current diagnostic runbooks.
- Superseded docs for actionable runtime troubleshooting steps.

## Quick Decision Matrix

| Task type | Active first | Optional historical use | Excluded by default |
| --- | --- | --- | --- |
| Feature decomposition | Architecture router + domain references | Prior-state parity evidence | Baselines as current design authority |
| Architecture review | Domain contracts + related ADRs | Compare against retired designs | Transition notes as authoritative contracts |
| Migration planning | Placement + segmentation + supersession rules | Migration inventories and completion records | Redirect stubs as canonical sources |
| Runtime troubleshooting | Active runtime/API/operations docs | Regression timeline validation | Historical snapshots as runbooks |

## Prompt and Review Notes

- Keep active canonical sources in prompts and review checklists first.
- Label any baseline citation as historical evidence.
- If active and historical sources conflict, resolve to active docs and file a docs-trust follow-up.

## Related Documentation

- `docs/contributors/baseline-and-historical-material-usage-guide.md`
- `docs/contributors/architecture-domain-navigation-worked-examples.md`
- `docs/context/documentation-segmentation-taxonomy.md`
- `docs/context/prompt-routing.md`
