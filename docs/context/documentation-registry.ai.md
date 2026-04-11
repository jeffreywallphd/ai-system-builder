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
  - dev/scripts/validate-documentation-registry.cjs
  - dev/scripts/generate-documentation-index-view.cjs
  - dev/tests/DocumentationRegistryStructureGuardrails.test.ts
  - dev/tests/DocumentationRegistryValidationScript.test.ts
  - dev/tests/DocumentationIndexViewStory631Guardrails.test.ts
  - dev/tests/DocumentationTaskDiscoveryPathsStory632Guardrails.test.ts
  - dev/tests/DocumentationRegistryAuthoringPatternsStory616Guardrails.test.ts
  - dev/tests/DocumentationRegistryAdrContextContributorStory623Guardrails.test.ts
  - dev/tests/DocumentationRegistryOperationsBaselinesHistoricalStory624Guardrails.test.ts
  - dev/tests/DocumentationRegistryDiscoverySummariesKeywordsStory625Guardrails.test.ts
  - dev/tests/DocumentationRegistryRelationshipsStory626Guardrails.test.ts
  - dev/tests/DocumentationRegistryCrossReferenceValidationStory642Guardrails.test.ts
  - dev/tests/DocumentationRegistryMaintenanceReviewStory643Guardrails.test.ts
  - dev/tests/DocumentationRegistryContextRoutingIntegrationStory633Guardrails.test.ts
  - dev/tests/DocumentationIndexContributorDailyUsageStory634Guardrails.test.ts
  - dev/tests/DocumentationIndexAssistedDiscoveryWorkedExamplesStory635Guardrails.test.ts
  - docs/contributors/documentation-index-daily-usage-guide.ai.md
  - docs/contributors/documentation-index-assisted-discovery-worked-examples.ai.md
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

## Task-Oriented Discovery Paths Status (Story 6.3.2)

The registry now includes task-oriented discovery paths that reuse the existing routing/context task model rather than creating a competing classification layer.

Task discovery is represented by:

- `discoveryIndex.byTaskCategory`: curated registry record sets by routing task category.
- `taskRoutingIndex`: route hints that link task categories to canonical routing/context assets.

`taskRoutingIndex` stays explicit and validator-friendly:

- `routingSeedPath`: `docs/context/routing/task-to-context-routing.seed.json`
- `contextMapPath`: `docs/context/context-map.json`
- `routeHintsByTaskCategory`: per-category route task IDs, context-map mapping IDs, and default selection/priority/profile hints.

The generated documentation index now exposes a task-workflow section for architecture review, feature decomposition, coding implementation, runtime diagnostics, runtime security changes, and documentation refactor work.

## Context Routing and Pack Selection Integration Status (Story 6.3.3)

Registry record identifiers now act as the required stable-link layer for routing and pack-selection assets so task guidance resolves indexed authority through record IDs rather than path-only matching.

Integration scope in this story:

- Active routing mappings in `docs/context/routing/task-to-context-routing.seed.json` include required `relatedDocRecordIds`.
- Routing worked examples include `relatedDocRecordIds` whenever `expectedRelatedDocOrder` includes registry-indexed docs.
- Context pack catalog entries in `docs/context/packs/context-pack-catalog.seed.json` include `relatedDocRecordIds` coverage for indexed `primaryDocPath` and indexed `relatedDocPaths`.
- Foundation validation (`dev/scripts/validate-docs-foundation.cjs`) enforces path-to-recordId alignment for indexed docs across routing and pack assets.

This preserves the registry as the single durable identity source while keeping routing and pack selection explicit and lightweight.

## Contributor Index Usage Guidance Status (Story 6.3.4)

Contributor guidance now makes index usage an explicit day-to-day workflow instead of an implicit side artifact.

Story 6.3.4 adds:

- `docs/contributors/documentation-index-daily-usage-guide.ai.md` for practical index-first contributor/AI routines.
- Router links from `docs/contributors/README.ai.md` and `docs/architecture/README.ai.md` for normal navigation discoverability.
- Workflow integration in `docs/contributors/context-engineering-system-guide.ai.md` so prompt assembly remains index-first and metadata-aware.

Core boundary reinforced:

- Index -> findability and candidate selection.
- Metadata (`status`, `authoritativeness`) + active canonical docs -> implementation authority.

When indexed results include historical records, treat them as evidence-only, follow supersession/redirect targets, and confirm current behavior from active canonical sources before implementation work.

## Worked Index-Assisted Discovery Examples Status (Story 6.3.5)

Story 6.3.5 makes index usage operational for real repository tasks by adding worked retrieval examples that explicitly connect:

