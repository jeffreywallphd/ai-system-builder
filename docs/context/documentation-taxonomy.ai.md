---
title: "AI Companion: Canonical Documentation Taxonomy"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-taxonomy.contract.json
  - docs/context/documentation-metadata-header.contract.json
---

# AI Companion: Canonical Documentation Taxonomy (Story 1.2.1)

Use this file for exact docs-role classification and metadata tagging.

## Canonical Contract

- Human-readable spec: `docs/context/documentation-taxonomy.md`
- Machine-readable contract: `docs/context/documentation-taxonomy.contract.json`

## Required Metadata Fields

- `document_type` (role)
- `authoritativeness` (authority)
- `status` (lifecycle)

## Allowed Values

- `document_type`: `architecture-overview`, `architecture-reference`, `contributor-guide`, `runbook`, `adr`, `baseline`, `ai-context`
- `authoritativeness`: `canonical`, `reference`, `supplemental`, `historical`
- `status`: `draft`, `active`, `deprecated`, `superseded`, `archived`

Header key mapping: the metadata header contract uses `doc_type` as the frontmatter key for `document_type`.

## Type Intent Summary

- `architecture-overview`: top-level architecture boundaries and durable shape.
- `architecture-reference`: detailed subsystem contracts and invariants.
- `contributor-guide`: implementation workflows and change guardrails.
- `runbook`: runtime/admin operations and troubleshooting.
- `adr`: decision record with alternatives and rationale.
- `baseline`: historical migration or completion snapshot.
- `ai-context`: shared taxonomy/context pack for cross-domain reasoning.

## Guardrail

- Validation test: `dev/tests/DocumentationTaxonomyGuardrails.test.ts`.
