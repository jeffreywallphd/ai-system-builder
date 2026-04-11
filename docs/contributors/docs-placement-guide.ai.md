# AI Companion: Documentation Placement Guide

## Purpose
- Route new docs into the correct taxonomy area so contributors and AI agents avoid maintenance drift.

## Area Routing Contract
- `docs/architecture/`: architecture contracts, boundaries, invariants, and durable design explanations.
- `docs/contributors/`: contributor implementation workflows, extension guardrails, and coding process constraints.
- `docs/operations/`: runbooks, diagnostics, troubleshooting, and admin/runtime procedures.
- `docs/baselines/`: historical snapshots, migration inventories, and completion baselines.
- `docs/adr/`: ADR router/navigation and decision-system entrypoints.
- `docs/adr/records/`: individual decision records with status, alternatives, and supersession history.
- `docs/context/`: shared taxonomy/glossary and cross-domain context for human/AI reasoning.
- `docs/prompts/`: prompt templates and prompt-engineering helpers.
- `docs/ui/`: UI behavior/UX contracts and frontend interaction rules.

## Quick Decision Flow
1. Formal decision record? -> `docs/adr/records/`.
2. Architecture explanation/contract? -> `docs/architecture/`.
3. Runtime operations/runbook? -> `docs/operations/`.
4. Contributor implementation workflow? -> `docs/contributors/`.
5. Historical baseline/migration snapshot? -> `docs/baselines/`.
6. Shared taxonomy/AI context pack? -> `docs/context/`.
7. Prompt template/helper? -> `docs/prompts/`.
8. UI behavior contract? -> `docs/ui/`.
9. If mixed role, keep one authoritative location and link from secondary areas.

## ADR Thresholds For Planned Changes

### ADR Required
- Planned change introduces or revises a durable architectural invariant.
- Planned change modifies control-plane design or authority boundaries between hosts/services.
- Planned change changes workspace model guarantees (scope, tenancy, lifecycle, sharing boundaries).
- Planned change changes security trust boundaries or identity/authorization enforcement model.
- Planned change sets or reverses storage policy direction (durability, persistence authority, sync/replication, retention).
- Planned change commits to studio/system modeling semantics reused across subsystems.

### ADR Recommended
- Planned change introduces a cross-domain tradeoff likely to be debated again without durable rationale.
- Planned change introduces a platform extension seam or abstraction that future work will copy.
- Planned change is long-lived and high-impact even with feasible rollback.

### ADR Unnecessary
- Planned change only clarifies accepted ADR intent without changing the decision.
- Planned change is implementation-local and preserves current architecture contracts.
- Planned change is operational procedure, diagnostics, rollout, or incident response guidance.
- Planned change is a baseline, migration inventory, or completion handoff snapshot.

### Placement For Non-ADR Changes
- Architecture contracts/invariants: `docs/architecture/`.
- Contributor implementation guardrails: `docs/contributors/`.
- Runtime/admin operations: `docs/operations/`.
- Historical baselines and migrations: `docs/baselines/`.
- Shared taxonomy/context: `docs/context/`.

## Required Examples
- Architecture explanation -> `docs/architecture/`.
- Runbook -> `docs/operations/`.
- Historical baseline -> `docs/baselines/`.
- ADR -> `docs/adr/records/`.
- AI-context taxonomy/glossary -> `docs/context/`.

## Anti-Patterns
- Runbooks in `docs/architecture/`.
- Contributor workflow docs in `docs/operations/`.
- Historical snapshots mixed into active canonical docs.
- Duplicated authority across folders instead of linking.
- Shared AI-context notes embedded directly in feature runbooks.
- Mixed-purpose docs that combine architecture authority, stale plans, runbook steps, and long implementation chronology.

## Metadata Contract
- Use the header structure from `docs/context/documentation-metadata-header.contract.json`.
- Use exact `doc_type`, `status`, and `authoritativeness` values from `docs/context/documentation-taxonomy.contract.json`.
- Use segmentation categories from `docs/context/documentation-segmentation-taxonomy.ai.md` to separate active vs historical/transition material.
- Start new docs from templates in `docs/context/templates/README.md`.

## Segmentation Taxonomy Mapping
- Segmentation model source: `docs/context/documentation-segmentation-taxonomy.ai.md`.
- Seed snippets for migration/classification notes: `docs/context/documentation-segmentation-seed-guidance.ai.md`.
- Historical landing-zone strategy: `docs/context/documentation-baseline-and-historical-folder-strategy.ai.md`.
- Supersession/redirect pattern source: `docs/context/documentation-supersession-and-redirect-conventions.ai.md`.
- Active Guidance: current architecture/contributor/operations/UI authority docs.
- Baselines: point-in-time snapshots and completion records.
- Historical Notes: retained non-authoritative context for traceability.
- Migration Guides and Records: sequencing, inventory, and migration safety docs.
- Rollout-Boundary Notes: phase boundaries, non-goals, and deferred work declarations.
- Temporary Transition Documents: short-lived stubs and pointer notes during migration.
- Superseded or Deprecated Documents: retired authority paths with replacement metadata.

## Historical Isolation Target Destinations
- Default historical destination: `docs/baselines/`.
- Preferred landing zones:
  - `docs/baselines/architecture/`
  - `docs/baselines/contributors/`
  - `docs/baselines/operations/`
  - `docs/baselines/context/`
  - `docs/baselines/ui/`
  - `docs/baselines/cross-cutting/`
- Keep old active paths only as short superseded pointer notes when link continuity is required.

## Human Companion
- `docs/contributors/docs-placement-guide.md`
