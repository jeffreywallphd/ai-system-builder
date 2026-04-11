# Documentation Top-Level Contract (Story 1.1.2)

This file defines the durable top-level documentation information architecture for AI Loom Studio.

## Folder responsibilities

| Folder | Purpose | Belongs here | Does not belong here |
| --- | --- | --- | --- |
| `docs/architecture/` | Canonical architecture baselines and system design contracts. | Layer boundaries, cross-feature architecture decisions, architecture reference docs. | Step-by-step operations, contributor process checklists, temporary migration notes. |
| `docs/contributors/` | Contributor-facing extension and implementation workflow guides. | How-to guides for extending features safely, contributor guardrails, coding workflow docs. | Operational runbooks, ADR decisions, architecture internals as primary content. |
| `docs/operations/` | Runtime operations and support procedures. | Runbooks, troubleshooting, operational diagnostics, admin workflows. | Architecture contracts, feature design rationale, ADR decision records. |
| `docs/baselines/` | Historical milestone snapshots and migration baselines. | Story/epic baselines, migration inventories, completion snapshots. | Current canonical operational or contributor instructions. |
| `docs/adr/` | Architecture Decision Records and supersession history. | ADRs with status and rationale, decision alternatives, superseded decisions. | General architecture reference docs without a decision record. |
| `docs/context/` | Shared domain context that supports both humans and AI assistants. | Taxonomy overviews, glossary/context packs, cross-domain navigation context. | Operational runbooks or implementation-only contributor workflows. |
| `docs/prompts/` | Prompt templates and prompt-facing operational helpers. | Prompt docs used during engineering workflows. | Product architecture decisions and runtime operations guidance. |
| `docs/ui/` | UI-specific behavior and UX implementation notes. | UI contracts, frontend behavior guides, UX state conventions. | Non-UI architecture baselines and system operations runbooks. |

## Routing rule

When adding a new document, choose the folder whose purpose is the document's primary role. If a doc spans roles, prefer the strictest authoritative home and link to it from related folders.

## Guardrails

- `dev/tests/DocsTopLevelContractGuardrails.test.ts` enforces required folders and router contract sections.
- `dev/tests/DocumentationMigrationBaselineGuardrails.test.ts` enforces inventory synchronization for all docs markdown files.
