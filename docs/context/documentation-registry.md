---
title: Documentation Registry Structure
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

# Documentation Registry Structure (Story 6.1.3)

This document defines the initial machine-readable documentation registry structure for AI Loom Studio.

## Purpose

Provide a durable, human-auditable JSON registry landing point for indexed documentation records so contributors and AI systems can find authoritative docs by stable metadata instead of folder guessing.

## Canonical Registry Assets

- Human-readable guide: `docs/context/documentation-registry.md`
- AI-readable guide: `docs/context/documentation-registry.ai.md`
- Machine-readable seed registry: `docs/context/documentation-registry.seed.json`

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

## Entry Model

Each entry must include:

- Stable identifier: `recordId`
- Metadata contract required fields: `path`, `title`, `docType`, `domain`, `status`, `authoritativeness`, `summary`

Optional fields such as `keywords`, `relatedDocs`, `relatedCodePaths`, `owner`, `lastReviewed`, and `aiPath` are used for findability and routing precision.

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

## Extensibility Boundaries

- Keep structure explicit and readable; avoid introducing a large platform abstraction.
- Add entries incrementally as docs are curated.
- Preserve stable `recordId` values once introduced.
- Keep registry entries aligned with `documentation-indexed-document-metadata.contract.json`.

## Validation

- Guardrail test: `dev/tests/DocumentationRegistryStructureGuardrails.test.ts`
- Foundation validator: `dev/scripts/validate-docs-foundation.cjs`
