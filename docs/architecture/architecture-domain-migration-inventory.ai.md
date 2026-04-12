---
title: "AI Companion: Architecture Domain Migration Inventory"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-domain-migration-inventory.inventory.json
  - docs/architecture/architecture-domain-taxonomy.ai.md
  - docs/architecture/domains
  - docs/baselines
  - dev/tests/ArchitectureDomainMigrationInventoryGuardrails.test.ts
---

# AI Companion: Architecture Domain Migration Inventory

## Purpose

Provide a migration-ready map from the current flat architecture corpus to the target domain folders so migration execution stays deliberate and lossless.

## Inventory Summary

- Story scope: `4.2.1`
- Source inventory scope: `docs/architecture/*.md` (human docs only; AI companions follow parity)
- Target domains covered: `8/8` from `architecture-domain-taxonomy.md`
- Target file roles used: `overview`, `reference`, `adr-linked-support`, `historical-baseline`
- Machine-readable map: `architecture-domain-migration-inventory.inventory.json`

## Foundational Anchors

These source docs are the highest-value migration anchors.

| Source | Target domain | Target role | Destination |
| --- | --- | --- | --- |
| `domain-and-application-core.md` | `core-platform-and-composition` | `overview` | `domains/core-platform-and-composition/overview.md` |
| `desktop-runtime-and-hosts.md` | `runtime-host-surfaces` | `overview` | `domains/runtime-host-surfaces/overview.md` |
| `identity-foundation.md` | `identity-trust-and-security` | `overview` | `domains/identity-trust-and-security/overview.md` |
| `workspace-foundation.md` | `workspace-storage-and-assets` | `overview` | `domains/workspace-storage-and-assets/overview.md` |
| `run-orchestration-domain-foundation.md` | `execution-control-plane-and-scheduling` | `overview` | `domains/execution-control-plane-and-scheduling/overview.md` |
| `studio-handoff-contract.md` | `studio-and-system-composition` | `overview` | `domains/studio-and-system-composition/overview.md` |
| `unified-api-authoritative-surface.md` | `api-and-transport-surfaces` | `overview` | `domains/api-and-transport-surfaces/overview.md` |
| `deployment-profile-policy-administration-foundation.md` | `deployment-policy-and-audit-governance` | `overview` | `domains/deployment-policy-and-audit-governance/overview.md` |
| `audit-domain-foundation.md` | `deployment-policy-and-audit-governance` | `reference` | `domains/deployment-policy-and-audit-governance/references/audit-domain-foundation.md` |

## Migration Mapping Table

Each row maps one major source family/content block to target domain and destination role.

