---
title: "AI Companion: Documentation Segmentation Migration Inventory"
doc_type: baseline
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-segmentation-migration-inventory.inventory.json
  - docs/context/documentation-segmentation-taxonomy.ai.md
  - docs/context/documentation-baseline-and-historical-folder-strategy.ai.md
  - docs/architecture
  - dev/tests/DocumentationSegmentationMigrationInventoryGuardrails.test.ts
---

# AI Companion: Documentation Segmentation Migration Inventory (Story 5.2.1)

## Purpose

Provide a focused migration inventory of high-value docs that mix active and historical concerns or belong outside active guidance paths.

## Scope

- Story scope: `5.2.1`
- Method: prioritize highest-risk, highest-traffic docs first
- Inventory granularity: document-level plus major content-block migration candidates
- Machine-readable map: `docs/documentation-segmentation-migration-inventory.inventory.json`

## Inventory Summary

- Total candidates: `17`
- Covered categories: `mixed-purpose`, `historical`, `baseline-candidate`, `transitional`, `superseded`
- Highest-priority candidates: `10`
- Primary actions: split mixed docs, move baseline/history docs to `docs/baselines/`, keep superseded paths pointer-only

## High-Priority Candidates

| Candidate | Category | Current risk | Active material to preserve | Planned action |
| --- | --- | --- | --- | --- |
| `docs/architecture/domain-and-application-core.md` | mixed-purpose | Core architecture authority mixed with long story chronology. | Preserve domain/application invariants and layer boundaries. | Split active contract authority from chronology; move history to baselines. |
| `docs/architecture/desktop-runtime-and-hosts.md` | mixed-purpose | Runtime contracts mixed with feature update streams. | Preserve host lifecycle and boundary contracts. | Keep active runtime authority; move chronology to baselines. |
| `docs/architecture/offline-local-mode-authority-boundaries.md` | mixed-purpose | Active authority rules blended with rollout-history notes. | Preserve authority model, sync boundaries, and prohibited shortcuts. | Split and move historical rollout notes to baselines. |
| `docs/architecture/unified-api-convergence-plan.md` | transitional | Migration plan sections can be confused with canonical API authority. | Preserve only still-actionable migration guardrails. | Keep transitional while active and archive to baselines after convergence completes. |
| `docs/architecture/authorization-feature-4-final-baseline.md` | baseline-candidate | Historical baseline still in active architecture path. | Preserve backlinks to active authorization authority docs. | Move to `docs/baselines/architecture/authorization/`; leave pointer stub. |
| `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md` | baseline-candidate | Story baseline in active architecture namespace. | Preserve canonical references before move. | Move to `docs/baselines/architecture/deployment-policy-and-audit-governance/`. |
| `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md` | baseline-candidate | Completion snapshot remains in active architecture tree. | Preserve any still-relevant active guardrail links. | Move to `docs/baselines/architecture/studio-and-system-composition/`. |
| `docs/architecture/entrypoint-host-composition-migration-12.4.1.md` | historical | Migration-phase record in active architecture root. | No current normative guidance required. | Move to `docs/baselines/architecture/runtime-host-surfaces/`. |
| `docs/architecture/development-host-startup-model-12.4.2.md` | historical | Migration-era startup note appears as active sibling. | No current normative guidance required. | Move to `docs/baselines/architecture/runtime-host-surfaces/`. |
| `docs/architecture/host-composition-extension-guardrails-12.4.3.md` | historical | Phase-specific migration guardrails still in active path. | Copy any still-active extension guardrails into active runtime references first. | Move historical file to `docs/baselines/architecture/runtime-host-surfaces/`. |

## Detailed Candidate Inventory

