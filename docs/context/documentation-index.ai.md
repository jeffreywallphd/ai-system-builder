---
title: AI Companion: Documentation Index View
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - dev/scripts/generate-documentation-index-view.cjs
  - dev/tests/DocumentationIndexViewStory631Guardrails.test.ts
  - dev/tests/DocumentationTaskDiscoveryPathsStory632Guardrails.test.ts
  - dev/scripts/validate-docs-foundation.cjs
---

# AI Companion: Documentation Index View (Story 6.3.1)

This index is generated from the machine-readable documentation registry so contributors can browse authoritative docs without manual folder scans.

## Canonical Sources

- Machine-readable registry: `docs/context/documentation-registry.seed.json`
- Registry guidance: `./documentation-registry.ai.md`
- Generation command: `node dev/scripts/generate-documentation-index-view.cjs`

## At a Glance

- Indexed records: **52**
- Active records: **47**
- Non-active records: **5**
- Document types covered: **7**
- Domains covered: **8**
- Status values covered: **5**
- Task workflows covered: **8**

## Browse by Document Type

### `architecture-overview` (8)
- [API and Transport Surfaces Domain Overview](../architecture/domains/api-and-transport-surfaces/overview.ai.md) (`doc-architecture-domain-api-and-transport-surfaces-overview`)
- [Core Platform and Composition Domain Overview](../architecture/domains/core-platform-and-composition/overview.ai.md) (`doc-architecture-domain-core-platform-and-composition-overview`)
- [Deployment Policy and Audit Governance Domain Overview](../architecture/domains/deployment-policy-and-audit-governance/overview.ai.md) (`doc-architecture-domain-deployment-policy-and-audit-governance-overview`)
- [Execution Control Plane and Scheduling Domain Overview](../architecture/domains/execution-control-plane-and-scheduling/overview.ai.md) (`doc-architecture-domain-execution-control-plane-and-scheduling-overview`)
- [Identity Trust and Security Domain Overview](../architecture/domains/identity-trust-and-security/overview.ai.md) (`doc-architecture-domain-identity-trust-and-security-overview`)
- [Runtime Host Surfaces Domain Overview](../architecture/domains/runtime-host-surfaces/overview.ai.md) (`doc-architecture-domain-runtime-host-surfaces-overview`)
- [Studio and System Composition Domain Overview](../architecture/domains/studio-and-system-composition/overview.ai.md) (`doc-architecture-domain-studio-and-system-composition-overview`)
- [Workspace Storage and Assets Domain Overview](../architecture/domains/workspace-storage-and-assets/overview.ai.md) (`doc-architecture-domain-workspace-storage-and-assets-overview`)

### `architecture-reference` (12)
- [Architecture Document Scope Boundaries](../architecture/architecture-document-scope-boundaries.ai.md) (`doc-architecture-document-scope-boundaries`)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.ai.md) (`doc-architecture-domain-cross-linking-rules`)
- [Architecture Domain Migration Inventory](../architecture/architecture-domain-migration-inventory.ai.md) (`doc-architecture-domain-migration-inventory`)
- [Architecture Domain Taxonomy](../architecture/architecture-domain-taxonomy.ai.md) (`doc-architecture-domain-taxonomy`)
- [Architecture Domainization Rollout Boundaries and Follow-On Work](../architecture/architecture-domainization-rollout-boundaries.ai.md) (`doc-architecture-domainization-rollout-boundaries`)
- [Architecture Migration Sequence and Priority Order](../architecture/architecture-migration-sequence-and-priority.ai.md) (`doc-architecture-migration-sequence-and-priority`)
- [Architecture Supersession and Retirement Governance](../architecture/architecture-supersession-and-retirement-governance.ai.md) (`doc-architecture-supersession-and-retirement-governance`)
- [Domain and Application Core](../architecture/domain-and-application-core.ai.md) (`doc-architecture-domain-and-application-core`)
- [Layers and Boundaries](../architecture/layers-and-boundaries.ai.md) (`doc-architecture-layers-and-boundaries`)
- [Presentation and State (Legacy Link Stub)](../architecture/presentation-and-state.ai.md) (`doc-architecture-superseded-presentation-and-state`)
- [Shared Asset Contracts (Legacy Link Stub)](../architecture/shared-asset-contracts.ai.md) (`doc-architecture-superseded-shared-asset-contracts`)
- [Workflow Execution and Tools (Legacy Link Stub)](../architecture/workflow-execution-and-tools.ai.md) (`doc-architecture-superseded-workflow-execution-and-tools`)

