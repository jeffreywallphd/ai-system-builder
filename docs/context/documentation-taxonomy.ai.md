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
