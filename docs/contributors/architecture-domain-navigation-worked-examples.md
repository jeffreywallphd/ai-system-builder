---
title: Architecture Domain Navigation Worked Examples
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/README.md
  - docs/architecture/domains
  - src/hosts
  - src/application
  - dev/tests/ArchitectureDomainNavigationWorkedExamplesGuideGuardrails.test.ts
---

# Architecture Domain Navigation Worked Examples

## Scope

Use these examples when you need fast, repeatable routing through the domainized architecture docs for real AI Loom Studio work.
Each example shows which domain and document types to open first, then where to go for contract detail.

## How To Use These Worked Examples

1. Start with the scenario that matches your current task.
2. Open the listed domain `overview.md` first to confirm scope boundaries.
3. Open the domain `references/README.md` next to find canonical contract docs.
4. Open only the listed contract reference docs and ADRs needed for the task.
5. Validate changes in the mapped source paths before expanding to adjacent domains.

## Example 1: Architecture Review for Run Submission and Scheduling Changes

Scenario:
- Review a PR that changes run readiness validation and queue assignment behavior.

Primary domain route:
1. `docs/architecture/domains/execution-control-plane-and-scheduling/overview.md`
2. `docs/architecture/domains/execution-control-plane-and-scheduling/references/README.md`
3. `docs/architecture/domains/execution-control-plane-and-scheduling/references/run-lifecycle-state-authority.md`
4. `docs/architecture/domains/execution-control-plane-and-scheduling/references/workflow-execution-runtime-handoff.md`
5. `docs/adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.md`

Implementation checkpoints:
- `src/application/runs`
- `src/application/workflows`
- `src/domain/runs`

## Example 2: Feature Decomposition for Asset-Backed Workflow Authoring

Scenario:
- Decompose a story that introduces a new asset-backed workflow authoring behavior in studio UI.

Primary domain route:
1. `docs/architecture/domains/studio-and-system-composition/overview.md`
2. `docs/architecture/domains/studio-and-system-composition/references/README.md`
3. `docs/architecture/domains/studio-and-system-composition/references/workflow-and-system-composition-contracts.md`
4. `docs/architecture/domains/workspace-storage-and-assets/overview.md`
5. `docs/architecture/domains/workspace-storage-and-assets/references/asset-models-and-selection.md`
6. `docs/adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.md`

Implementation checkpoints:
- `src/ui`
- `src/application/assets`
- `src/domain/assets`

## Example 3: Runtime Diagnostics for Desktop Host Startup and API Failures

Scenario:
- Investigate runtime errors after login where desktop startup succeeds but API calls fail.

Primary domain route:
1. `docs/architecture/domains/runtime-host-surfaces/overview.md`
2. `docs/architecture/domains/runtime-host-surfaces/references/README.md`
3. `docs/architecture/domains/runtime-host-surfaces/references/host-composition-root-contracts.md`
4. `docs/architecture/domains/api-and-transport-surfaces/overview.md`
5. `docs/architecture/domains/api-and-transport-surfaces/references/unified-api-surface-contracts.md`
6. `docs/architecture/desktop-post-login-runtime-lifecycle-contract.md`

Implementation checkpoints:
- `src/hosts`
- `electron/main`
- `src/ui/services`

## Example 4: Security-Sensitive Change for Secret-Backed Run Submission

Scenario:
- Add a run-submission capability that consumes secrets and requires authorization changes.

Primary domain route:
1. `docs/architecture/domains/identity-trust-and-security/overview.md`
2. `docs/architecture/domains/identity-trust-and-security/references/README.md`
3. `docs/architecture/domains/identity-trust-and-security/references/identity-proof-and-session-trust-contracts.md`
4. `docs/architecture/domains/execution-control-plane-and-scheduling/overview.md`
5. `docs/architecture/domains/execution-control-plane-and-scheduling/references/run-lifecycle-state-authority.md`
6. `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`

Implementation checkpoints:
- `src/application/auth`
- `src/application/runs`
- `src/infrastructure/security`

## Example 5: Documentation Refactor from Flat Architecture Docs into Domain Folders

Scenario:
- Move a flat architecture document into the correct domain folder while preserving authority and links.

Primary domain route:
1. `docs/architecture/architecture-domain-taxonomy.md`
2. `docs/architecture/architecture-document-scope-boundaries.md`
3. `docs/architecture/architecture-domain-cross-linking-rules.md`
4. `docs/architecture/domains/README.md`
5. `docs/contributors/docs-placement-guide.md`
6. `docs/contributors/architecture-domain-overview-reference-readability-guide.md`

Migration checkpoints:
- Keep `overview.md` boundary-first and route contract detail to references.
- Keep `references/README.md` as the index and authoring contract.
- Keep ADR and baseline references linked, not duplicated.
- Keep `.md` and `.ai.md` companion docs aligned.

## Fast Routing Pattern

For most tasks, this sequence is enough:
1. architecture router -> `docs/architecture/README.md`
2. domain `overview.md` -> boundary and ownership
3. domain `references/README.md` -> contract map
4. one or two contract reference docs -> implementation detail
5. ADRs only when boundary or authority decisions are in question

## Related Documentation

- `docs/architecture/README.md`
- `docs/architecture/domains/README.md`
- `docs/contributors/architecture-domain-overview-reference-readability-guide.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/context/packs/architecture-core.pack.md`
