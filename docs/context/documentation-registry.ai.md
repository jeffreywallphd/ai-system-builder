---
title: "AI Companion: Documentation Registry Structure"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-registry.seed.json
  - docs/context/documentation-indexed-document-metadata.contract.json
  - dev/scripts/validate-docs-foundation.cjs
  - dev/tests/DocumentationRegistryStructureGuardrails.test.ts
---

# AI Companion: Documentation Registry Structure (Story 6.1.3)

Use this file for the canonical machine-readable documentation registry shape and maintenance boundaries.

## Canonical Sources

- Human-readable: `docs/context/documentation-registry.md`
- AI-readable: `docs/context/documentation-registry.ai.md`
- Machine-readable: `docs/context/documentation-registry.seed.json`

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

## Seed Coverage Rule

The seed registry includes at least one entry for each major `docType` so findability and routing can validate cross-category behavior from day one.

## Non-Goals

- No full repository indexing pass in this story.
- No search ranking/embedding system.
- No complex per-team registry schema variants.

## Guardrails

- `dev/tests/DocumentationRegistryStructureGuardrails.test.ts`
- `dev/scripts/validate-docs-foundation.cjs`
