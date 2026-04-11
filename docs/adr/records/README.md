# ADR Records Home

## Audience
- Engineers writing or updating Architecture Decision Records.
- Reviewers validating decision status and supersession history.

## Purpose
- Canonical storage location for individual ADR files.

## ADR Record Contract
- Place all ADR decision files in this folder.
- Use `adr-<NNN>-<kebab-case-title>.md` for human docs and `adr-<NNN>-<kebab-case-title>.ai.md` for AI companions.
- Keep decision numbers unique and increasing over time; do not renumber historical records.
- Track supersession with metadata and links in the ADR body.
- Include every required section from the standard ADR template; do not remove required headings.
- Use optional sections only when relevant; `Supersession` becomes required when replacement relationships exist.

## Authoring Guidance
- Use [ADR Authoring Guide](./authoring-guide.md) for concise, decision-focused writing standards and good/bad examples.
- Keep that guide complementary to the template: the template defines section shape, the guide defines quality and signal.

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
| 001 | accepted | 2026-04-11 | Single Authoritative Control Plane | `docs/adr/records/adr-001-single-authoritative-control-plane.md` |

## Start Here
- [ADR Router](../README.md)
- [ADR Authoring Guide](./authoring-guide.md)
- [ADR Template](../../context/templates/adr.template.md)
- [Architecture Router](../../architecture/README.md)
