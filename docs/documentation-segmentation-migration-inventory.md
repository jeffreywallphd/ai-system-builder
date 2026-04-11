---
title: Documentation Segmentation Migration Inventory
doc_type: baseline
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-segmentation-migration-inventory.inventory.json
  - docs/context/documentation-segmentation-taxonomy.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.md
  - docs/architecture
  - dev/tests/DocumentationSegmentationMigrationInventoryGuardrails.test.ts
---

# Documentation Segmentation Migration Inventory (Story 5.2.1)

## Purpose

Provide a practical, high-value inventory of mixed-purpose, historical, baseline-candidate, transitional, and superseded documentation so migration work can proceed deliberately rather than ad hoc.

## Scope

- Story scope: `5.2.1`
- Approach: focus on highest-risk and highest-traffic documents first (not an exhaustive audit)
- Inventory shape: document-level and major-content-block-level candidates
- Machine-readable inventory: `docs/documentation-segmentation-migration-inventory.inventory.json`

## Inventory Summary

- Total candidates: `17`
- Category coverage: `mixed-purpose`, `historical`, `baseline-candidate`, `transitional`, `superseded`
- Highest-priority candidates: `10`
- Primary migration actions: split active-vs-historical sections, move baselines to `docs/baselines/architecture/`, convert old paths to short supersession pointers

## High-Priority Migration Candidates

| Candidate | Category | Why it is risky now | Active material that must be preserved | Planned action |
| --- | --- | --- | --- | --- |
| `docs/architecture/domain-and-application-core.md` | mixed-purpose | Canonical architecture guidance is mixed with story-by-story chronology and implementation updates. | `## Domain core`, `## Application core`, and invariant/layer boundary statements. | Split active architecture authority into domain overviews/references; move chronology to baselines. |
| `docs/architecture/desktop-runtime-and-hosts.md` | mixed-purpose | Runtime host contracts and long migration/update chronology share one active path. | Host boundary, preload/electron responsibilities, runtime lifecycle contracts. | Keep canonical runtime contracts active; move dated update streams to baseline history. |
| `docs/architecture/offline-local-mode-authority-boundaries.md` | mixed-purpose | Current offline authority rules and rollout notes are blended with migration/history sections. | Authority model, sync/reconciliation boundaries, prohibited shortcuts, extension rules. | Keep policy authority active; move rollout chronology to baseline docs and cross-link. |
| `docs/architecture/unified-api-convergence-plan.md` | transitional | Migration plan details and completed story notes can be mistaken for evergreen API authority. | Migration guardrails that are still in-progress and still actionable. | Keep transitional while active, then archive to API baselines after convergence completes. |
| `docs/architecture/authorization-feature-4-final-baseline.md` | baseline-candidate | Final baseline snapshot currently lives in active architecture namespace. | Canonical map links that still point to current active docs. | Move to `docs/baselines/architecture/authorization/` and leave redirect stub. |
| `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md` | baseline-candidate | Historical integration baseline appears alongside active architecture contracts. | References to still-canonical policy API and persistence docs. | Move to `docs/baselines/architecture/deployment-policy-and-audit-governance/` with canonical backlinks. |
| `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md` | baseline-candidate | Delivery completion record is discoverable from active architecture folder. | Any still-relevant cross-feature guardrails should be linked from active docs. | Move to `docs/baselines/architecture/studio-and-system-composition/`. |
| `docs/architecture/entrypoint-host-composition-migration-12.4.1.md` | historical | Migration-phase note is stale for day-to-day architecture guidance. | None as current authority; preserve only traceability context. | Move to `docs/baselines/architecture/runtime-host-surfaces/`. |
| `docs/architecture/development-host-startup-model-12.4.2.md` | historical | Migration-era runtime startup notes remain in active architecture path. | None as current authority; preserve as historical record. | Move to `docs/baselines/architecture/runtime-host-surfaces/`. |
| `docs/architecture/host-composition-extension-guardrails-12.4.3.md` | historical | Phase-specific migration guardrails still live near active references. | Any still-active extension rules should be copied to canonical runtime reference docs. | Move to `docs/baselines/architecture/runtime-host-surfaces/` and keep pointer stub. |

## Detailed Candidate Inventory

