---
title: Documentation Registry Structure
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-index.md
  - docs/context/documentation-index-coverage-rules.md
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

# Documentation Registry Structure (Story 6.1.3)

This document defines the initial machine-readable documentation registry structure for AI Loom Studio.

## Purpose

Provide a durable, human-auditable JSON registry landing point for indexed documentation records so contributors and AI systems can find authoritative docs by stable metadata instead of folder guessing.

## Canonical Registry Assets

- Human-readable guide: `docs/context/documentation-registry.md`
- AI-readable guide: `docs/context/documentation-registry.ai.md`
- Machine-readable seed registry: `docs/context/documentation-registry.seed.json`
- Identity and reference conventions: `docs/context/documentation-identity-and-reference-conventions.md`

## Scope

This story creates the structure and a small seed set. It does not attempt full repository population or ranking/search infrastructure.

## Registry Top-Level Shape

The registry includes:

- `schemaVersion` and `artifactType` for compatibility and parsing.
- Contract references to indexed-metadata and taxonomy standards.
- Explicit catalogs (`docTypeCatalog`, `statusCatalog`, `authoritativenessCatalog`) for deterministic validation.
- `domainRelationships` for cross-domain navigation hints.
- `entries` as stable indexed records with `recordId` and metadata-contract fields.
- `discoveryIndex` maps for practical retrieval (`byDocType`, `byStatus`, `byDomain`, `byAuthoritativeness`).
- `coveragePolicy` for machine-readable inclusion, selective indexing, and exclusion boundaries.

## Entry Model

Each entry must include:

- Stable identifier: `recordId`
- Metadata contract required fields: `path`, `title`, `docType`, `domain`, `status`, `authoritativeness`, `summary`

Optional fields such as `keywords`, `relatedDocs`, `relatedCodePaths`, `owner`, `lastReviewed`, and `aiPath` are used for findability and routing precision.
For durable cross-artifact linking, entries may use `relatedRecordIds` in addition to path-based relationships.

## Coverage Policy

Coverage boundaries are intentionally explicit so the registry stays high-signal:

- `requiredCategories`: categories that must be represented with index records when active docs exist.
- `selectiveCategories`: categories indexed only by curated anchor records.
- `excludedCategories`: categories that should not be represented as standalone registry entries.
- `categoryRules`: per-category treatment including expected status/authoritativeness and representation notes.

Canonical rule semantics live in `docs/context/documentation-index-coverage-rules.md`.

## Seed Coverage Expectations

The seed registry should represent major document categories:

- `architecture-overview`
- `architecture-reference`
- `contributor-guide`
- `runbook`
- `adr`
- `baseline`
- `ai-context`

It should also include status and authoritativeness indexes, even when some categories are initially empty.

## Population Planning Input (Story 6.2.1)

Use `docs/documentation-registry-population-inventory.md` and
`docs/documentation-registry-population-inventory.inventory.json` as the practical target set and ordering input for incremental registry-entry population work.

## Active Architecture Population Status (Story 6.2.2)

The registry seed now includes active architecture domain coverage for:

- `docs/architecture/architecture-domain-taxonomy.md`
- Architecture routing/governance references:
  `architecture-domain-migration-inventory.md`,
  `architecture-migration-sequence-and-priority.md`,
  `architecture-domainization-rollout-boundaries.md`,
  `architecture-supersession-and-retirement-governance.md`,
  `architecture-document-scope-boundaries.md`,
  `architecture-domain-cross-linking-rules.md`
- Domain overviews under `docs/architecture/domains/*/overview.md`

These entries are indexed in `discoveryIndex` and linked into task routing records through `relatedDocRecordIds` in `docs/context/routing/task-to-context-routing.seed.json` for architecture-oriented retrieval.

## ADR, Context Pack, and Contributor Population Status (Story 6.2.3)

The registry seed now extends beyond architecture-only coverage and includes:

- Full current ADR set under `docs/adr/records/adr-00*.md` (`ADR-001` through `ADR-006`) as `docType: adr` with explicit lifecycle and authority metadata.
- Context-pack anchors under `docs/context/packs/*.pack.md` as `docType: ai-context` with category-appropriate `authoritativeness` (`canonical` or `supplemental`).
- Key contributor-guidance anchors for implementation quality, context engineering, and onboarding, including:
  - `docs/contributors/context-engineering-system-guide.md`
  - `docs/contributors/docs-foundation-validation.md`
  - `docs/contributors/docs-migration-safety-guide.md`
  - `docs/contributors/adr-informed-implementation-and-review-examples.md`

Discovery mappings are also extended so documentation refactor routes in
`docs/context/routing/task-to-context-routing.seed.json` can resolve these registry entries through `relatedDocRecordIds` rather than path-only matching.

## Operations, Baseline, and Historical Population Status (Story 6.2.4)

