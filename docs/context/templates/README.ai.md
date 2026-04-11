# AI Companion: Documentation Templates

Use this folder as the canonical template pack for doc creation.

## Routing

- Pick template by exact `doc_type` value.
- Route destination folder with `docs/contributors/docs-placement-guide.md`.
- Do not keep placeholders in merged docs.

## Template Set

- `architecture-overview` -> [architecture-overview.template.md](./architecture-overview.template.md)
- `architecture-reference` -> [architecture-reference.template.md](./architecture-reference.template.md)
- `contributor-guide` -> [contributor-guide.template.md](./contributor-guide.template.md)
- `runbook` -> [runbook.template.md](./runbook.template.md)
- `baseline` -> [baseline.template.md](./baseline.template.md)
- `adr` -> [adr.template.md](./adr.template.md)
- `ai-context` -> [ai-context.template.md](./ai-context.template.md)
- AI companions are colocated as `*.template.ai.md`.

## Metadata Anchor

Required header keys are defined in `docs/context/documentation-metadata-header.contract.json`.