### `contributor-guide` (9)
- [ADR-Informed Implementation and Review Examples](../contributors/adr-informed-implementation-and-review-examples.ai.md) (`doc-contributors-adr-informed-implementation-and-review-examples`)
- [Context Engineering System Contributor Guide](../contributors/context-engineering-system-guide.ai.md) (`doc-contributors-context-engineering-system-guide`)
- [Documentation Foundation Validation Guide](../contributors/docs-foundation-validation.ai.md) (`doc-contributors-docs-foundation-validation-guide`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Documentation Migration Safety Guide](../contributors/docs-migration-safety-guide.ai.md) (`doc-contributors-docs-migration-safety-guide`)
- [Documentation Placement Guide](../contributors/docs-placement-guide.ai.md) (`doc-contributors-docs-placement-guide`)
- [Documentation Quality Rule Evolution Guide](../contributors/documentation-quality-rule-evolution-guide.ai.md) (`doc-contributors-documentation-quality-rule-evolution-guide`)
- [Documentation Quality Tooling Maintenance Guide](../contributors/documentation-quality-tooling-maintenance-guide.ai.md) (`doc-contributors-documentation-quality-tooling-maintenance-guide`)
- [Documentation Quality Worked Examples](../contributors/documentation-quality-worked-examples.ai.md) (`doc-contributors-documentation-quality-worked-examples`)

### `runbook` (5)
- [Node Bootstrap Identity Operations](../node-bootstrap-identity-operations.ai.md) (`doc-operations-node-bootstrap-identity`)
- [Secret Health and Operational Diagnostics](../secret-health-and-operational-diagnostics.ai.md) (`doc-operations-secret-health-diagnostics`)
- [Security and Policy Configuration Operations](../security-policy-configuration-operations.ai.md) (`doc-operations-security-policy-configuration`)
- [Storage Administration Operations](../storage-administration-operations.ai.md) (`doc-operations-storage-administration`)
- [Workspace Administration Operations](../workspace-administration-operations.ai.md) (`doc-operations-workspace-administration`)

### `adr` (6)
- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.ai.md) (`doc-adr-001-single-authoritative-control-plane`)
- [ADR-002 Workspace-Centered Tenancy and Resource Ownership](../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md) (`doc-adr-002-workspace-centered-tenancy-and-resource-ownership`)
- [ADR-003 Storage as Managed Platform Resource](../adr/records/adr-003-storage-as-managed-platform-resource.ai.md) (`doc-adr-003-storage-as-managed-platform-resource`)
- [ADR-004 Studios as Views Over Shared System and Asset Model](../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md) (`doc-adr-004-studios-as-views-over-shared-system-and-asset-model`)
- [ADR-005 Trust, Identity, and Security Boundary Enforcement](../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md) (`doc-adr-005-trust-identity-and-security-boundary-enforcement`)
- [ADR-006 Policy-Aware Scheduling and Controlled Execution](../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md) (`doc-adr-006-policy-aware-scheduling-and-controlled-execution`)

### `baseline` (3)
- [Documentation Migration Baseline](../documentation-migration-baseline.ai.md) (`doc-baseline-documentation-migration-baseline`)
- [Documentation Segmentation Migration Inventory](../documentation-segmentation-migration-inventory.ai.md) (`doc-baseline-documentation-segmentation-migration-inventory`)
- [Feature 1 Documentation Foundation Completion Handoff](../baselines/feature-1-documentation-foundation-handoff.ai.md) (`doc-baseline-feature-1-documentation-foundation-handoff`)

### `ai-context` (9)
- [Canonical Documentation Taxonomy](./documentation-taxonomy.ai.md) (`doc-context-documentation-taxonomy`)
- [Context System Foundations Pack](./packs/context-system-foundations.pack.ai.md) (`doc-context-pack-context-system-foundations`)
- [Core Architecture Context Pack](./packs/architecture-core.pack.ai.md) (`doc-context-pack-architecture-core`)
- [Documentation Identity, Stable Keys, and Reference Conventions](./documentation-identity-and-reference-conventions.ai.md) (`doc-context-documentation-identity-and-reference-conventions`)
- [Documentation Refactor Context Pack](./packs/documentation-refactor.pack.ai.md) (`doc-context-pack-documentation-refactor`)
- [Identity and Security Context Pack](./packs/identity-and-security.pack.ai.md) (`doc-context-pack-identity-and-security`)
- [Repository Overview Context Pack](./packs/repository-overview.pack.ai.md) (`doc-context-pack-repository-overview`)
- [Runtime and Host Context Pack](./packs/runtime-and-host.pack.ai.md) (`doc-context-pack-runtime-and-host`)
- [Studio and System Composition Context Pack](./packs/studio-and-system-composition.pack.ai.md) (`doc-context-pack-studio-and-system-composition`)

