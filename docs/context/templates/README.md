# Documentation Templates

Use these templates when creating new canonical docs under the taxonomy defined in `docs/context/documentation-taxonomy.md`.

## Purpose

Provide lean, reusable starting points so document roles, metadata, and section structure stay consistent.

## How to Use

1. Choose the template by `doc_type`.
2. Copy it into the correct folder using `docs/contributors/docs-placement-guide.md`.
3. Replace placeholder values before merge.
4. Keep sections concise; remove sections that are not relevant.

## Template Index

| `doc_type` | Use when you are writing... | Primary placement | Template |
| --- | --- | --- | --- |
| `architecture-overview` | System boundaries and durable architecture shape. | `docs/architecture/` | [architecture-overview.template.md](./architecture-overview.template.md) |
| `architecture-reference` | Deep subsystem contracts, interfaces, and invariants. | `docs/architecture/` | [architecture-reference.template.md](./architecture-reference.template.md) |
| `contributor-guide` | Contributor implementation workflow and guardrails. | `docs/contributors/` | [contributor-guide.template.md](./contributor-guide.template.md) |
| `runbook` | Runtime/admin procedures and troubleshooting. | `docs/operations/` | [runbook.template.md](./runbook.template.md) |
| `baseline` | Historical migration or completion snapshot. | `docs/baselines/` | [baseline.template.md](./baseline.template.md) |
| `adr` | A specific architecture decision with alternatives and status. | `docs/adr/` | [adr.template.md](./adr.template.md) |
| `ai-context` | Shared taxonomy or context pack for AI/human routing. | `docs/context/` | [ai-context.template.md](./ai-context.template.md) |

For context packs under `docs/context/packs/`, follow the standard contract in `docs/context/packs/README.md#standard-context-pack-contract` in addition to the `ai-context` template.

## Metadata Contract Reminder

Every template uses the required metadata header keys from `docs/context/documentation-metadata-header.md`:

- `title`
- `doc_type`
- `status`
- `authoritativeness`
- `owned_by`
- `last_reviewed`

AI companion templates are colocated as `*.template.ai.md`.