| Mapping unit | Source family examples | Target domain | Target role | Target destination | Action |
| --- | --- | --- | --- | --- | --- |
| Architecture meta docs | `architecture-domain-taxonomy.md`, `architecture-document-scope-boundaries.md`, `architecture-domain-cross-linking-rules.md` | `core-platform-and-composition` | `adr-linked-support` | `domains/core-platform-and-composition/references/architecture-taxonomy-and-scope-rules.md` | Consolidate and link |
| Core foundations | `domain-and-application-core.md`, `layers-and-boundaries.md`, `persistent-platform-domain-boundaries.md` | `core-platform-and-composition` | `overview` + `reference` | `domains/core-platform-and-composition/overview.md` and references | Split and rewrite |
| Host assembly | `desktop-runtime-and-hosts.md`, `authoritative-server-host-assembly.md`, `host-*.md` | `runtime-host-surfaces` | `reference` | `domains/runtime-host-surfaces/references/host-assembly-and-bootstrap-contracts.md` | Consolidate |
| Startup boundaries | `desktop-auth-first-startup-boundary.md`, `post-login-runtime-deferral-boundary.md`, `auth-only-server-startup-contract.md` | `runtime-host-surfaces` | `reference` | `domains/runtime-host-surfaces/references/startup-lifecycle-and-auth-gating.md` | Split and rewrite |
| Identity/session | `identity-foundation.md`, `identity-session-architecture.md`, `identity-server-api.md` | `identity-trust-and-security` | `overview` + `reference` | `domains/identity-trust-and-security/overview.md` and references | Consolidate |
| Authorization | `authorization-*.md` | `identity-trust-and-security` | `reference` | `domains/identity-trust-and-security/references/authorization-policy-and-enforcement.md` | Consolidate |
| Trust/CA/device | `internal-ca-*.md`, `node-trust-*.md`, `trusted-device-foundation.md` | `identity-trust-and-security` | `reference` | `domains/identity-trust-and-security/references/device-trust-and-ca-contracts.md` | Consolidate |
| Secrets/encryption | `secrets-*.md`, `encryption-at-rest-*.md` | `identity-trust-and-security` | `reference` | `domains/identity-trust-and-security/references/secrets-and-encryption-policy.md` | Consolidate |
| Workspace/storage | `workspace-foundation.md`, `storage-*.md`, `workspace-administration-audit-hooks.md` | `workspace-storage-and-assets` | `overview` + `reference` | `domains/workspace-storage-and-assets/overview.md` and references | Consolidate |
| Asset models | `logical-asset-*.md`, `image-asset-*.md`, `generated-result-*.md`, `shared-asset-contracts.md` | `workspace-storage-and-assets` | `reference` | `domains/workspace-storage-and-assets/references/asset-models-and-selection.md` | Split and rewrite |
| Run control plane | `run-orchestration-*.md`, `run-submission-*.md`, `run-authoritative-*.md` | `execution-control-plane-and-scheduling` | `overview` + `reference` | `domains/execution-control-plane-and-scheduling/overview.md` and references | Consolidate |
| Scheduling/placement | `run-orchestration-scheduling-*.md`, `execution-readiness-node-availability-checks.md` | `execution-control-plane-and-scheduling` | `reference` | `domains/execution-control-plane-and-scheduling/references/scheduling-policy-and-placement.md` | Consolidate |
| Execution nodes | `execution-node-*.md`, `image-run-*.md` | `execution-control-plane-and-scheduling` | `reference` | `domains/execution-control-plane-and-scheduling/references/execution-node-readiness-and-capabilities.md` | Consolidate |
| Studio/UI composition | `presentation-and-state.md`, `multi-surface-ui-*.md`, `studio-handoff-contract.md`, `image-manipulation-studio-*.md` | `studio-and-system-composition` | `overview` + `reference` | `domains/studio-and-system-composition/overview.md` and references | Split and rewrite |
| Workflow/system composition | `image-system-domain-foundation.md`, `image-workflow-*.md`, `workflow-execution-and-tools.md` | `studio-and-system-composition` | `reference` | `domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md` | Split and rewrite |
| API surface | `unified-api-*.md`, `shared-list-query-conventions.md`, `authoritative-route-family-pre-login-inventory.md` | `api-and-transport-surfaces` | `overview` + `reference` | `domains/api-and-transport-surfaces/overview.md` and references | Consolidate |
| Transport/server adapters | `*-transport-contracts.md`, `shared-api-contract-package.md`, `generated-result-api-contracts.md` | `api-and-transport-surfaces` | `reference` | `domains/api-and-transport-surfaces/references/transport-and-server-adapter-contracts.md` | Consolidate |
| Deployment policy | `deployment-profile-policy-*.md` | `deployment-policy-and-audit-governance` | `overview` + `reference` | `domains/deployment-policy-and-audit-governance/overview.md` and references | Consolidate |
| Audit governance | `audit-*.md`, `offline-local-mode-audit-operational-hooks.md` | `deployment-policy-and-audit-governance` | `reference` | `domains/deployment-policy-and-audit-governance/references/audit-ledger-and-event-governance.md` | Consolidate |
| Offline local authority boundaries | `offline-local-mode-authority-boundaries.md`, `offline-sync-shared-contracts.md` | `identity-trust-and-security` (primary) | `adr-linked-support` | `domains/identity-trust-and-security/references/offline-authority-and-sync-boundaries.md` | Split and link |
| Feature/epic baseline docs | `*feature-*-baseline.md`, `*feature-*-final-*.md`, `*feature-*-epic-*.md` | historical destination | `historical-baseline` | `docs/baselines/architecture/` | Move to baselines |
| Migration phase docs | `*12.4*.md` | historical destination | `historical-baseline` | `docs/baselines/architecture/runtime-host-surfaces/` | Move to baselines |

## Mixed-Content Split Targets

These high-value docs are mixed and should not be moved as-is:

| Source | Problem | Split target |
| --- | --- | --- |
| `domain-and-application-core.md` | Core layering mixed with runtime/studio detail | Split into core overview + domain references; link runtime/studio docs |
| `presentation-and-state.md` | UI composition mixed with runtime orchestration and API details | Keep studio composition authority; link runtime/API references |
| `shared-asset-contracts.md` | Storage, API, and studio representation combined | Keep asset model authority in workspace domain; link API/studio contracts |
| `workflow-execution-and-tools.md` | Workflow model and control-plane behavior blended | Split workflow composition from execution scheduling behavior |
| `desktop-runtime-and-hosts.md` | Startup auth policy mixed with host assembly | Keep host lifecycle in runtime domain and link identity policy docs |
| `offline-local-mode-authority-boundaries.md` | Security, storage, and governance concerns combined | Split to identity primary doc + workspace/governance references |

## Historical/Baseline Destinations

- Move feature and epic completion snapshots out of active architecture into `docs/baselines/architecture/`.
- Move migration-phase host notes (for example `*12.4*.md`) into `docs/baselines/architecture/runtime-host-surfaces/`.
- Keep temporary link stubs from original architecture locations while follow-up stories update inbound links.

## Migration Execution Notes

1. Migrate by mapping unit, not by single-file opportunistic edits.
2. Update `.md` and `.ai.md` companion docs together in every migration batch.
3. Keep one canonical destination per contract; replace duplicates with links.
4. Add `## Related ADRs` on destination docs whenever decision constraints apply.
5. After each batch, update domain `references/README.md` indexes and context-pack routing entries.

## Related Documentation

- [Architecture Domain Taxonomy](./architecture-domain-taxonomy.md)
- [Architecture Domain Folders](./domains/README.md)
- [Architecture Migration Sequence and Priority Order](./architecture-migration-sequence-and-priority.md)
- [Architecture Document Scope Boundaries](./architecture-document-scope-boundaries.md)
- [Architecture Domain Cross-Linking Rules](./architecture-domain-cross-linking-rules.md)

