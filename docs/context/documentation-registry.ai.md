---
title: "AI Companion: Documentation Registry Structure"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-index.ai.md
  - docs/context/documentation-index-coverage-rules.ai.md
  - docs/context/documentation-indexed-document-metadata.contract.json
  - docs/context/documentation-identity-and-reference.contract.json
  - docs/context/templates/documentation-registry-entry.template.json
  - docs/context/templates/documentation-registry-entry.architecture.template.json
  - docs/context/templates/documentation-registry-entry.adr.template.json
  - docs/context/templates/documentation-registry-entry.context-pack.template.json
  - dev/scripts/validate-docs-foundation.cjs
  - dev/scripts/generate-documentation-index-view.cjs
  - dev/tests/DocumentationRegistryStructureGuardrails.test.ts
  - dev/tests/DocumentationIndexViewStory631Guardrails.test.ts
  - dev/tests/DocumentationRegistryAuthoringPatternsStory616Guardrails.test.ts
  - dev/tests/DocumentationRegistryAdrContextContributorStory623Guardrails.test.ts
  - dev/tests/DocumentationRegistryOperationsBaselinesHistoricalStory624Guardrails.test.ts
  - dev/tests/DocumentationRegistryDiscoverySummariesKeywordsStory625Guardrails.test.ts
  - dev/tests/DocumentationRegistryRelationshipsStory626Guardrails.test.ts
---

# AI Companion: Documentation Registry Structure (Story 6.1.3)

Use this file for the canonical machine-readable documentation registry shape and maintenance boundaries.

## Canonical Sources

- Human-readable: `docs/context/documentation-registry.md`
- AI-readable: `docs/context/documentation-registry.ai.md`
- Machine-readable: `docs/context/documentation-registry.seed.json`
- Identity conventions: `docs/context/documentation-identity-and-reference-conventions.ai.md`

## Registry Intent

- Establish a durable index landing point for documentation discovery metadata.
- Keep identifiers stable (`recordId`) and validation straightforward.
- Support future population without redesigning the structure.

## Required Top-Level Sections

- `schemaVersion`
- `artifactType`
- `entryContractPath`
- `taxonomyContractPath`
- `docTypeCatalog`
- `statusCatalog`
- `authoritativenessCatalog`
- `domainRelationships`
- `entries`
- `discoveryIndex`
- `coveragePolicy`

## Entry Shape

Required per-entry fields:

- `recordId`
- `path`
- `title`
- `docType`
- `domain`
- `status`
- `authoritativeness`
- `summary`

Optional retrieval fields are inherited from `documentation-indexed-document-metadata.contract.json`.
Use `relatedRecordIds` for durable stable-key links between registry entries.

## Seed Coverage Rule

The seed registry includes at least one entry for each major `docType` so findability and routing can validate cross-category behavior from day one.

## Population Planning Input (Story 6.2.1)

- Use `docs/documentation-registry-population-inventory.ai.md` and
  `docs/documentation-registry-population-inventory.inventory.json` as the practical candidate set and phased ordering source for follow-on registry population work.

## Active Architecture Population Status (Story 6.2.2)

Registry seed coverage now includes:

- `docs/architecture/architecture-domain-taxonomy.md`
- Architecture routing/governance references:
  `architecture-domain-migration-inventory.md`,
  `architecture-migration-sequence-and-priority.md`,
  `architecture-domainization-rollout-boundaries.md`,
  `architecture-supersession-and-retirement-governance.md`,
  `architecture-document-scope-boundaries.md`,
  `architecture-domain-cross-linking-rules.md`
- Domain overview anchors in `docs/architecture/domains/*/overview.md`

These records are linked through registry `discoveryIndex` maps and architecture routing `relatedDocRecordIds` in `docs/context/routing/task-to-context-routing.seed.json`.

## ADR, Context Pack, and Contributor Population Status (Story 6.2.3)

Registry seed coverage now extends to additional high-value categories:

- Current ADR set in `docs/adr/records/adr-00*.md` (`ADR-001` to `ADR-006`) indexed as `docType: adr` with explicit status/authority metadata.
- Context-pack anchors in `docs/context/packs/*.pack.md` indexed as `docType: ai-context` with category-appropriate authority (`canonical` or `supplemental`).
- Key contributor guidance anchors for implementation quality, context engineering, and onboarding, including:
  - `docs/contributors/context-engineering-system-guide.md`
  - `docs/contributors/docs-foundation-validation.md`
  - `docs/contributors/docs-migration-safety-guide.md`
  - `docs/contributors/adr-informed-implementation-and-review-examples.md`

Documentation routing entries in `docs/context/routing/task-to-context-routing.seed.json` now include these records through `relatedDocRecordIds`, improving stable-key retrieval beyond architecture docs.

## Operations, Baseline, and Historical Population Status (Story 6.2.4)

Registry seed coverage now adds selective operations and non-active documentation entries with explicit lifecycle and authority signals:

