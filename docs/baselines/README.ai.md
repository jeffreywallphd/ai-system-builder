# AI Companion: Baselines Documentation Router

## Audience
- AI assistants that need historical project context.
- Engineers validating what changed across stories or epics.

## Purpose
- Entry point for documentation baseline and migration-history artifacts.

## Documentation Status
- Segment: `Baselines`
- Lifecycle status (`status`): `active` (router lifecycle only)
- Authority state (`authoritativeness`): historical navigation for baseline evidence
- Current guidance stance: not authoritative for current implementation behavior; use linked active routers for current decisions
- Canonical active path(s): `docs/architecture/README.ai.md`, `docs/contributors/README.ai.md`, `docs/operations/README.ai.md`, and `docs/context/README.ai.md`

## Target Folder Strategy
- Default baseline destination: `docs/baselines/`.
- Preferred migration landing zones:
  - `docs/baselines/architecture/`
  - `docs/baselines/contributors/`
  - `docs/baselines/operations/`
  - `docs/baselines/context/`
  - `docs/baselines/ui/`
  - `docs/baselines/cross-cutting/`
- Old active paths may keep short superseded pointer notes only for link continuity.
- Decision supersession lineage remains in `docs/adr/records/`.

## Belongs Here
- Baseline reports tied to stories/epics.
- Migration inventories and snapshot artifacts.
- Historical completion records preserved for traceability.

## Does Not Belong Here
- Active operational procedures.
- Current contributor extension workflows.
- Canonical architecture design references.

## Start Here
- [Architecture Baselines Router](./architecture/README.ai.md)
- [Feature 1 Documentation Foundation Completion Handoff](./feature-1-documentation-foundation-handoff.ai.md)
- [Domain and Application Core Historical Evolution](./architecture/core-platform-and-composition/domain-and-application-core-historical-evolution.ai.md)
- [Desktop Runtime and Hosts Historical Evolution](./architecture/runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.ai.md)
- [Desktop Control-Plane Host Promotion Baseline (Story 1.1.1)](./architecture/runtime-host-surfaces/desktop-control-plane-host-promotion-baseline-1.1.1.ai.md)
- [Entrypoint Host Composition Migration (Story 12.4.1) Baseline](./architecture/runtime-host-surfaces/entrypoint-host-composition-migration-12.4.1.ai.md)
- [Development and Test Startup Host Migration (Story 12.4.2) Baseline](./architecture/runtime-host-surfaces/development-host-startup-model-12.4.2.ai.md)
- [Host Composition Extension Guardrails (Story 12.4.3) Baseline](./architecture/runtime-host-surfaces/host-composition-extension-guardrails-12.4.3.ai.md)
- [Offline Local-Mode Authority Boundaries Historical Evolution](./architecture/identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.ai.md)
- [Feature 4 Final Authorization Baseline](./architecture/authorization/authorization-feature-4-final-baseline.ai.md)
- [Deployment Policy Persistence/API Integration Baseline](./architecture/deployment-policy-and-audit-governance/deployment-profile-policy-persistence-api-integration-baseline.ai.md)
- [Image Run Feature 4 Final Baseline](./architecture/execution-control-plane-and-scheduling/image-run-feature-4-final-baseline.ai.md)
- [Image Workflow Feature 2 Final Baseline](./architecture/studio-and-system-composition/image-workflow-feature-2-final-baseline.ai.md)
- [Image Manipulation Feature 8 Final Vertical-Slice Completion](./architecture/studio-and-system-composition/image-manipulation-feature-8-final-vertical-slice-completion.ai.md)
- [Unified API Convergence Transition Baseline](./architecture/api-and-transport-surfaces/unified-api-convergence-plan.ai.md)
- [Documentation Migration Baseline](../documentation-migration-baseline.ai.md)
- [Documentation Migration Inventory](../documentation-migration-baseline.inventory.json)
- [Documentation Segmentation Migration Inventory (Story 5.2.1)](../documentation-segmentation-migration-inventory.ai.md)
- [Documentation Segmentation Migration Inventory JSON](../documentation-segmentation-migration-inventory.inventory.json)
- [Baseline and Historical Folder Strategy](../context/documentation-baseline-and-historical-folder-strategy.ai.md)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.ai.md)
- [Docs Top-Level Contract](../README.ai.md)
- [Context Router](../context/README.ai.md)
