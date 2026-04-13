# Baselines Documentation Router

## Audience
- Engineers and reviewers validating historical delivery context.
- Maintainers checking migration and completion snapshots.

## Purpose
- Historical baseline and migration artifacts used for traceability.

## Documentation Status
- Segment: `Baselines`
- Lifecycle status (`status`): `active` (router lifecycle only)
- Authority state (`authoritativeness`): historical navigation for baseline evidence
- Current guidance stance: not authoritative for current implementation behavior; use linked active routers for current decisions
- Canonical active path(s): `docs/architecture/README.md`, `docs/contributors/README.md`, `docs/operations/README.md`, and `docs/context/README.md`

## Target Folder Strategy
- Use `docs/baselines/` as the default destination for historical snapshots and migration evidence.
- Prefer these migration landing zones when applicable:
  - `docs/baselines/architecture/`
  - `docs/baselines/contributors/`
  - `docs/baselines/operations/`
  - `docs/baselines/context/`
  - `docs/baselines/ui/`
  - `docs/baselines/cross-cutting/`
- Keep old-path documents in active areas as short superseded pointers only when link continuity is needed.
- Use `docs/adr/records/` for superseded architecture decision lineage, not baseline snapshot bundles.

## Belongs Here
- Story or epic baseline snapshots and completion records.
- Migration inventories and point-in-time documentation captures.
- Historical handoff artifacts preserved for auditability.

## Does Not Belong Here
- Current operational runbooks.
- Active contributor implementation workflows.
- Canonical architecture references for current behavior.

## Start Here
- [Architecture Baselines Router](./architecture/README.md)
- [Feature 1 Documentation Foundation Completion Handoff](./feature-1-documentation-foundation-handoff.md)
- [Domain and Application Core Historical Evolution](./architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.md)
- [Desktop Runtime and Hosts Historical Evolution](./architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.md)
- [Desktop Control-Plane Host Promotion Baseline (Story 1.1.1)](./architecture/runtime-host-surfaces/desktop-control-plane-host-promotion-baseline-1.1.1.md)
- [Entrypoint Host Composition Migration (Story 12.4.1) Baseline](./architecture/runtime-host-surfaces/entrypoint-host-composition-migration-12.4.1.md)
- [Development and Test Startup Host Migration (Story 12.4.2) Baseline](./architecture/runtime-host-surfaces/development-host-startup-model-12.4.2.md)
- [Host Composition Extension Guardrails (Story 12.4.3) Baseline](./architecture/runtime-host-surfaces/host-composition-extension-guardrails-12.4.3.md)
- [Offline Local-Mode Authority Boundaries Historical Evolution](./architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.md)
- [Feature 4 Final Baseline: Authorization](./architecture/authorization/authorization-feature-4-final-baseline.md)
- [Deployment Policy Persistence/API Integration Baseline](./architecture/deployment-policy-and-audit-governance/deployment-profile-policy-persistence-api-integration-baseline.md)
- [Image Run Feature 4 Final Baseline](./architecture/execution-control-plane-and-scheduling/image-run-feature-4-final-baseline.md)
- [Image Workflow Feature 2 Final Baseline](./architecture/studio-and-system-composition/image-workflow-feature-2-final-baseline.md)
- [Image Manipulation Feature 8 Final Vertical-Slice Completion](./architecture/studio-and-system-composition/image-manipulation-feature-8-final-vertical-slice-completion.md)
- [Unified API Convergence Transition Baseline](./architecture/api-and-transport-surfaces/unified-api-convergence-plan.md)
- [Documentation Migration Baseline](../documentation-migration-baseline.md)
- [Documentation Migration Inventory](../documentation-migration-baseline.inventory.json)
- [Documentation Segmentation Migration Inventory (Story 5.2.1)](../documentation-segmentation-migration-inventory.md)
- [Documentation Segmentation Migration Inventory JSON](../documentation-segmentation-migration-inventory.inventory.json)
- [Baseline and Historical Folder Strategy](../context/documentation-baseline-and-historical-folder-strategy.md)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.md)
- [Docs Top-Level Contract](../README.md)
- [Context Router](../context/README.md)
