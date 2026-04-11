# AI Companion: Standard Indexed Document Metadata Contract (Story 6.1.2)

Use this file for the canonical metadata shape of documentation index entries.

## Canonical Sources

- Human-readable: `docs/context/documentation-indexed-document-metadata.md`
- AI-readable: `docs/context/documentation-indexed-document-metadata.ai.md`
- Machine-readable: `docs/context/documentation-indexed-document-metadata.contract.json`
- Registry seed consumer: `docs/context/documentation-registry.seed.json`

## Required Fields

- `path`
- `title`
- `docType`
- `domain`
- `status`
- `authoritativeness`
- `summary`

## Optional Fields

- `keywords`
- `relatedCodePaths`
- `relatedDocs`
- `owner`
- `lastReviewed`
- `aiPath`
- `supersedes`
- `supersededBy`

## Contract Rules

- `path` points to canonical human `.md` documentation.
- `aiPath` is optional and must point to `.ai.md` when set.
- `docType`, `status`, and `authoritativeness` use taxonomy enums.
- `supersedes` and `supersededBy` are mutually exclusive.
- `status: superseded` requires `supersededBy`.
- `lastReviewed` is optional; when present it must be `YYYY-MM-DD` and not in the future.

## Intended Use

- Registry and indexing records for architecture, ADR, contributor, operations, context, baseline, and historical docs.
- Lightweight discovery and routing metadata for context-engineering workflows.
- Consistent entry shape for future documentation registry creation.

## Guardrails

- `dev/tests/DocumentationIndexedDocumentMetadataContractGuardrails.test.ts`
- `dev/scripts/validate-docs-foundation.cjs`