## Browse by Task Workflow

### `architecture-review` (6)
- Routing task IDs: `architecture-review-host-boundaries`
- Context-map mapping IDs: `context-map-architecture-review-v1`
- Selection mode / priority: `ordered` / `high`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.ai.md) (`doc-adr-001-single-authoritative-control-plane`)
- [Architecture Domain Taxonomy](../architecture/architecture-domain-taxonomy.ai.md) (`doc-architecture-domain-taxonomy`)
- [Core Architecture Context Pack](./packs/architecture-core.pack.ai.md) (`doc-context-pack-architecture-core`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Domain and Application Core](../architecture/domain-and-application-core.ai.md) (`doc-architecture-domain-and-application-core`)
- [Runtime Host Surfaces Domain Overview](../architecture/domains/runtime-host-surfaces/overview.ai.md) (`doc-architecture-domain-runtime-host-surfaces-overview`)

### `coding-implementation` (5)
- Routing task IDs: `repo-implementation-core-workflows`, `runtime-host-coding-implementation`
- Context-map mapping IDs: `context-map-coding-implementation-v1`
- Selection mode / priority: `ordered` / `normal`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.ai.md) (`doc-adr-001-single-authoritative-control-plane`)
- [Domain and Application Core](../architecture/domain-and-application-core.ai.md) (`doc-architecture-domain-and-application-core`)
- [Layers and Boundaries](../architecture/layers-and-boundaries.ai.md) (`doc-architecture-layers-and-boundaries`)
- [Repository Overview Context Pack](./packs/repository-overview.pack.ai.md) (`doc-context-pack-repository-overview`)
- [Runtime and Host Context Pack](./packs/runtime-and-host.pack.ai.md) (`doc-context-pack-runtime-and-host`)

### `diagnostics` (6)
- Routing task IDs: `runtime-host-diagnostics-triage`
- Context-map mapping IDs: `context-map-diagnostics-v1`
- Selection mode / priority: `fallback` / `high`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.ai.md) (`doc-adr-001-single-authoritative-control-plane`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Node Bootstrap Identity Operations](../node-bootstrap-identity-operations.ai.md) (`doc-operations-node-bootstrap-identity`)
- [Runtime and Host Context Pack](./packs/runtime-and-host.pack.ai.md) (`doc-context-pack-runtime-and-host`)
- [Runtime Host Surfaces Domain Overview](../architecture/domains/runtime-host-surfaces/overview.ai.md) (`doc-architecture-domain-runtime-host-surfaces-overview`)
- [Secret Health and Operational Diagnostics](../secret-health-and-operational-diagnostics.ai.md) (`doc-operations-secret-health-diagnostics`)

### `documentation-change` (9)
- Routing task IDs: `documentation-refactor-context-and-architecture`
- Context-map mapping IDs: `context-map-documentation-change-v1`
- Selection mode / priority: `single` / `normal`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [Documentation Foundation Validation Guide](../contributors/docs-foundation-validation.ai.md) (`doc-contributors-docs-foundation-validation-guide`)
- [Documentation Identity, Stable Keys, and Reference Conventions](./documentation-identity-and-reference-conventions.ai.md) (`doc-context-documentation-identity-and-reference-conventions`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Documentation Migration Safety Guide](../contributors/docs-migration-safety-guide.ai.md) (`doc-contributors-docs-migration-safety-guide`)
- [Documentation Placement Guide](../contributors/docs-placement-guide.ai.md) (`doc-contributors-docs-placement-guide`)
- [Documentation Quality Rule Evolution Guide](../contributors/documentation-quality-rule-evolution-guide.ai.md) (`doc-contributors-documentation-quality-rule-evolution-guide`)
- [Documentation Quality Tooling Maintenance Guide](../contributors/documentation-quality-tooling-maintenance-guide.ai.md) (`doc-contributors-documentation-quality-tooling-maintenance-guide`)
- [Documentation Quality Worked Examples](../contributors/documentation-quality-worked-examples.ai.md) (`doc-contributors-documentation-quality-worked-examples`)
- [Documentation Refactor Context Pack](./packs/documentation-refactor.pack.ai.md) (`doc-context-pack-documentation-refactor`)