Registry seed coverage now includes selective high-value operations and non-active documentation entries with explicit lifecycle and authority metadata:

- Additional operations runbooks under `docs/*.md` are indexed as `docType: runbook` in the `operations` domain:
  - `docs/security-policy-configuration-operations.md`
  - `docs/secret-health-and-operational-diagnostics.md`
  - `docs/workspace-administration-operations.md`
  - `docs/storage-administration-operations.md`
- Selective baseline anchors are indexed under `docType: baseline` with `authoritativeness: historical`:
  - `docs/documentation-migration-baseline.md`
  - `docs/documentation-segmentation-migration-inventory.md`
  - `docs/baselines/feature-1-documentation-foundation-handoff.md`
- Superseded architecture stubs are indexed explicitly as historical redirect records:
  - `docs/architecture/presentation-and-state.md`
  - `docs/architecture/shared-asset-contracts.md`
  - `docs/architecture/workflow-execution-and-tools.md`

To prevent non-active material from competing silently with active guidance, these records are intentionally separated in `discoveryIndex.byStatus` (`active`, `archived`, `superseded`) and `discoveryIndex.byAuthoritativeness` (`historical`).

Runtime diagnostics and runtime-security routing records now include stable `relatedDocRecordIds` for operations runbooks so discovery can resolve authoritative operations guidance through record identifiers instead of brittle path guessing.

## Discovery Summaries and Keyword Quality Status (Story 6.2.5)

High-value phase-1 registry anchors now include concise discovery-oriented summaries and keyword sets aligned to actual task-routing vocabulary and contributor workflows.

Priority records enriched in this story include:

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

Summary and keyword wording now emphasizes practical retrieval signals used in this repository, including architecture review, coding implementation, diagnostics triage, runtime security hardening, documentation change workflows, and migration traceability.

## Relationship Mapping Status (Story 6.2.6)

Selected high-value entries now carry curated relationship links for practical next-hop discovery without turning the registry into an exhaustive graph.

Relationship curation in this story links documentation records to:

- Adjacent code ownership paths contributors typically touch next.
- Neighbor docs commonly needed for implementation follow-through.
- Upstream/downstream registry records that preserve stable-key navigation.

Priority records with enriched relationship mapping include:

- `docs/architecture/domain-and-application-core.md`
- `docs/contributors/docs-placement-guide.md`
- `docs/node-bootstrap-identity-operations.md`
- `docs/adr/records/adr-001-single-authoritative-control-plane.md`
- `docs/context/packs/repository-overview.pack.md`
- `docs/context/packs/documentation-refactor.pack.md`
- `docs/documentation-migration-baseline.md`

Relationship lists remain intentionally bounded and deduplicated so follow-on navigation improves while long-term maintenance stays lightweight.

## Human-Readable Index View Status (Story 6.3.1)

Registry discovery data now powers a concise contributor-facing navigation view:

- Human-readable view: `docs/context/documentation-index.md`
- AI companion view: `docs/context/documentation-index.ai.md`
- Generator: `dev/scripts/generate-documentation-index-view.cjs`

The index is intentionally navigation-focused and grouped by:

- `docType` (category browsing)
- `domain` (domain browsing)
- `status` (lifecycle browsing)

To keep the view aligned with the machine-readable registry and avoid manual drift, regenerate it whenever `documentation-registry.seed.json` changes and run the docs foundation validator plus Story 6.3.1 guardrail tests.

## Extensibility Boundaries

- Keep structure explicit and readable; avoid introducing a large platform abstraction.
- Add entries incrementally as docs are curated.
- Preserve stable `recordId` values once introduced.
- Keep `recordId` values in `doc-...` lowercase kebab-case and do not change them for path moves.
- Keep registry entries aligned with `documentation-indexed-document-metadata.contract.json`.

## Validation

- Guardrail test: `dev/tests/DocumentationRegistryStructureGuardrails.test.ts`
- Guardrail test: `dev/tests/DocumentationRegistryAuthoringPatternsStory616Guardrails.test.ts`
- Foundation validator: `dev/scripts/validate-docs-foundation.cjs`

## Registry Entry Authoring Starters (Story 6.1.6)

To reduce index-maintenance friction, use the starter patterns in `docs/context/templates/` when adding or updating `entries` in `documentation-registry.seed.json`.

- Generic scaffold: `documentation-registry-entry.template.json`
- Architecture doc example: `documentation-registry-entry.architecture.template.json`
- ADR example: `documentation-registry-entry.adr.template.json`
- Context pack example: `documentation-registry-entry.context-pack.template.json`

Starter patterns are examples, not source-of-truth entries. Replace all values before merge and keep:

- `recordId` stable, lowercase kebab-case, and prefixed with `doc-`.
- Required metadata fields aligned with `documentation-indexed-document-metadata.contract.json`.
- Category-specific `docType`, `domain`, and authority/status values aligned with coverage policy intent.