- Additional operations runbooks in `docs/*.md` are indexed as `docType: runbook` in domain `operations`:
  - `docs/security-policy-configuration-operations.md`
  - `docs/secret-health-and-operational-diagnostics.md`
  - `docs/workspace-administration-operations.md`
  - `docs/storage-administration-operations.md`
- Selective baseline anchors are indexed as `docType: baseline` with `authoritativeness: historical`:
  - `docs/documentation-migration-baseline.md`
  - `docs/documentation-segmentation-migration-inventory.md`
  - `docs/baselines/feature-1-documentation-foundation-handoff.md`
- Superseded architecture stubs are represented as explicit historical redirect records:
  - `docs/architecture/presentation-and-state.md`
  - `docs/architecture/shared-asset-contracts.md`
  - `docs/architecture/workflow-execution-and-tools.md`

Non-active records are intentionally separated in `discoveryIndex.byStatus` (`active`, `archived`, `superseded`) and `discoveryIndex.byAuthoritativeness` (`historical`) so they remain discoverable without being treated as current implementation authority.

Routing examples and mappings for diagnostics/runtime-security now include stable `relatedDocRecordIds` for operations records to improve deterministic record-based lookup.

## Discovery Summaries and Keyword Quality Status (Story 6.2.5)

High-value phase-1 registry anchors now include concise discovery-oriented summaries and keyword sets grounded in repository task-routing vocabulary and contributor workflows.

Enriched records in this story include:

- `docs/architecture/domain-and-application-core.md`
- `docs/architecture/architecture-domain-taxonomy.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/node-bootstrap-identity-operations.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/context/packs/repository-overview.pack.md`
- `docs/context/packs/architecture-core.pack.md`
- `docs/context/packs/runtime-and-host.pack.md`
- `docs/context/packs/identity-and-security.pack.md`
- `docs/context/packs/studio-and-system-composition.pack.md`
- `docs/context/packs/documentation-refactor.pack.md`
- `docs/documentation-migration-baseline.md`

Summary and keyword text now prioritizes retrieval cues used in this codebase: architecture-review, coding-implementation, diagnostics triage, runtime-security hardening, documentation-change routing, and migration traceability.

## Relationship Mapping Status (Story 6.2.6)

Selected high-value records now include curated relationship fields to improve practical next-hop navigation without creating a noisy, exhaustive graph.

Relationship mapping in this story connects registry entries to:

- Adjacent code paths most likely to be edited next.
- Neighbor docs frequently needed for follow-on implementation and review.
- Upstream/downstream registry records through stable `relatedRecordIds`.

Priority records enriched in this story include:

- `docs/architecture/domain-and-application-core.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/node-bootstrap-identity-operations.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/context/packs/repository-overview.pack.md`
- `docs/context/packs/documentation-refactor.pack.md`
- `docs/documentation-migration-baseline.md`

Relationship lists remain bounded and deduplicated to preserve maintainability while improving follow-on discovery for contributors and AI routing.

## Human-Readable Index View Status (Story 6.3.1)

Registry discovery metadata now also feeds a concise navigation view for direct human browsing:

- Human view: `docs/context/documentation-index.md`
- AI view: `docs/context/documentation-index.ai.md`
- Generator script: `dev/scripts/generate-documentation-index-view.cjs`

The view is intentionally grouped around practical discovery dimensions only:

- `docType` for category routing
- `domain` for domain routing
- `status` for lifecycle routing

Alignment is enforced by generation + validation guardrails so the index does not diverge into a separate manually maintained source.

## Coverage Policy Contract

- `coveragePolicy` carries machine-readable inclusion/exclusion boundaries.
- Keep `requiredCategories`, `selectiveCategories`, and `excludedCategories` explicit.
- Use `categoryRules` to capture per-category representation and status/authority treatment.
- Human-readable rule semantics are defined in `documentation-index-coverage-rules.ai.md`.

## Non-Goals

- No full repository indexing pass in this story.
- No search ranking/embedding system.
- No complex per-team registry schema variants.
- No replacement of path references where direct file resolution is needed.

## Guardrails

- `dev/tests/DocumentationRegistryStructureGuardrails.test.ts`
- `dev/tests/DocumentationRegistryAuthoringPatternsStory616Guardrails.test.ts`
- `dev/scripts/validate-docs-foundation.cjs`

## Authoring Starter Patterns (Story 6.1.6)

Use starter JSON patterns in `docs/context/templates/` when creating/updating registry `entries`:

- `documentation-registry-entry.template.json` (generic scaffold)
- `documentation-registry-entry.architecture.template.json`
- `documentation-registry-entry.adr.template.json`
- `documentation-registry-entry.context-pack.template.json`

Starters are examples only. Replace values before merge and preserve:

- Stable `recordId` format (`doc-...`, lowercase kebab-case)
- Required metadata fields from `documentation-indexed-document-metadata.contract.json`
- Coverage-aware `docType`, `domain`, `status`, and `authoritativeness`
