# ADR Documentation Router

## Audience
- Engineers proposing or reviewing architectural decisions.
- Maintainers tracking supersession and decision history.

## Purpose
- Architecture Decision Records and supersession history.

## Belongs Here
- ADR documents with context, decision, status, and consequences.
- Superseded ADRs with replacement references.
- Decision history that affects long-term architecture direction.

## Does Not Belong Here
- General architecture reference material without a decision record.
- Operational runbooks and support procedures.
- Contributor implementation tutorials.

## ADR File Home
- Store ADR files in `docs/adr/records/`.
- Use filename format `adr-<NNN>-<kebab-case-title>.md` and pair AI companion files as `adr-<NNN>-<kebab-case-title>.ai.md`.
- Keep architecture overviews/references in `docs/architecture/`; use ADRs only for explicit choices and tradeoffs.

## ADR Metadata and Lifecycle Rules

### Numbering and Filename Rules
- ADR numbers are 3-digit, zero-padded identifiers (`001`, `002`, ...).
- Allocate numbers by taking the highest existing ADR number in `docs/adr/records/` and adding one.
- Numbers are unique and immutable; never renumber or reuse an old number.
- Every ADR pair must use the same number and slug in both files:
  - Human doc: `adr-<NNN>-<kebab-case-title>.md`
  - AI companion: `adr-<NNN>-<kebab-case-title>.ai.md`

### Title Rules
- Frontmatter `title` must use: `ADR-<NNN> <Decision Title>`.
- H1 must use: `# ADR-<NNN>: <Decision Title>`.
- `<Decision Title>` should be concise, stable, and aligned with the filename slug.

### Decision Status Rules
Use ADR lifecycle status values in `decision_status` frontmatter and mirror the same value in the `Status` section:

- `proposed`: decision under review; not yet adopted.
- `accepted`: approved direction and current decision of record.
- `superseded`: replaced by a newer accepted ADR; `superseded_by` must point to the replacement path.
- `deprecated`: still valid for legacy contexts but should not guide new architecture work.

### ADR-Specific Metadata Fields
Each ADR must include these lightweight metadata fields in frontmatter:

- `adr_number`: 3-digit ADR identifier matching filename/title.
- `decision_status`: one of `proposed`, `accepted`, `superseded`, `deprecated`.
- `decision_date`: `YYYY-MM-DD` date when decision status became `accepted` (or date accepted before later lifecycle changes).

## Standard ADR Sections
- Required: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional: `Supersession` (required whenever the ADR supersedes another ADR or is superseded) and `Follow-Up Actions`.
- Use the template directly so decision records remain concise and consistent: `docs/context/templates/adr.template.md`.

## Start Here
- [ADR Records Home](./records/README.md)
- [ADR Template](../context/templates/adr.template.md)
- [Architecture Router](../architecture/README.md)
- [Docs Top-Level Contract](../README.md)
- [Baselines Router](../baselines/README.md)
