# AI Companion: ADR Records Home

## Audience
- AI assistants creating or updating ADR files.
- Engineers checking ADR naming and supersession rules.

## Purpose
- Canonical ADR file location and indexing rules for decision records.

## ADR Record Contract
- Place all ADR decision files in this folder.
- Use `adr-<NNN>-<kebab-case-title>.md` for human docs and `adr-<NNN>-<kebab-case-title>.ai.md` for AI companions.
- Keep decision numbers unique and strictly increasing; never renumber historical ADRs.
- Keep supersession metadata and replacement links current when statuses change.
- Keep all required sections from the ADR template in each record.
- Use optional sections when relevant; treat `Supersession` as required whenever replacement links are involved.

## Authoring Guidance
- Apply [ADR Authoring Guide](./authoring-guide.ai.md) to keep ADRs concise, decision-first, and durable.
- Use the guide for writing quality and the template for section contract.

## ADR Status Taxonomy
- `proposed`: pending review and not yet architecture authority.
- `accepted`: approved and authoritative for current direction.
- `superseded`: replaced by a newer accepted ADR.
- `deprecated`: retained for legacy compatibility but not for new decisions.

## ADR Index and Sorting Rules
- Keep records sorted by `adr_number` ascending in the index below.
- Include each ADR once using the canonical pair path.
- Keep index entries current when status changes (especially `superseded` and `deprecated`).
- Recommended index columns: `ADR`, `Decision Status`, `Decision Date`, `Title`, `Path`.

## Current Index
| ADR | Decision Status | Decision Date | Title | Path |
| --- | --- | --- | --- | --- |
| 001 | accepted | 2026-04-11 | Single Authoritative Control Plane | `docs/adr/records/adr-001-single-authoritative-control-plane.ai.md` |

## Start Here
- [ADR Router](../README.ai.md)
- [ADR Authoring Guide](./authoring-guide.ai.md)
- [ADR Template](../../context/templates/adr.template.ai.md)
- [Architecture Router](../../architecture/README.ai.md)
