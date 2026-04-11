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
- `adr` -> [adr.template.md](./adr.template.md) (place output in `docs/adr/records/`)
- `ai-context` -> [ai-context.template.md](./ai-context.template.md)
- `ai-context` pack contract -> [context-pack.template.md](./context-pack.template.md)
- Routing entry JSON -> [task-to-context-routing-entry.template.json](./task-to-context-routing-entry.template.json)
- AI companions are colocated as `*.template.ai.md` for markdown templates.

For pack files in `docs/context/packs/`, also apply `docs/context/packs/README.ai.md#standard-context-pack-contract` for required section layout.

## ADR Template Contract

- Required sections: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional sections: `Supersession` and `Follow-Up Actions` (`Supersession` is required when replacement links are present).
- ADR metadata and lifecycle anchors: required `adr_number`, required `decision_status` (`proposed`, `accepted`, `superseded`, `deprecated`), required `decision_date`, and title format `ADR-<NNN> <Decision Title>`.
- ADR writing quality guidance (problem framing, alternatives, tradeoff honesty): `docs/adr/records/authoring-guide.ai.md`.

## Metadata Anchor

Required header keys are defined in `docs/context/documentation-metadata-header.contract.json`.
