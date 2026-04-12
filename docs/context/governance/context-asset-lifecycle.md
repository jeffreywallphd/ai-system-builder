---
title: Context Asset Lifecycle Guidance
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/packs
  - docs/context/routing
  - dev/tests/ContextEngineeringStructureGuardrails.test.ts
---

# Context Asset Lifecycle Guidance

## Scope

This guidance defines how context packs and task-to-context routing assets are proposed, authored, reviewed, updated, deprecated, superseded, and retired.

## Lifecycle Stages

| Stage | Entry Criteria | Required Actions | Exit Conditions |
| --- | --- | --- | --- |
| proposed | A retrieval gap, quality issue, or new routing need is identified. | Define owner, purpose, domain, and initial metadata. Confirm no existing asset already covers the scope. | A scoped change proposal is approved for authoring. |
| authoring | Proposal approved with explicit owner and target paths. | Create or update `.md` and `.ai.md` companions plus any required `.contract.json` or `.seed.json` artifacts. Keep IDs stable. | Asset passes local guardrails and is ready for review. |
| active | Asset is merged and referenced by packs, routing docs, or seed maps. | Keep metadata current, including status and review expectations when present. | Triggered into review by cadence or change events. |
| in-review | Review cadence is due or an update trigger fired. | Validate linked docs/code paths, remove stale guidance, and resolve conflicts with newer canonical docs. | Review results in keep-as-is, revise, deprecate, or supersede decision. |
| deprecated | Asset remains available temporarily but should not be selected for new work. | Mark status as deprecated and add migration notes or replacement guidance. Lower routing priority or remove from defaults. | Fully replaced (superseded) or removed (retired). |
| superseded | A successor asset is active and authoritative for the same scope. | Link predecessor to successor and update routing/pack references to the new asset. Keep predecessor for historical traceability only. | Predecessor is no longer needed and can be retired. |
| retired | Asset is obsolete and no longer used in active retrieval paths. | Remove from active catalogs/maps, retain only minimal audit trail where required, and clear stale links. | Lifecycle complete. |

## Creation Criteria

- Create a new pack only when existing packs cannot cover the task domain without becoming noisy.
- Create or update routing mappings only when task selection behavior changes in a deterministic, testable way.
- Require explicit owner (`owner`/`owned_by`) before introducing a new catalog or routing entry.
- Reuse stable IDs and metadata contracts; do not create parallel aliases for the same scope.

## Update Triggers

- Architecture, API, or contributor guidance changes that invalidate existing context claims.
- Routing behavior changes (task categories, priority tiers, exclusion rules, fallback rules).
- Repeated review findings showing stale links, incorrect code paths, or ambiguous guidance.
- Scheduled review cadence in `reviewExpectations` metadata.
- Any supersession or deprecation event affecting an upstream referenced asset.
- Any high-risk pack trigger from `docs/context/governance/high-risk-context-pack-guidance.md`.

## Ownership Expectations

- Every pack and routing mapping must have a clear owner responsible for lifecycle decisions.
- Owners must keep `.md` and `.ai.md` companions aligned in the same pull request.
- Contract and seed changes must ship with corresponding guardrail updates when expectations change.
- Reviewers should block merges that add unmanaged assets or missing ownership metadata.

## Review Cadence

- Minimum cadence: once per feature-epic milestone for governance, pack catalog, and routing seed assets.
- Assets with `reviewExpectations.cadence` follow the stricter of the explicit cadence or milestone cadence.
- High-risk packs must follow the stronger ownership and cadence expectations in `docs/context/governance/high-risk-context-pack-guidance.md`.
- Reviews must validate: metadata accuracy, canonical link health, routing determinism, and duplicate/stale content risk.
- Update `last_reviewed` on canonical governance docs when lifecycle policy changes.

## Deprecation and Supersession

- Prefer supersession when there is a direct replacement with equal or better coverage.
- Use deprecation when replacement is partial or migration must be phased.
- Deprecation must include replacement pointer or retirement criteria.
- Superseded assets must remain non-authoritative and should not appear in default routing selections.

## Conflicts and Obsolete Context Resolution

- If two assets conflict, the one with canonical authoritativeness and latest validated review wins.
- Resolve conflicts by updating or deprecating the losing asset in the same change set when possible.
- Remove or rewrite statements that cannot be traced to authoritative docs or code paths.
- Escalate unresolved conflicts to governance review; do not leave both conflicting assets active without notes.

