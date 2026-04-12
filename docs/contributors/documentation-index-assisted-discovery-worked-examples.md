---
title: Documentation Index-Assisted Discovery Worked Examples
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-index.md
  - docs/context/documentation-registry.seed.json
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/documentation-taxonomy.md
  - docs/context/documentation-status-signals.md
  - dev/tests/DocumentationIndexAssistedDiscoveryWorkedExamplesStory635Guardrails.test.ts
---

# Documentation Index-Assisted Discovery Worked Examples

## Purpose

Show how contributors can use the documentation index to quickly find the right authoritative docs for real AI Loom Studio tasks without broad folder scanning.

## Usage Pattern

For each task:
1. Start in `docs/context/documentation-index.md`.
2. Use `Browse by Task Workflow` to collect candidate docs and `recordId` values.
3. Cross-check `Browse by Domain` to tighten scope to the active architecture/operations/contributor area.
4. Use `Browse by Status` plus doc metadata (`status`, `authoritativeness`) to confirm implementation authority.
5. Use `docs/context/routing/task-to-context-routing.seed.json` `taskId` mappings for final context assembly order.

The index is for findability; authority is decided by metadata and active canonical sources.

## Worked Examples

### Example 1: Architecture Review for Run Scheduling Boundary Changes

Scenario:
- Review boundary impact for run lifecycle and scheduling changes.

Index-assisted discovery:
1. In `Browse by Task Workflow`, open `architecture-review`.
2. Collect `recordId` values:
   - `doc-architecture-domain-taxonomy`
   - `doc-architecture-domain-and-application-core`
   - `doc-context-pack-architecture-core`
   - `doc-adr-001-single-authoritative-control-plane`
3. In `Browse by Domain`, verify these stay within `architecture` and `decision-records`.
4. In `Browse by Status`, confirm selected docs are `active`.
5. Use routing `taskId` `architecture-review-host-boundaries` for ordered context assembly.

Primary authority docs:
- `docs/architecture/architecture-domain-taxonomy.md`
- `docs/architecture/domain-and-application-core.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`

### Example 2: Documentation Refactor for Context and Architecture Routers

Scenario:
- Refactor contributor/context docs while preserving contract correctness.

Index-assisted discovery:
1. In `Browse by Task Workflow`, open `documentation-change`.
2. Capture `recordId` values:
   - `doc-context-pack-documentation-refactor`
   - `doc-contributors-docs-placement-guide`
   - `doc-contributors-docs-migration-safety-guide`
   - `doc-contributors-docs-foundation-validation-guide`
3. Confirm `domain` fit in `documentation`, `contributors`, and `governance`.
4. Validate metadata for each selected doc: `status: active`, `authoritativeness: canonical|reference`.
5. Use routing `taskId` `documentation-refactor-context-and-architecture` and mapped `relatedDocRecordIds`.

Primary authority docs:
- `docs/contributors/docs-placement-guide.md`
- `docs/contributors/docs-migration-safety-guide.md`
- `docs/contributors/docs-foundation-validation.md`
- `docs/context/documentation-identity-and-reference-conventions.md`

### Example 3: Feature Decomposition for New Runtime Capability Work

Scenario:
- Break a feature into implementation slices across runtime and architecture boundaries.

Index-assisted discovery:
1. In `Browse by Task Workflow`, open `feature-decomposition`.
2. Start from indexed anchors:
   - `doc-architecture-domain-and-application-core`
   - `doc-architecture-domain-taxonomy`
   - `doc-contributors-context-engineering-system-guide`
3. Add supporting context from `Browse by Domain` for `architecture` and `contributors`.
4. Confirm all selected records are `active` before planning slices.
5. Route with `taskId` `feature-decomposition-epic-story-planning`.

Primary authority docs:
- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/architecture-domain-taxonomy.md`
- `docs/contributors/context-engineering-system-guide.md`

### Example 4: Runtime Troubleshooting for Host Startup/API Regression

Scenario:
- Diagnose a runtime regression where host startup succeeds but API behavior fails.

Index-assisted discovery:
1. In `Browse by Task Workflow`, open `diagnostics`.
2. Collect `recordId` values:
   - `doc-context-pack-runtime-and-host`
   - `doc-operations-secret-health-diagnostics`
   - `doc-operations-node-bootstrap-identity`
   - `doc-architecture-domain-runtime-host-surfaces-overview`
3. Use `Browse by Domain` to keep focus on `operations` and `architecture`.
4. In `Browse by Status`, prefer active runbooks and architecture contracts; exclude historical records.
5. Route using `taskId` `runtime-host-diagnostics-triage`.

Primary authority docs:
- `docs/architecture/domains/runtime-host-surfaces/overview.md`
- `docs/secret-health-and-operational-diagnostics.md`
- `docs/node-bootstrap-identity-operations.md`

### Example 5: Security-Sensitive Change for Identity and Policy Hardening

Scenario:
- Implement security-sensitive trust/authz changes with fail-closed posture.

Index-assisted discovery:
1. In `Browse by Task Workflow`, open `runtime-security`.
2. Collect `recordId` anchors:
   - `doc-adr-005-trust-identity-and-security-boundary-enforcement`
   - `doc-context-pack-identity-and-security`
   - `doc-architecture-domain-identity-trust-and-security-overview`
   - `doc-operations-security-policy-configuration`
3. Confirm `domain` coverage in `identity-and-security`, `decision-records`, and `operations`.
4. Validate authority by metadata: active canonical docs first, reference docs second.
5. Route with `taskId` `runtime-security-identity-and-policy-hardening`.

Primary authority docs:
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.md`
- `docs/architecture/domains/identity-trust-and-security/overview.md`
- `docs/security-policy-configuration-operations.md`

## Index, Routing, Taxonomy, and Status Interaction

- Index (`documentation-index.md`) gives discoverability by task, domain, and lifecycle status.
- Routing (`task-to-context-routing.seed.json`) converts discovered records into deterministic prompt assembly.
- Taxonomy (`documentation-taxonomy.md`) constrains valid `doc_type`, `status`, and `authoritativeness`.
- Document metadata headers are the authority gate for whether an indexed result is implementation-authoritative.

## Prompt and Review Notes

- Include `recordId` values in implementation and review notes for traceable document selection.
- Treat `relatedDocRecordIds` as stable references when validating routing or pack updates.
- If an index result is `archived` or `superseded`, treat it as evidence-only and follow active replacements.

## Related Documentation

- `docs/context/documentation-index.md`
- `docs/context/documentation-registry.md`
- `docs/context/routing/prompt-routing-contract.md`
- `docs/context/documentation-taxonomy.md`
- `docs/context/documentation-status-signals.md`
- `docs/contributors/documentation-index-daily-usage-guide.md`