### `feature-decomposition` (6)
- Routing task IDs: `feature-decomposition-epic-story-planning`
- Context-map mapping IDs: `context-map-feature-decomposition-v1`
- Selection mode / priority: `ordered` / `high`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [Architecture Domain Taxonomy](../architecture/architecture-domain-taxonomy.ai.md) (`doc-architecture-domain-taxonomy`)
- [Context Engineering System Contributor Guide](../contributors/context-engineering-system-guide.ai.md) (`doc-contributors-context-engineering-system-guide`)
- [Core Architecture Context Pack](./packs/architecture-core.pack.ai.md) (`doc-context-pack-architecture-core`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Domain and Application Core](../architecture/domain-and-application-core.ai.md) (`doc-architecture-domain-and-application-core`)
- [Repository Overview Context Pack](./packs/repository-overview.pack.ai.md) (`doc-context-pack-repository-overview`)

### `migration-refactor` (5)
- Routing task IDs: _No direct route task IDs registered; use context-map defaults._
- Context-map mapping IDs: `context-map-migration-refactor-v1`
- Selection mode / priority: `fallback` / `high`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [Canonical Documentation Taxonomy](./documentation-taxonomy.ai.md) (`doc-context-documentation-taxonomy`)
- [Documentation Identity, Stable Keys, and Reference Conventions](./documentation-identity-and-reference-conventions.ai.md) (`doc-context-documentation-identity-and-reference-conventions`)
- [Documentation Migration Safety Guide](../contributors/docs-migration-safety-guide.ai.md) (`doc-contributors-docs-migration-safety-guide`)
- [Documentation Placement Guide](../contributors/docs-placement-guide.ai.md) (`doc-contributors-docs-placement-guide`)
- [Documentation Refactor Context Pack](./packs/documentation-refactor.pack.ai.md) (`doc-context-pack-documentation-refactor`)

### `runtime-security` (6)
- Routing task IDs: `runtime-security-identity-and-policy-hardening`
- Context-map mapping IDs: `context-map-runtime-security-v1`
- Selection mode / priority: `ordered` / `critical`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [ADR-005 Trust, Identity, and Security Boundary Enforcement](../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md) (`doc-adr-005-trust-identity-and-security-boundary-enforcement`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Identity and Security Context Pack](./packs/identity-and-security.pack.ai.md) (`doc-context-pack-identity-and-security`)
- [Identity Trust and Security Domain Overview](../architecture/domains/identity-trust-and-security/overview.ai.md) (`doc-architecture-domain-identity-trust-and-security-overview`)
- [Secret Health and Operational Diagnostics](../secret-health-and-operational-diagnostics.ai.md) (`doc-operations-secret-health-diagnostics`)
- [Security and Policy Configuration Operations](../security-policy-configuration-operations.ai.md) (`doc-operations-security-policy-configuration`)

### `ui-studio` (5)
- Routing task IDs: `studio-system-design-and-ux-shaping`
- Context-map mapping IDs: `context-map-ui-studio-v1`
- Selection mode / priority: `ordered` / `normal`
- Context assembly profile: `foundation-domain-implementation-optional-v1`
- [ADR-004 Studios as Views Over Shared System and Asset Model](../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md) (`doc-adr-004-studios-as-views-over-shared-system-and-asset-model`)
- [Core Architecture Context Pack](./packs/architecture-core.pack.ai.md) (`doc-context-pack-architecture-core`)
- [Repository Overview Context Pack](./packs/repository-overview.pack.ai.md) (`doc-context-pack-repository-overview`)
- [Studio and System Composition Context Pack](./packs/studio-and-system-composition.pack.ai.md) (`doc-context-pack-studio-and-system-composition`)
- [Studio and System Composition Domain Overview](../architecture/domains/studio-and-system-composition/overview.ai.md) (`doc-architecture-domain-studio-and-system-composition-overview`)

## Browse by Domain

