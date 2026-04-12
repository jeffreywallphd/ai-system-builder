---
title: "AI Companion: Documentation Index-Assisted Discovery Worked Examples"
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-index.ai.md
  - docs/context/documentation-registry.seed.json
  - docs/context/routing/task-to-context-routing.seed.json
  - docs/context/documentation-taxonomy.ai.md
  - docs/context/documentation-status-signals.ai.md
  - dev/tests/DocumentationIndexAssistedDiscoveryWorkedExamplesStory635Guardrails.test.ts
---

# AI Companion: Documentation Index-Assisted Discovery Worked Examples

## Purpose

Operational examples for index-first discovery in AI Loom Studio tasks so retrieval stays targeted, authority-aware, and routing-aligned.

## Usage Pattern

Per task:
1. Start in `docs/context/documentation-index.ai.md`.
2. Use `Browse by Task Workflow` to gather candidate docs and `recordId` values.
3. Use `Browse by Domain` to narrow scope.
4. Use `Browse by Status` plus doc metadata (`status`, `authoritativeness`) to validate authority.
5. Use `docs/context/routing/task-to-context-routing.seed.json` `taskId` mappings to finalize ordered context.

Index hit means discoverable. Authority requires active canonical metadata.

## Worked Examples

### Example 1: Architecture Review for Run Scheduling Boundary Changes

Scenario:
- Review scheduling and run-lifecycle boundary changes before implementation.

Index-assisted discovery:
1. Open `architecture-review` in `Browse by Task Workflow`.
2. Capture `recordId` values:
   - `doc-architecture-domain-taxonomy`
   - `doc-architecture-domain-and-application-core`
   - `doc-context-pack-architecture-core`
   - `doc-adr-001-single-authoritative-control-plane`
3. Confirm domain scope using `Browse by Domain` (`architecture`, `decision-records`).
4. Confirm active status via `Browse by Status`.
5. Apply routing `taskId` `architecture-review-host-boundaries`.

Primary authority docs:
- `docs/architecture/architecture-domain-taxonomy.ai.md`
- `docs/architecture/domain-and-application-core.ai.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md`

### Example 2: Documentation Refactor for Context and Architecture Routers

Scenario:
- Update context/contributor docs while preserving routing, metadata, and validation contracts.

Index-assisted discovery:
1. Open `documentation-change` in `Browse by Task Workflow`.
2. Capture `recordId` values:
   - `doc-context-pack-documentation-refactor`
   - `doc-contributors-docs-placement-guide`
   - `doc-contributors-docs-migration-safety-guide`
   - `doc-contributors-docs-foundation-validation-guide`
3. Confirm domain scope (`documentation`, `contributors`, `governance`).
4. Validate metadata authority (`status`, `authoritativeness`) for each selected doc.
5. Apply routing `taskId` `documentation-refactor-context-and-architecture` and mapped `relatedDocRecordIds`.

Primary authority docs:
- `docs/contributors/docs-placement-guide.ai.md`
- `docs/contributors/docs-migration-safety-guide.ai.md`
- `docs/contributors/docs-foundation-validation.ai.md`
- `docs/context/documentation-identity-and-reference-conventions.ai.md`

### Example 3: Feature Decomposition for New Runtime Capability Work

Scenario:
- Decompose runtime-adjacent feature work into bounded implementation slices.

Index-assisted discovery:
1. Open `feature-decomposition` in `Browse by Task Workflow`.
2. Use indexed anchors:
   - `doc-architecture-domain-and-application-core`
   - `doc-architecture-domain-taxonomy`
   - `doc-contributors-context-engineering-system-guide`
3. Add only domain-relevant context from `architecture` and `contributors`.
4. Confirm selected docs are active before producing slice plans.
5. Apply routing `taskId` `feature-decomposition-epic-story-planning`.

Primary authority docs:
- `docs/architecture/domain-and-application-core.ai.md`
- `docs/architecture/architecture-domain-taxonomy.ai.md`
- `docs/contributors/context-engineering-system-guide.ai.md`

### Example 4: Runtime Troubleshooting for Host Startup/API Regression

Scenario:
- Diagnose a host/runtime regression with API failures after startup.

Index-assisted discovery:
1. Open `diagnostics` in `Browse by Task Workflow`.
2. Capture `recordId` values:
   - `doc-context-pack-runtime-and-host`
   - `doc-operations-secret-health-diagnostics`
   - `doc-operations-node-bootstrap-identity`
   - `doc-architecture-domain-runtime-host-surfaces-overview`
3. Restrict scope to `operations` and `architecture` in `Browse by Domain`.
4. Prefer active docs from `Browse by Status`; treat historical entries as evidence-only.
5. Apply routing `taskId` `runtime-host-diagnostics-triage`.

Primary authority docs:
- `docs/architecture/domains/runtime-host-surfaces/overview.ai.md`
- `docs/secret-health-and-operational-diagnostics.ai.md`
- `docs/node-bootstrap-identity-operations.ai.md`

### Example 5: Security-Sensitive Change for Identity and Policy Hardening

Scenario:
- Implement trust/authz hardening while preserving fail-closed boundaries.

Index-assisted discovery:
1. Open `runtime-security` in `Browse by Task Workflow`.
2. Capture `recordId` anchors:
   - `doc-adr-005-trust-identity-and-security-boundary-enforcement`
   - `doc-context-pack-identity-and-security`
   - `doc-architecture-domain-identity-trust-and-security-overview`
   - `doc-operations-security-policy-configuration`
3. Confirm scope in `identity-and-security`, `decision-records`, and `operations`.
4. Validate active canonical authority first, then reference docs.
5. Apply routing `taskId` `runtime-security-identity-and-policy-hardening`.

Primary authority docs:
- `docs/adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md`
- `docs/architecture/domains/identity-trust-and-security/overview.ai.md`
- `docs/security-policy-configuration-operations.ai.md`

## Index, Routing, Taxonomy, and Status Interaction

- Index view gives practical candidate retrieval by task/domain/status.
- Routing seeds convert selected records into deterministic context assembly order.
- Taxonomy enforces valid lifecycle and authority labels.
- Metadata headers are the final gate for implementation authority.

## Prompt and Review Notes

- Record selected `recordId` values in prompts/review notes for traceability.
- Validate `relatedDocRecordIds` coverage when changing routing or pack assets.
- Mark `archived`/`superseded` docs as historical evidence and route to active replacements.

## Related Documentation

- `docs/context/documentation-index.ai.md`
- `docs/context/documentation-registry.ai.md`
- `docs/context/routing/prompt-routing-contract.ai.md`
- `docs/context/documentation-taxonomy.ai.md`
- `docs/context/documentation-status-signals.ai.md`
- `docs/contributors/documentation-index-daily-usage-guide.ai.md`
