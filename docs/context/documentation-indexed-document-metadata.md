# Standard Indexed Document Metadata Contract (Story 6.1.2)

This document defines the standard metadata contract for indexed documentation records in AI Loom Studio.

## Purpose

Provide a lightweight, stable record shape for documentation indexing so humans and AI systems can discover authoritative docs by intent without broad folder scans.

## Canonical Contract Sources

- Human-readable: `docs/context/documentation-indexed-document-metadata.md`
- AI-readable: `docs/context/documentation-indexed-document-metadata.ai.md`
- Machine-readable: `docs/context/documentation-indexed-document-metadata.contract.json`
- Identity conventions: `docs/context/documentation-identity-and-reference-conventions.md`
- Registry seed consumer: `docs/context/documentation-registry.seed.json`

## Scope

This contract is for documentation index entries (registry records), not markdown frontmatter headers.

- For markdown file headers, use `docs/context/documentation-metadata-header.md`.
- For taxonomy value semantics, use `docs/context/documentation-taxonomy.md`.

## Required Metadata Fields

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `path` | Yes | `string` | Canonical repo-relative path to the human-readable markdown doc (`.md`). |
| `title` | Yes | `string` | Retrieval-friendly title for index display and query matching. |
| `docType` | Yes | `enum` | Document role. Must use taxonomy `document_type` values. |
| `domain` | Yes | `string` | Primary domain scope for routing (for example, `identity-and-security`). |
| `status` | Yes | `enum` | Lifecycle state used to filter active vs historical guidance. |
| `authoritativeness` | Yes | `enum` | Authority level used for source preference decisions. |
| `summary` | Yes | `string` | Short intent summary used for quick routing and context assembly hints. |

## Optional Metadata Fields

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `keywords` | No | `string[]` | Small stable set of search terms for findability. |
| `relatedCodePaths` | No | `string[]` | Canonical repo paths for directly related implementation code. |
| `relatedDocs` | No | `string[]` | Canonical repo paths for tightly related docs to follow next. |
| `relatedRecordIds` | No | `string[]` | Stable registry `recordId` references for durable cross-document linking. |
| `owner` | No | `string` | Owning team or maintainer for review/routing accountability. |
| `lastReviewed` | No | `YYYY-MM-DD` | Most recent review date when recency signals are needed. |
| `aiPath` | No | `string` | Repo-relative path to AI companion variant (`.ai.md`) when present. |
| `supersedes` | No | `string` | Repo-relative path to a prior indexed doc replaced by this doc. |
| `supersededBy` | No | `string` | Repo-relative path to the replacement doc for superseded entries. |

## Cross-Field Rules

- `path` must target a markdown file and should be repo-relative under `docs/`.
- If `aiPath` is set, it must target a `.ai.md` file.
- `docType`, `status`, and `authoritativeness` must match taxonomy enums.
- `keywords`, `relatedCodePaths`, and `relatedDocs` should stay concise and canonical.
- `relatedRecordIds` values must reference existing registry entry `recordId` values when used.
- If a `relatedDocs` path points to another indexed entry path, include that entry's `recordId` in `relatedRecordIds`.
- `supersedes` and `supersededBy` cannot both be set.
- If `status` is `superseded`, `supersededBy` is required.
- If `lastReviewed` is set, it must not be a future date at validation time.

## Example Indexed Record

```json
{
  "path": "docs/context/documentation-indexing-model.md",
  "aiPath": "docs/context/documentation-indexing-model.ai.md",
  "title": "Documentation Indexing Model and Goals",
  "docType": "ai-context",
  "domain": "documentation",
  "status": "active",
  "authoritativeness": "canonical",
  "summary": "Defines indexing goals and boundaries for documentation discovery.",
  "keywords": ["indexing", "findability", "routing"],
  "relatedCodePaths": ["dev/scripts/validate-docs-foundation.cjs"],
  "relatedRecordIds": ["doc-context-documentation-taxonomy"],
  "relatedDocs": [
    "docs/context/documentation-taxonomy.md",
    "docs/context/documentation-metadata-header.md"
  ],
  "owner": "team:developer-experience",
  "lastReviewed": "2026-04-11"
}
```

## Why This Contract Stays Lightweight

- Uses only stable discovery signals needed for query, routing, and authority filtering.
- Defers scoring/ranking heuristics and full-text search concerns to future systems.
- Keeps optional fields narrow so contributors can maintain records with low overhead.

## Enforcement

- Guardrail test: `dev/tests/DocumentationIndexedDocumentMetadataContractGuardrails.test.ts`
- Foundation validator: `dev/scripts/validate-docs-foundation.cjs`