| Candidate | Category | Priority | Signals | Active material to preserve separately | Recommended destination/action |
| --- | --- | --- | --- | --- | --- |
| `docs/architecture/domain-and-application-core.md` (+ `.ai.md`) | mixed-purpose | high | High-volume authority doc with extensive dated `Direction ... update` sections. | Preserve domain/application core invariants in active domain docs. | Split; move chronology to `docs/baselines/architecture/core-platform-and-composition/`. |
| `docs/architecture/desktop-runtime-and-hosts.md` (+ `.ai.md`) | mixed-purpose | high | Canonical runtime rules mixed with feature-story update chronology. | Preserve host assembly and startup/runtime lifecycle boundaries. | Split active contract from baseline history under `docs/baselines/architecture/runtime-host-surfaces/`. |
| `docs/architecture/offline-local-mode-authority-boundaries.md` (+ `.ai.md`) | mixed-purpose | high | Blends active offline authority contracts with rollout history/progress notes. | Preserve authority model, capability gates, sync boundaries, and prohibited shortcuts. | Split; move rollout history to `docs/baselines/architecture/identity-trust-and-security/`. |
| `docs/secret-bootstrap-and-migration-operations.md` (+ `.ai.md`) | mixed-purpose | medium | Current bootstrap runbook and legacy migration behavior are combined. | Preserve startup behavior and required secret config guidance for current installs. | Split legacy behavior to `docs/baselines/operations/`; keep active runbook lean. |
| `docs/startup-memory-review.md` | historical | medium | Dated implementation status and phased plan coexist with diagnostics. | Preserve only currently validated recommendations in active operations docs. | Move snapshot to `docs/baselines/operations/` and replace with concise active summary if needed. |
| `docs/architecture/unified-api-convergence-plan.md` (+ `.ai.md`) | transitional | high | Migration plan and story notes can be confused with canonical API authority. | Preserve still-applicable migration guardrails while convergence is ongoing. | Keep marked transitional now; archive to `docs/baselines/architecture/api-and-transport-surfaces/` when complete. |
| `docs/architecture/authorization-feature-4-final-baseline.md` (+ `.ai.md`) | baseline-candidate | high | Final baseline in active architecture root. | Preserve canonical references as backlinks. | Move to `docs/baselines/architecture/authorization/` with pointer stub. |
| `docs/architecture/deployment-profile-policy-persistence-api-integration-baseline.md` (+ `.ai.md`) | baseline-candidate | high | Historical baseline adjacent to active policy contracts. | Preserve active API and persistence reference links. | Move to `docs/baselines/architecture/deployment-policy-and-audit-governance/`. |
| `docs/architecture/image-run-feature-4-final-baseline.md` (+ `.ai.md`) | baseline-candidate | medium | Final baseline mixed into active execution docs namespace. | Preserve canonical run lifecycle links in active domain docs. | Move to `docs/baselines/architecture/execution-control-plane-and-scheduling/`. |
| `docs/architecture/image-workflow-feature-2-final-baseline.md` (+ `.ai.md`) | baseline-candidate | medium | Feature baseline remains in active architecture tree. | Preserve active workflow authority links only. | Move to `docs/baselines/architecture/studio-and-system-composition/`. |
| `docs/architecture/image-manipulation-feature-8-final-vertical-slice-completion.md` (+ `.ai.md`) | baseline-candidate | high | Vertical slice completion record in active namespace. | Preserve active cross-feature guardrail links where still valid. | Move to `docs/baselines/architecture/studio-and-system-composition/`. |
| `docs/architecture/entrypoint-host-composition-migration-12.4.1.md` (+ `.ai.md`) | historical | high | Story-specific migration record in active architecture path. | None as current authority. | Move to `docs/baselines/architecture/runtime-host-surfaces/` and keep pointer. |
| `docs/architecture/development-host-startup-model-12.4.2.md` (+ `.ai.md`) | historical | high | Migration-era startup model in active architecture path. | None as current authority. | Move to `docs/baselines/architecture/runtime-host-surfaces/` and keep pointer. |
| `docs/architecture/host-composition-extension-guardrails-12.4.3.md` (+ `.ai.md`) | historical | high | Migration extension guardrails now mostly archival. | Preserve only still-active extension constraints in canonical runtime references. | Move to `docs/baselines/architecture/runtime-host-surfaces/` and keep pointer. |
| `docs/architecture/presentation-and-state.md` (+ `.ai.md`) | superseded | medium | Superseded path remains an inbound-link surface. | None; active guidance already split out. | Keep strict pointer-only format; prevent guidance drift. |
| `docs/architecture/shared-asset-contracts.md` (+ `.ai.md`) | superseded | medium | Superseded mixed-content path retained for continuity. | None; active guidance already moved. | Keep pointer-only format with canonical destination links. |
| `docs/architecture/workflow-execution-and-tools.md` (+ `.ai.md`) | superseded | medium | Superseded path could accidentally regain normative guidance. | None; active guidance already moved. | Keep pointer-only format with canonical destination links. |

## Suggested Migration Batches

1. `Batch A`: split high-risk mixed-purpose docs (`domain-and-application-core`, `desktop-runtime-and-hosts`, `offline-local-mode-authority-boundaries`).
2. `Batch B`: relocate baseline-candidate feature/epic completion docs to `docs/baselines/architecture/*`.
3. `Batch C`: move historical migration notes (`12.4.x`) and stale operational snapshots into baseline folders.
4. `Batch D`: harden superseded docs as pointer-only to prevent active-guidance regression.

## Deliberate Execution Rules

- Move `.md` and `.ai.md` companions together.
- Preserve active authority in canonical docs before moving historical sections.
- Update docs routers when migration paths change.
- Add guardrail tests in each migration batch.

## Related Documentation

- [Documentation Segmentation Taxonomy](./context/documentation-segmentation-taxonomy.ai.md)
- [Documentation Segmentation Seed Guidance](./context/documentation-segmentation-seed-guidance.ai.md)
- [Baseline and Historical Folder Strategy](./context/documentation-baseline-and-historical-folder-strategy.ai.md)
- [Supersession and Redirect Conventions](./context/documentation-supersession-and-redirect-conventions.ai.md)
- [Architecture Router](./architecture/README.ai.md)
- [Baselines Router](./baselines/README.ai.md)
