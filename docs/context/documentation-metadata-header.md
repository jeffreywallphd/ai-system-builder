# Standard Documentation Metadata Header Contract (Story 1.2.2)

This document defines the canonical metadata header contract for markdown docs in AI Loom Studio.

## Purpose

Make document identity, ownership, lifecycle, and authority explicit so documentation is readable by humans and enforceable by automation.

## Chosen Format

- Representation: YAML frontmatter.
- Delimiters: `---` opening and closing markers.
- Placement: the first block in each markdown file, before the `#` title.
- Reasoning: this is human-readable, straightforward to lint/parse, and widely supported by static analysis and indexing tools.

## Canonical Contract Sources

- Machine-readable contract: `docs/context/documentation-metadata-header.contract.json`
- Human-readable taxonomy values: `docs/context/documentation-taxonomy.md`

## Required Fields

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `title` | Yes | `string` | Canonical document title used for navigation and retrieval labels. |
| `doc_type` | Yes | `enum` | Document role in the docs taxonomy. Mirrors taxonomy `document_type` values. |
| `status` | Yes | `enum` | Lifecycle state (`draft`, `active`, `deprecated`, `superseded`, `archived`). |
| `authoritativeness` | Yes | `enum` | Authority level (`canonical`, `reference`, `supplemental`, `historical`). |
| `owned_by` | Yes | `string` | Team or maintainer accountable for accuracy and review cadence. |
| `last_reviewed` | Yes | `YYYY-MM-DD` | Most recent review date; must not be a future date at validation time. |

## Optional Fields

| Field | Required | Type | Semantics |
| --- | --- | --- | --- |
| `related_code_paths` | No | `string[]` | Repo-relative paths for code governed or explained by the document. |
| `supersedes` | No | `string` | Repo-relative path of an older doc replaced by this one. |
| `superseded_by` | No | `string` | Repo-relative path of the replacement document. |

## Cross-Field Rules

- `supersedes` and `superseded_by` cannot both be set.
- If `status: superseded`, `superseded_by` is required.
- `last_reviewed` must not be later than the validation date.

## Header Template

```yaml
---
title: <document title>
doc_type: <taxonomy document type>
status: <draft|active|deprecated|superseded|archived>
authoritativeness: <canonical|reference|supplemental|historical>
owned_by: <team or maintainer>
last_reviewed: <YYYY-MM-DD>
related_code_paths:
  - <optional repo-relative path>
supersedes: <optional repo-relative doc path>
superseded_by: <optional repo-relative doc path>
---
```

## Examples For Common Document Types

### Architecture-overview example

```yaml
---
title: Desktop Host Architecture Overview
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/hosts/desktop
  - src/composition
---
```

### Architecture-reference example

```yaml
---
title: Workspace Domain Contracts
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:workspace-core
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/workspaces
  - src/application/workspaces
---
```

### Contributor-guide example

```yaml
---
title: Run Submission Contributor Guide
doc_type: contributor-guide
status: active
authoritativeness: reference
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/run-submission
---
```

### Runbook example

```yaml
---
title: Secret Metadata Management Operations
doc_type: runbook
status: active
authoritativeness: canonical
owned_by: team:operations-security
last_reviewed: 2026-04-11
related_code_paths:
  - src/infrastructure/secrets
---
```

### ADR example

```yaml
---
title: ADR-003 Event Log Persistence Strategy
doc_type: adr
status: superseded
authoritativeness: historical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
superseded_by: docs/adr/adr-004-event-log-storage-engine.md
---
```

### Baseline example

```yaml
---
title: Documentation Migration Baseline
doc_type: baseline
status: archived
authoritativeness: historical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/documentation-migration-baseline.inventory.json
---
```

### AI-context example

```yaml
---
title: Canonical Documentation Taxonomy
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/documentation-taxonomy.contract.json
---
```

## Enforcement

- Guardrail test: `dev/tests/DocumentationMetadataHeaderGuardrails.test.ts`
- Seed backfill guardrail: `dev/tests/DocumentationMetadataSeedBackfillGuardrails.test.ts`
- Keep field definitions synchronized with `documentation-metadata-header.contract.json`.

## Seed Reference Implementations (Story 1.2.4)

The following existing high-value docs are backfilled to serve as early reference implementations for future migration work:

- `docs/architecture/README.md` (`architecture-overview`)
- `docs/architecture/domain-and-application-core.md` (`architecture-reference`)
- `docs/unified-api-contributor-guide.md` (`contributor-guide`)
- `docs/security-policy-configuration-operations.md` (`runbook`)
- `docs/documentation-migration-baseline.md` (`baseline`)
- `docs/context/documentation-taxonomy.md` (`ai-context`)
