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
- Segmentation seed snippets -> [documentation-segmentation-seeds.template.md](./documentation-segmentation-seeds.template.md)
- Routing entry JSON -> [task-to-context-routing-entry.template.json](./task-to-context-routing-entry.template.json)
- Registry entry starter JSON -> [documentation-registry-entry.template.json](./documentation-registry-entry.template.json)
- Registry architecture example -> [documentation-registry-entry.architecture.template.json](./documentation-registry-entry.architecture.template.json)
- Registry ADR example -> [documentation-registry-entry.adr.template.json](./documentation-registry-entry.adr.template.json)
- Registry context-pack example -> [documentation-registry-entry.context-pack.template.json](./documentation-registry-entry.context-pack.template.json)
- AI companions are colocated as `*.template.ai.md` for markdown templates.

Use `docs/context/documentation-status-signals.ai.md` for the standard non-active status marker wording.

For pack files in `docs/context/packs/`, also apply `docs/context/packs/README.ai.md#standard-context-pack-contract` for required section layout.

## ADR Template Contract

- Required sections: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional sections: `Supersession` and `Follow-Up Actions` (`Supersession` is required when replacement links are present).
- ADR metadata and lifecycle anchors: required `adr_number`, required `decision_status` (`proposed`, `accepted`, `superseded`, `deprecated`), required `decision_date`, and title format `ADR-<NNN> <Decision Title>`.
- ADR writing quality guidance (problem framing, alternatives, tradeoff honesty): `docs/adr/records/authoring-guide.ai.md`.
- ADR cross-linking expectations: use `Related Documentation` to link architecture docs, related ADRs, and context assets (packs/routing) that should carry decision context.

## Architecture Template ADR Backlinks

- `architecture-overview.template.md` and `architecture-reference.template.md` include `## Related ADRs`.
- Use `## Related ADRs` to link back to ADR records that define the architecture constraints.

## Metadata Anchor

Required header keys are defined in `docs/context/documentation-metadata-header.contract.json`.
Registry entry starters align with `docs/context/documentation-indexed-document-metadata.contract.json` and `recordId` conventions from `docs/context/documentation-identity-and-reference.contract.json`.