- index discovery surfaces (`Browse by Task Workflow`, `Browse by Domain`, `Browse by Status`)
- routing integration (`taskId` and `relatedDocRecordIds` in `task-to-context-routing.seed.json`)
- taxonomy/authority validation (`status`, `authoritativeness`, active-canonical precedence)

Added guide:

- `docs/contributors/documentation-index-assisted-discovery-worked-examples.ai.md`

Task coverage in the examples:

- architecture review
- documentation refactor
- feature decomposition
- runtime troubleshooting
- security-sensitive changes

This keeps the registry/index useful as an active discovery-and-routing layer instead of passive metadata.

## Cross-Reference Validation Status (Story 6.4.2)

Story 6.4.2 adds lightweight registry cross-reference checks so high-value relationships remain trustworthy as documentation paths evolve.

Validation now enforces:

- Indexed `path` and `aiPath` entries resolve to real repository files.
- If a `relatedDocs` value points to another indexed registry path, the matching stable identifier must also exist in `relatedRecordIds`.
- Existing path checks still detect broken `relatedCodePaths`, `supersedes`, and `supersededBy` references.

Run:

- `npm run docs:validate:registry`

Cross-reference mismatches emit:

- `REGISTRY_CROSS_REFERENCE_INVALID`

## Registry Maintenance and Review Expectations Status (Story 6.4.3)

Story 6.4.3 defines lightweight registry-maintenance expectations so discovery metadata stays trustworthy without adding high-overhead governance.

### When Registry Entries Must Be Updated

Update the affected registry records in the same change set when any of these occur:

- Indexed document path moves (`path` and `aiPath`), split/merge outcomes, or redirect-stub introductions.
- Lifecycle/authority transitions (`status`, `authoritativeness`, `supersededBy`, `supersedes`).
- Discovery metadata changes with retrieval impact (`title`, `summary`, `keywords`, `relatedDocs`, `relatedRecordIds`, `relatedCodePaths`).
- Routing/context-pack linkage changes where indexed docs are added or removed from `relatedDocRecordIds`.

For wording-only edits that do not affect retrieval, lifecycle, or routing, registry edits are optional.

### How New Documentation Should Be Added to the Registry

Use this bounded add flow:

1. Confirm coverage eligibility using `coveragePolicy` and `documentation-index-coverage-rules.ai.md`.
2. Start from `docs/context/templates/documentation-registry-entry*.json`.
3. Add one stable `entries` record with `recordId` (`doc-...`, lowercase kebab-case) and required metadata-contract fields.
4. Update `discoveryIndex` membership (`byDocType`, `byStatus`, `byDomain`, `byAuthoritativeness`, and `byTaskCategory` when applicable).
5. Update routing/pack assets with `relatedDocRecordIds` when the new doc is part of documented workflows.
6. Run `npm run docs:validate:registry`; if discovery groupings changed, run `npm run docs:generate:index-view` and `npm run docs:validate:foundation`.

### Who Should Care About Stale Entries

`team:developer-experience` remains the registry owner, but stale-entry prevention is shared:

- Authors/story implementers update registry metadata when changing indexed docs.
- Reviewers treat stale or missing registry updates as blocking for changes that affect discovery, routing, or lifecycle state.
- Routing/context-pack maintainers keep `relatedDocRecordIds` aligned when mappings or pack associations change.

This keeps registry hygiene embedded in normal pull-request review instead of creating a separate maintenance workflow.

### Handling Superseded, Deprecated, and Historical Transitions

When a document is no longer current authority:

1. Preserve existing `recordId`; do not rotate IDs for the same lineage.
2. Move lifecycle state to `superseded`, `deprecated`, or `archived` and set `authoritativeness: historical` when implementation authority is retired.
3. Maintain `supersededBy`/`supersedes` links and resolvable redirect targets.
4. Keep `discoveryIndex.byStatus` and `byAuthoritativeness` aligned to non-active buckets while canonical replacements remain indexed as `active`.
5. Preserve historical discoverability for traceability while routing implementation decisions to active canonical records.

Use `documentation-status-signals.ai.md` and `documentation-supersession-and-redirect-conventions.ai.md` for content-level status markers while the registry carries machine-readable lifecycle state.

## Indexing Rollout Boundaries and Expansion Guidance Status (Story 6.4.4)

Story 6.4.4 closes Feature 6 with explicit rollout boundaries for indexing/findability so completion can be claimed without implying exhaustive day-one coverage.

Canonical guidance:

- `docs/context/governance/documentation-indexing-rollout-boundaries.ai.md`

Use this boundary note when triaging enhancement requests, separating current-scope fixes from follow-on deeper-search work, and keeping governance expectations explicit for contributors and AI assistants.

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
- `dev/scripts/validate-documentation-registry.cjs`
- `npm run docs:validate:registry`

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