### `architecture` (19)
- [API and Transport Surfaces Domain Overview](../architecture/domains/api-and-transport-surfaces/overview.ai.md) (`doc-architecture-domain-api-and-transport-surfaces-overview`)
- [Architecture Document Scope Boundaries](../architecture/architecture-document-scope-boundaries.ai.md) (`doc-architecture-document-scope-boundaries`)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.ai.md) (`doc-architecture-domain-cross-linking-rules`)
- [Architecture Domain Migration Inventory](../architecture/architecture-domain-migration-inventory.ai.md) (`doc-architecture-domain-migration-inventory`)
- [Architecture Domain Taxonomy](../architecture/architecture-domain-taxonomy.ai.md) (`doc-architecture-domain-taxonomy`)
- [Architecture Domainization Rollout Boundaries and Follow-On Work](../architecture/architecture-domainization-rollout-boundaries.ai.md) (`doc-architecture-domainization-rollout-boundaries`)
- [Architecture Migration Sequence and Priority Order](../architecture/architecture-migration-sequence-and-priority.ai.md) (`doc-architecture-migration-sequence-and-priority`)
- [Core Architecture Context Pack](./packs/architecture-core.pack.ai.md) (`doc-context-pack-architecture-core`)
- [Core Platform and Composition Domain Overview](../architecture/domains/core-platform-and-composition/overview.ai.md) (`doc-architecture-domain-core-platform-and-composition-overview`)
- [Domain and Application Core](../architecture/domain-and-application-core.ai.md) (`doc-architecture-domain-and-application-core`)
- [Execution Control Plane and Scheduling Domain Overview](../architecture/domains/execution-control-plane-and-scheduling/overview.ai.md) (`doc-architecture-domain-execution-control-plane-and-scheduling-overview`)
- [Layers and Boundaries](../architecture/layers-and-boundaries.ai.md) (`doc-architecture-layers-and-boundaries`)
- [Presentation and State (Legacy Link Stub)](../architecture/presentation-and-state.ai.md) (`doc-architecture-superseded-presentation-and-state`)
- [Runtime Host Surfaces Domain Overview](../architecture/domains/runtime-host-surfaces/overview.ai.md) (`doc-architecture-domain-runtime-host-surfaces-overview`)
- [Shared Asset Contracts (Legacy Link Stub)](../architecture/shared-asset-contracts.ai.md) (`doc-architecture-superseded-shared-asset-contracts`)
- [Studio and System Composition Context Pack](./packs/studio-and-system-composition.pack.ai.md) (`doc-context-pack-studio-and-system-composition`)
- [Studio and System Composition Domain Overview](../architecture/domains/studio-and-system-composition/overview.ai.md) (`doc-architecture-domain-studio-and-system-composition-overview`)
- [Workflow Execution and Tools (Legacy Link Stub)](../architecture/workflow-execution-and-tools.ai.md) (`doc-architecture-superseded-workflow-execution-and-tools`)
- [Workspace Storage and Assets Domain Overview](../architecture/domains/workspace-storage-and-assets/overview.ai.md) (`doc-architecture-domain-workspace-storage-and-assets-overview`)

### `baselines` (3)
- [Documentation Migration Baseline](../documentation-migration-baseline.ai.md) (`doc-baseline-documentation-migration-baseline`)
- [Documentation Segmentation Migration Inventory](../documentation-segmentation-migration-inventory.ai.md) (`doc-baseline-documentation-segmentation-migration-inventory`)
- [Feature 1 Documentation Foundation Completion Handoff](../baselines/feature-1-documentation-foundation-handoff.ai.md) (`doc-baseline-feature-1-documentation-foundation-handoff`)

### `contributors` (9)
- [ADR-Informed Implementation and Review Examples](../contributors/adr-informed-implementation-and-review-examples.ai.md) (`doc-contributors-adr-informed-implementation-and-review-examples`)
- [Context Engineering System Contributor Guide](../contributors/context-engineering-system-guide.ai.md) (`doc-contributors-context-engineering-system-guide`)
- [Documentation Foundation Validation Guide](../contributors/docs-foundation-validation.ai.md) (`doc-contributors-docs-foundation-validation-guide`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Documentation Migration Safety Guide](../contributors/docs-migration-safety-guide.ai.md) (`doc-contributors-docs-migration-safety-guide`)
- [Documentation Placement Guide](../contributors/docs-placement-guide.ai.md) (`doc-contributors-docs-placement-guide`)
- [Documentation Quality Rule Evolution Guide](../contributors/documentation-quality-rule-evolution-guide.ai.md) (`doc-contributors-documentation-quality-rule-evolution-guide`)
- [Documentation Quality Tooling Maintenance Guide](../contributors/documentation-quality-tooling-maintenance-guide.ai.md) (`doc-contributors-documentation-quality-tooling-maintenance-guide`)
- [Documentation Quality Worked Examples](../contributors/documentation-quality-worked-examples.ai.md) (`doc-contributors-documentation-quality-worked-examples`)

