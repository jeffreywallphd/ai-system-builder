---
title: Architecture Baselines Router
doc_type: baseline
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/baselines/architecture
  - docs/architecture
  - dev/tests/DocumentationBaselinesStructureAndInitialDestinationsGuardrails.test.ts
---

# Architecture Baselines Router

## Audience
- Engineers and reviewers validating architecture baseline history.
- Maintainers preserving migration-era implementation traceability.

## Purpose
- Route baseline snapshots away from active architecture guidance paths.

## Documentation Status
- Segment: `Baselines`
- Lifecycle status (`status`): `active` (router lifecycle only)
- Authority state (`authoritativeness`): historical architecture snapshot routing
- Current guidance stance: not authoritative for current architecture implementation behavior
- Canonical active path(s): `docs/architecture/README.md` and `docs/architecture/domains/*/overview.md`

## Belongs Here
- Historical feature and story completion baselines.
- Baseline snapshots migrated out of `docs/architecture/`.
- Archived architecture delivery context used for traceability.

## Does Not Belong Here
- Canonical current-state architecture contracts.
- Active domain references used for implementation decisions.
- Day-to-day architecture extension guidance.

## Start Here
- [Domain and Application Core Historical Evolution](./core-platform-and-composition/domain-and-application-core-historical-evolution.md)
- [Desktop Runtime and Hosts Historical Evolution](./runtime-host-surfaces/desktop-runtime-and-hosts-historical-evolution.md)
- [Entrypoint Host Composition Migration (Story 12.4.1) Baseline](./runtime-host-surfaces/entrypoint-host-composition-migration-12.4.1.md)
- [Development and Test Startup Host Migration (Story 12.4.2) Baseline](./runtime-host-surfaces/development-host-startup-model-12.4.2.md)
- [Host Composition Extension Guardrails (Story 12.4.3) Baseline](./runtime-host-surfaces/host-composition-extension-guardrails-12.4.3.md)
- [Offline Local-Mode Authority Boundaries Historical Evolution](./identity-trust-and-security/offline-local-mode-authority-boundaries-historical-evolution.md)
- [Feature 4 Final Baseline: Authorization](./authorization/authorization-feature-4-final-baseline.md)
- [Deployment Policy Persistence/API Integration Baseline](./deployment-policy-and-audit-governance/deployment-profile-policy-persistence-api-integration-baseline.md)
- [Image Run Feature 4 Final Baseline](./execution-control-plane-and-scheduling/image-run-feature-4-final-baseline.md)
- [Image Workflow Feature 2 Final Baseline](./studio-and-system-composition/image-workflow-feature-2-final-baseline.md)
- [Image Manipulation Feature 8 Final Vertical-Slice Completion](./studio-and-system-composition/image-manipulation-feature-8-final-vertical-slice-completion.md)
- [Unified API Convergence Transition Baseline](./api-and-transport-surfaces/unified-api-convergence-plan.md)
- [Architecture Router (Active Authority)](../../architecture/README.md)
