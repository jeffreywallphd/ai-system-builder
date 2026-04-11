---
title: "AI Companion: Context Asset Lifecycle Guidance"
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

# AI Companion: Context Asset Lifecycle Guidance

## Scope

Use this guidance for lifecycle decisions on context packs and task-to-context routing assets.

## Lifecycle Stages

| Stage | Entry Criteria | Required Actions | Exit Conditions |
| --- | --- | --- | --- |
| proposed | A context gap, quality issue, or routing need is identified. | Define owner, purpose, and scope. Confirm no existing asset already fits. | Proposal is approved for authoring. |
| authoring | Proposal approved with explicit owner and paths. | Update `.md` and `.ai.md` companions and required JSON artifacts. Preserve stable IDs. | Guardrails pass and review can start. |
| active | Asset is merged and referenced by packs or routing maps. | Keep metadata, links, and status current. | Cadence or change trigger moves asset into review. |
| in-review | Scheduled or event-driven review is due. | Validate links, code-path references, and conflict status. Remove stale guidance. | Decision is keep, revise, deprecate, or supersede. |
| deprecated | Asset should not be selected for new work. | Mark deprecated, document migration, and reduce routing priority/default selection. | Replaced (superseded) or removed (retired). |
| superseded | A successor asset is authoritative for the same scope. | Link old to new and update routing/pack references to successor. | Old asset is safe to retire. |
| retired | Asset is obsolete and removed from active retrieval. | Remove from active maps/catalogs and keep only minimal audit references as needed. | Lifecycle complete. |

## Creation Criteria

- Add new packs only when existing packs cannot cover scope without adding noise.
- Add or change routing mappings only for deterministic behavior changes.
- Require explicit ownership metadata before adding catalog or routing entries.
- Reuse stable IDs instead of creating duplicate aliases.

## Update Triggers

- Canonical architecture/API/contributor docs changed.
- Routing category, exclusion, fallback, or priority behavior changed.
- Review findings identify stale links or stale claims.
- `reviewExpectations.cadence` requires review.
- Upstream asset is deprecated or superseded.

## Ownership Expectations

- Every pack and mapping has a clear owner responsible for updates.
- Keep `.md` and `.ai.md` companions synchronized in the same PR.
- Update guardrails when contracts or lifecycle expectations change.
- Block unmanaged assets with missing ownership metadata.

## Review Cadence

- Minimum once per feature-epic milestone for governance, pack catalog, and routing seed assets.
- Use stricter cadence when `reviewExpectations.cadence` is present.
- Review metadata accuracy, link health, routing determinism, and stale/duplicate risk.
- Update `last_reviewed` when lifecycle policy changes.

## Deprecation and Supersession

- Supersede when a direct replacement exists.
- Deprecate when migration is phased or replacement is partial.
- Include replacement pointer or retirement criteria.
- Keep superseded assets non-authoritative and out of default routing selections.

## Conflicts and Obsolete Context Resolution

- Canonical and most recently validated guidance takes precedence when conflicts exist.
- Update, deprecate, or supersede conflicting assets in the same change when possible.
- Remove claims that cannot be traced to canonical docs or code paths.
- Escalate unresolved conflicts through governance review before keeping both assets active.