### `decision-records` (6)
- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.ai.md) (`doc-adr-001-single-authoritative-control-plane`)
- [ADR-002 Workspace-Centered Tenancy and Resource Ownership](../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md) (`doc-adr-002-workspace-centered-tenancy-and-resource-ownership`)
- [ADR-003 Storage as Managed Platform Resource](../adr/records/adr-003-storage-as-managed-platform-resource.ai.md) (`doc-adr-003-storage-as-managed-platform-resource`)
- [ADR-004 Studios as Views Over Shared System and Asset Model](../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md) (`doc-adr-004-studios-as-views-over-shared-system-and-asset-model`)
- [ADR-005 Trust, Identity, and Security Boundary Enforcement](../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md) (`doc-adr-005-trust-identity-and-security-boundary-enforcement`)
- [ADR-006 Policy-Aware Scheduling and Controlled Execution](../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md) (`doc-adr-006-policy-aware-scheduling-and-controlled-execution`)

### `documentation` (2)
- [Documentation Refactor Context Pack](./packs/documentation-refactor.pack.ai.md) (`doc-context-pack-documentation-refactor`)
- [Repository Overview Context Pack](./packs/repository-overview.pack.ai.md) (`doc-context-pack-repository-overview`)

### `governance` (5)
- [Architecture Supersession and Retirement Governance](../architecture/architecture-supersession-and-retirement-governance.ai.md) (`doc-architecture-supersession-and-retirement-governance`)
- [Canonical Documentation Taxonomy](./documentation-taxonomy.ai.md) (`doc-context-documentation-taxonomy`)
- [Context System Foundations Pack](./packs/context-system-foundations.pack.ai.md) (`doc-context-pack-context-system-foundations`)
- [Deployment Policy and Audit Governance Domain Overview](../architecture/domains/deployment-policy-and-audit-governance/overview.ai.md) (`doc-architecture-domain-deployment-policy-and-audit-governance-overview`)
- [Documentation Identity, Stable Keys, and Reference Conventions](./documentation-identity-and-reference-conventions.ai.md) (`doc-context-documentation-identity-and-reference-conventions`)

### `identity-and-security` (2)
- [Identity and Security Context Pack](./packs/identity-and-security.pack.ai.md) (`doc-context-pack-identity-and-security`)
- [Identity Trust and Security Domain Overview](../architecture/domains/identity-trust-and-security/overview.ai.md) (`doc-architecture-domain-identity-trust-and-security-overview`)

### `operations` (6)
- [Node Bootstrap Identity Operations](../node-bootstrap-identity-operations.ai.md) (`doc-operations-node-bootstrap-identity`)
- [Runtime and Host Context Pack](./packs/runtime-and-host.pack.ai.md) (`doc-context-pack-runtime-and-host`)
- [Secret Health and Operational Diagnostics](../secret-health-and-operational-diagnostics.ai.md) (`doc-operations-secret-health-diagnostics`)
- [Security and Policy Configuration Operations](../security-policy-configuration-operations.ai.md) (`doc-operations-security-policy-configuration`)
- [Storage Administration Operations](../storage-administration-operations.ai.md) (`doc-operations-storage-administration`)
- [Workspace Administration Operations](../workspace-administration-operations.ai.md) (`doc-operations-workspace-administration`)

## Browse by Status

### `draft` (0)
- No indexed records.

