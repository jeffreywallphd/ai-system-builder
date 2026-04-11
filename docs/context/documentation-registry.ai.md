---
title: "AI Companion: Documentation Registry Structure"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-index-coverage-rules.ai.md
  - docs/context/documentation-indexed-document-metadata.contract.json
  - docs/context/documentation-identity-and-reference.contract.json
  - docs/context/templates/documentation-registry-entry.template.json
  - docs/context/templates/documentation-registry-entry.architecture.template.json
  - docs/context/templates/documentation-registry-entry.adr.template.json
  - docs/context/templates/documentation-registry-entry.context-pack.template.json
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationRegistryStructureGuardrails.test.ts
  - dev/tests/DocumentationRegistryAuthoringPatternsStory616Guardrails.test.ts
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