| Candidate | Category | Priority | Signals | Active material to preserve separately | Recommended destination/action |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/domain-and-application-core.md` (+ `.ai.md`) | mixed-purpose | high | Very high-volume architecture entrypoint with extensive dated `Direction ... update` chronology. | Preserve domain/application core invariants and layering semantics in active architecture domain docs. | Split; move chronology to `docs/baselines/architecture/core-platform-and-composition/`; keep canonical active contract doc slim. |
| `docs/architecture/desktop-runtime-and-hosts.md` (+ `.ai.md`) | mixed-purpose | high | Contains both canonical runtime boundaries and long feature-story update stream. | Preserve host assembly, startup/runtime lifecycle, preload/main-process boundary rules. | Split into active runtime contract + baseline historical addendum under `docs/baselines/architecture/runtime-host-surfaces/`. |
| `docs/architecture/offline-local-mode-authority-boundaries.md` (+ `.ai.md`) | mixed-purpose | high | Mixes active policy boundaries with implementation-history and rollout-progress sections. | Preserve authority model, offline capability gates, sync/reconciliation boundaries, prohibited shortcuts. | Split into canonical authority doc + baseline rollout history under `docs/baselines/architecture/identity-trust-and-security/`. |
| `docs/secret-bootstrap-and-migration-operations.md` (+ `.ai.md`) | mixed-purpose | medium | Contains current bootstrap steps and legacy migration behavior in one runbook. | Preserve startup behavior and required secret configuration for current installs. | Split legacy migration path into `docs/baselines/operations/` and keep active runbook focused on current bootstrap. |
| `docs/startup-memory-review.md` | historical | medium | Includes dated implementation status (`April 10, 2026`) and phased recommendations mixed with current observations. | Preserve only current actionable mitigations that are still validated. | Move full snapshot to `docs/baselines/operations/` and create short active operations summary if needed. |
| `docs/architecture/unified-api-convergence-plan.md` (+ `.ai.md`) | transitional | high | Explicit migration plan and story-by-story notes may be mistaken for evergreen API authority. | Preserve migration guardrails still needed while convergence remains in-progress. | Reclassify as transitional migration record; when completed, move to `docs/baselines/architecture/api-and-transport-surfaces/`. |
| `docs/architecture/authorization-feature-4-final-baseline.md` (+ `.ai.md`) | baseline-candidate | high | Final baseline in active architecture namespace. | Preserve canonical references to current authorization docs before move. | Move to `docs/baselines/architecture/authorization/` and keep superseded pointer. |
| `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md` (+ `.ai.md`) | baseline-candidate | high | Story baseline currently appears as active architecture reference sibling. | Preserve any active API/persistence links as backlinks from baseline file. | Move to `docs/baselines/architecture/deployment-policy-and-audit-governance/`. |
| `docs/architecture/image-run-feature-4-final-baseline.md` (+ `.ai.md`) | baseline-candidate | medium | Feature final baseline currently mixed with active execution docs. | Preserve canonical run lifecycle references in active domain docs. | Move to `docs/baselines/architecture/execution-control-plane-and-scheduling/`. |
| `docs/architecture/image-workflow-feature-2-final-baseline.md` (+ `.ai.md`) | baseline-candidate | medium | Historical feature completion baseline remains in active architecture tree. | Preserve only active workflow model authority links. | Move to `docs/baselines/architecture/studio-and-system-composition/`. |
| `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md` (+ `.ai.md`) | baseline-candidate | high | Completion snapshot in active architecture namespace. | Preserve surviving active UX/runtime guardrails in canonical docs. | Move to `docs/baselines/architecture/studio-and-system-composition/`. |
| `docs/architecture/entrypoint-host-composition-migration-12.4.1.md` (+ `.ai.md`) | historical | high | Explicit migration-phase narrative in active architecture root. | No active normative guidance required from this file. | Move to `docs/baselines/architecture/runtime-host-surfaces/`; leave pointer. |
| `docs/architecture/development-host-startup-model-12.4.2.md` (+ `.ai.md`) | historical | high | Phase-specific host startup migration note in active path. | No active normative guidance required from this file. | Move to `docs/baselines/architecture/runtime-host-surfaces/`; leave pointer. |
| `docs/architecture/host-composition-extension-guardrails-12.4.3.md` (+ `.ai.md`) | historical | high | Migration extension guardrails now mostly historical context. | Preserve only still-valid extension guardrails in active runtime host reference docs. | Move to `docs/baselines/architecture/runtime-host-surfaces/`; leave pointer. |
| `docs/architecture/presentation-and-state.md` (+ `.ai.md`) | superseded | medium | Already superseded but still an inbound-link surface that needs strict pointer-only posture. | None; active guidance already split to canonical replacements. | Keep as short supersession pointer; enforce no executable guidance drift. |
| `docs/architecture/shared-asset-contracts.md` (+ `.ai.md`) | superseded | medium | Already superseded mixed-content path. | None; active guidance already moved to split destinations. | Keep pointer-only format and canonical destination links. |
| `docs/architecture/workflow-execution-and-tools.md` (+ `.ai.md`) | superseded | medium | Previously mixed content now superseded; risk is drift back into active guidance. | None; active guidance already split to canonical destinations. | Keep pointer-only format and canonical destination links. |

## Migration Batch Plan (Suggested)

1. `Batch A (high risk mixed-purpose)`: split `domain-and-application-core`, `desktop-runtime-and-hosts`, and `offline-local-mode-authority-boundaries`.
2. `Batch B (baseline relocation)`: move feature/epic/final baseline files to `docs/baselines/architecture/*` and update routers.
3. `Batch C (historical cleanup)`: move `12.4.x` migration notes and `startup-memory-review.md` to baseline destinations.
4. `Batch D (superseded hardening)`: ensure superseded files remain pointer-only and remove any reintroduced normative content.

## Deliberate Execution Rules for Follow-On Stories

- Move `.md` and `.ai.md` companions together.
- Preserve active authority before moving history.
- Update root/context/baseline routers in the same change as classification or movement changes.
- Add or update guardrail tests for each migration batch so regressions are caught automatically.

## Related Documentation

- [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.md)
- [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.md)
- [Baseline and Historical Folder Strategy](./context/documentation-baseline-and-historical-folder-strategy.md)
- [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.md)
- [Architecture Router](./architecture/README.md)
- [Baselines Router](./baselines/README.md)