### `active` (47)
- [ADR-001 Single Authoritative Control Plane](../adr/records/adr-001-single-authoritative-control-plane.ai.md) (`doc-adr-001-single-authoritative-control-plane`)
- [ADR-002 Workspace-Centered Tenancy and Resource Ownership](../adr/records/adr-002-workspace-centered-tenancy-and-resource-ownership.ai.md) (`doc-adr-002-workspace-centered-tenancy-and-resource-ownership`)
- [ADR-003 Storage as Managed Platform Resource](../adr/records/adr-003-storage-as-managed-platform-resource.ai.md) (`doc-adr-003-storage-as-managed-platform-resource`)
- [ADR-004 Studios as Views Over Shared System and Asset Model](../adr/records/adr-004-studios-as-views-over-shared-system-and-asset-model.ai.md) (`doc-adr-004-studios-as-views-over-shared-system-and-asset-model`)
- [ADR-005 Trust, Identity, and Security Boundary Enforcement](../adr/records/adr-005-trust-identity-and-security-boundary-enforcement.ai.md) (`doc-adr-005-trust-identity-and-security-boundary-enforcement`)
- [ADR-006 Policy-Aware Scheduling and Controlled Execution](../adr/records/adr-006-policy-aware-scheduling-and-controlled-execution.ai.md) (`doc-adr-006-policy-aware-scheduling-and-controlled-execution`)
- [ADR-Informed Implementation and Review Examples](../contributors/adr-informed-implementation-and-review-examples.ai.md) (`doc-contributors-adr-informed-implementation-and-review-examples`)
- [API and Transport Surfaces Domain Overview](../architecture/domains/api-and-transport-surfaces/overview.ai.md) (`doc-architecture-domain-api-and-transport-surfaces-overview`)
- [Architecture Document Scope Boundaries](../architecture/architecture-document-scope-boundaries.ai.md) (`doc-architecture-document-scope-boundaries`)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.ai.md) (`doc-architecture-domain-cross-linking-rules`)
- [Architecture Domain Migration Inventory](../architecture/architecture-domain-migration-inventory.ai.md) (`doc-architecture-domain-migration-inventory`)
- [Architecture Domain Taxonomy](../architecture/architecture-domain-taxonomy.ai.md) (`doc-architecture-domain-taxonomy`)
- [Architecture Domainization Rollout Boundaries and Follow-On Work](../architecture/architecture-domainization-rollout-boundaries.ai.md) (`doc-architecture-domainization-rollout-boundaries`)
- [Architecture Migration Sequence and Priority Order](../architecture/architecture-migration-sequence-and-priority.ai.md) (`doc-architecture-migration-sequence-and-priority`)
- [Architecture Supersession and Retirement Governance](../architecture/architecture-supersession-and-retirement-governance.ai.md) (`doc-architecture-supersession-and-retirement-governance`)
- [Canonical Documentation Taxonomy](./documentation-taxonomy.ai.md) (`doc-context-documentation-taxonomy`)
- [Context Engineering System Contributor Guide](../contributors/context-engineering-system-guide.ai.md) (`doc-contributors-context-engineering-system-guide`)
- [Context System Foundations Pack](./packs/context-system-foundations.pack.ai.md) (`doc-context-pack-context-system-foundations`)
- [Core Architecture Context Pack](./packs/architecture-core.pack.ai.md) (`doc-context-pack-architecture-core`)
- [Core Platform and Composition Domain Overview](../architecture/domains/core-platform-and-composition/overview.ai.md) (`doc-architecture-domain-core-platform-and-composition-overview`)
- [Deployment Policy and Audit Governance Domain Overview](../architecture/domains/deployment-policy-and-audit-governance/overview.ai.md) (`doc-architecture-domain-deployment-policy-and-audit-governance-overview`)
- [Documentation Foundation Validation Guide](../contributors/docs-foundation-validation.ai.md) (`doc-contributors-docs-foundation-validation-guide`)
- [Documentation Identity, Stable Keys, and Reference Conventions](./documentation-identity-and-reference-conventions.ai.md) (`doc-context-documentation-identity-and-reference-conventions`)
- [Documentation Index-Assisted Discovery Worked Examples](../contributors/documentation-index-assisted-discovery-worked-examples.ai.md) (`doc-contributors-documentation-index-assisted-discovery-worked-examples`)
- [Documentation Migration Safety Guide](../contributors/docs-migration-safety-guide.ai.md) (`doc-contributors-docs-migration-safety-guide`)
- [Documentation Placement Guide](../contributors/docs-placement-guide.ai.md) (`doc-contributors-docs-placement-guide`)
- [Documentation Quality Rule Evolution Guide](../contributors/documentation-quality-rule-evolution-guide.ai.md) (`doc-contributors-documentation-quality-rule-evolution-guide`)
- [Documentation Quality Tooling Maintenance Guide](../contributors/documentation-quality-tooling-maintenance-guide.ai.md) (`doc-contributors-documentation-quality-tooling-maintenance-guide`)
- [Documentation Quality Worked Examples](../contributors/documentation-quality-worked-examples.ai.md) (`doc-contributors-documentation-quality-worked-examples`)
- [Documentation Refactor Context Pack](./packs/documentation-refactor.pack.ai.md) (`doc-context-pack-documentation-refactor`)
- [Documentation Segmentation Migration Inventory](../documentation-segmentation-migration-inventory.ai.md) (`doc-baseline-documentation-segmentation-migration-inventory`)
- [Domain and Application Core](../architecture/domain-and-application-core.ai.md) (`doc-architecture-domain-and-application-core`)
- [Execution Control Plane and Scheduling Domain Overview](../architecture/domains/execution-control-plane-and-scheduling/overview.ai.md) (`doc-architecture-domain-execution-control-plane-and-scheduling-overview`)
- [Identity and Security Context Pack](./packs/identity-and-security.pack.ai.md) (`doc-context-pack-identity-and-security`)
- [Identity Trust and Security Domain Overview](../architecture/domains/identity-trust-and-security/overview.ai.md) (`doc-architecture-domain-identity-trust-and-security-overview`)
- [Layers and Boundaries](../architecture/layers-and-boundaries.ai.md) (`doc-architecture-layers-and-boundaries`)
- [Node Bootstrap Identity Operations](../node-bootstrap-identity-operations.ai.md) (`doc-operations-node-bootstrap-identity`)
- [Repository Overview Context Pack](./packs/repository-overview.pack.ai.md) (`doc-context-pack-repository-overview`)
- [Runtime and Host Context Pack](./packs/runtime-and-host.pack.ai.md) (`doc-context-pack-runtime-and-host`)
- [Runtime Host Surfaces Domain Overview](../architecture/domains/runtime-host-surfaces/overview.ai.md) (`doc-architecture-domain-runtime-host-surfaces-overview`)
- [Secret Health and Operational Diagnostics](../secret-health-and-operational-diagnostics.ai.md) (`doc-operations-secret-health-diagnostics`)
- [Security and Policy Configuration Operations](../security-policy-configuration-operations.ai.md) (`doc-operations-security-policy-configuration`)
- [Storage Administration Operations](../storage-administration-operations.ai.md) (`doc-operations-storage-administration`)
- [Studio and System Composition Context Pack](./packs/studio-and-system-composition.pack.ai.md) (`doc-context-pack-studio-and-system-composition`)
- [Studio and System Composition Domain Overview](../architecture/domains/studio-and-system-composition/overview.ai.md) (`doc-architecture-domain-studio-and-system-composition-overview`)
- [Workspace Administration Operations](../workspace-administration-operations.ai.md) (`doc-operations-workspace-administration`)
- [Workspace Storage and Assets Domain Overview](../architecture/domains/workspace-storage-and-assets/overview.ai.md) (`doc-architecture-domain-workspace-storage-and-assets-overview`)

### `deprecated` (0)
- No indexed records.

### `superseded` (3)
- [Presentation and State (Legacy Link Stub)](../architecture/presentation-and-state.ai.md) (`doc-architecture-superseded-presentation-and-state`)
- [Shared Asset Contracts (Legacy Link Stub)](../architecture/shared-asset-contracts.ai.md) (`doc-architecture-superseded-shared-asset-contracts`)
- [Workflow Execution and Tools (Legacy Link Stub)](../architecture/workflow-execution-and-tools.ai.md) (`doc-architecture-superseded-workflow-execution-and-tools`)

### `archived` (2)
- [Documentation Migration Baseline](../documentation-migration-baseline.ai.md) (`doc-baseline-documentation-migration-baseline`)
- [Feature 1 Documentation Foundation Completion Handoff](../baselines/feature-1-documentation-foundation-handoff.ai.md) (`doc-baseline-feature-1-documentation-foundation-handoff`)

## Maintenance and Validation

- Do not manually edit grouped record lists in this file.
- Update `docs/context/documentation-registry.seed.json`, then regenerate this view.
- Validation guardrails:
  - `bun test dev/tests/DocumentationIndexViewStory631Guardrails.test.ts`
  - `npm run docs:validate:foundation`

