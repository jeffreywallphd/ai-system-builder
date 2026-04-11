---
title: "AI Companion: Active vs Historical Docs Worked Examples"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/contributors/baseline-and-historical-material-usage-guide.ai.md
  - docs/context/documentation-segmentation-taxonomy.ai.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.ai.md
  - docs/context/prompt-routing.ai.md
  - docs/architecture/README.ai.md
  - docs/baselines/README.ai.md
  - dev/tests/DocumentationActiveHistoricalWorkedExamplesStory535Guardrails.test.ts
---

# AI Companion: Active vs Historical Docs Worked Examples

## Purpose

Show how to route AI Loom Studio tasks to active authority first while keeping historical docs isolated unless explicitly needed.

## Usage Pattern

For each task:
1. Start from active canonical docs.
2. Add baseline context only for parity or migration evidence.
3. Exclude superseded pointers and transition notes unless the task targets redirects/history.

## Worked Examples

### Example 1: Feature Decomposition for Run-Orchestration Enhancements

Scenario:
- Decompose a story that changes run readiness validation and queue assignment.

Start with active docs:
- `docs/architecture/README.ai.md`
- `docs/architecture/domains/execution-control-plane-and-scheduling/overview.md`
- `docs/architecture/domains/execution-control-plane-and-scheduling/references/run-lifecycle-state-authority.md`
- `docs/contributors/architecture-domain-navigation-worked-examples.ai.md`

Consult baselines only if:
- You need parity evidence from completed migration snapshots.
- Review feedback requests a historical change record.

Keep excluded by default:
- `docs/baselines/` as active implementation authority.
- Superseded pointer docs used only for redirects.

### Example 2: Architecture Review for Trust and Authorization Changes

Scenario:
- Review changes to identity proof, session trust, and authorization boundaries.

Start with active docs:
- `docs/architecture/domains/identity-trust-and-security/overview.md`
- `docs/architecture/domains/identity-trust-and-security/references/identity-proof-and-session-trust-contracts.md`
- `docs/architecture/authorization-enforcement-integration-patterns.md`
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`

Consult baselines only if:
- Historical comparison is needed to confirm retired trust models are not reintroduced.

Keep excluded by default:
- Historical snapshots as override authority against active contracts.
- Transition-only notes that do not define present-state behavior.

### Example 3: Migration Planning for Documentation Reclassification

Scenario:
- Plan migration of mixed docs into clean active and historical segments.

Start with active docs:
- `docs/contributors/docs-placement-guide.ai.md`
- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`
- `docs/context/documentation-supersession-and-redirect-conventions.ai.md`

Consult baselines only if:
- You need migration inventory evidence for traceability checks.
- You need completed transition records to confirm closure.

Keep excluded by default:
- Transition stubs as source material for new canonical text.
- Prior migration notes as current placement authority.

### Example 4: Runtime Troubleshooting for Post-Login API Failures

Scenario:
- Desktop host startup succeeds but authenticated API calls fail.

Start with active docs:
- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/architecture/domains/api-and-transport-surfaces/overview.md`
- `docs/unified-api-observability-troubleshooting.ai.md`
- `docs/operations/README.ai.md`

Consult baselines only if:
- Regression analysis needs a historical migration timeline.

Keep excluded by default:
- Baseline snapshots as current runtime runbooks.
- Superseded docs as actionable troubleshooting authority.

## Quick Decision Matrix

| Task type | Active first | Optional historical use | Excluded by default |
| --- | --- | --- | --- |
| Feature decomposition | Architecture router + domain references | Prior-state parity evidence | Baselines as current design authority |
| Architecture review | Domain contracts + ADRs | Retired design comparison | Transition notes as canonical contracts |
| Migration planning | Placement + segmentation + supersession rules | Inventory and completion evidence | Redirect stubs as canonical sources |
| Runtime troubleshooting | Active runtime/API/operations docs | Regression timeline validation | Historical snapshots as runbooks |

## Prompt and Review Notes

- Keep active canonical docs in prompt context first.
- Label baseline references as non-authoritative historical evidence.
- If active and historical docs conflict, follow active docs and report the mismatch.

## Related Documentation

- `docs/contributors/baseline-and-historical-material-usage-guide.ai.md`
- `docs/contributors/architecture-domain-navigation-worked-examples.ai.md`
- `docs/context/documentation-segmentation-taxonomy.ai.md`
- `docs/context/prompt-routing.ai.md`
