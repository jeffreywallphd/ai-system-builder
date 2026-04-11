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

## ADR Discovery Registry
- Use `docs/adr/records/adr-registry.json` as the canonical fast-discovery artifact for ADR lookup by identifier, status, summary, and domain.
- Keep registry records sorted by `adrNumber` ascending and synchronized with ADR frontmatter (`adr_number`, `decision_status`, `decision_date`, and title).
- Keep `discoveryIndex.byDecisionStatus` and `discoveryIndex.byDomain` aligned with `records` so readers and automation can route quickly without scanning all ADR files.

## ADR Decision Thresholds

### ADR Required
- The change introduces or revises a durable architectural invariant that future features must obey.
- The change alters control-plane shape, authority boundaries, or host/runtime composition contracts.
- The change modifies workspace model guarantees (scope, tenancy, lifecycle, or cross-workspace behavior).
- The change redefines security trust boundaries, identity/authorization enforcement model, or transport/data trust assumptions.
- The change sets or reverses storage policy direction (durability model, persistence strategy, replication/sync authority, retention posture).
- The change locks in studio and system modeling semantics used across multiple domains or subsystems.

### ADR Recommended
- The change creates a high-impact cross-domain tradeoff likely to be revisited without explicit rationale.
- The change introduces a new extension seam, platform-wide abstraction, or default pattern that other teams will copy.
- The change is expected to have long-lived consequences, but can still be rolled back with bounded migration effort.

### ADR Unnecessary
- The change clarifies or expands an already accepted ADR without changing the decision itself.
- The change is implementation-level and local to one component while preserving existing architecture contracts.
- The change is operational procedure, diagnostics, rollout sequencing, or incident response guidance.
- The change is a historical completion snapshot, migration inventory, or baseline handoff artifact.

### Where To Document When ADR Is Unnecessary
- Architecture contract updates: `docs/architecture/`.
- Contributor implementation guardrails: `docs/contributors/`.
- Runtime/admin operations: `docs/operations/`.
- Historical baselines and migration snapshots: `docs/baselines/`.
- Shared taxonomy/context semantics: `docs/context/`.

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

### Amendment vs New ADR Rules
- Amend an existing ADR in place only for non-decisional changes: clarifications, typo fixes, broken links, metadata hygiene, or better rationale wording that does not change the decision boundary.
- Create a new ADR when architectural intent changes in any durable way: authority boundaries, invariants, trust model, storage posture, tenancy semantics, or extension constraints.
- If the original ADR remains mostly valid but one bounded part changes, create a new ADR for the revised scope and keep the older ADR `accepted` or move it to `deprecated` based on how much guidance still applies.
- Do not silently rewrite history by changing an old ADR's `Decision Statement` to reflect a new direction without a new ADR number.

### Supersession Representation Rules
- Use frontmatter `superseded_by` only on older ADRs that are no longer authoritative.
- Use frontmatter `supersedes` on the newer ADR that becomes authoritative for the replaced scope.
- Keep supersession links bi-directional:
  - Older ADR: `superseded_by: docs/adr/records/adr-<new>.md`
  - Newer ADR: `supersedes: docs/adr/records/adr-<old>.md`
- In full replacement cases, set older ADR `decision_status: superseded`.
- In partial replacement cases, keep older ADR as `accepted` or `deprecated` (based on remaining validity) and explain the narrowed scope in `## Supersession`.

### ADR-Specific Metadata Fields
Each ADR must include these lightweight metadata fields in frontmatter:

- `adr_number`: 3-digit ADR identifier matching filename/title.
- `decision_status`: one of `proposed`, `accepted`, `superseded`, `deprecated`.
- `decision_date`: `YYYY-MM-DD` date when decision status became `accepted` (or date accepted before later lifecycle changes).

## Standard ADR Sections
- Required: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional: `Supersession` (required whenever the ADR supersedes another ADR or is superseded) and `Follow-Up Actions`.
- Use the template directly so decision records remain concise and consistent: `docs/context/templates/adr.template.md`.
- Use ADR authoring guidance to keep decisions concise and high-signal: `docs/adr/records/authoring-guide.md`.

## ADR Cross-Linking Conventions

ADRs are part of the documentation system, not a standalone archive. Keep relationship paths explicit and durable:

- In `## Related Documentation`, include repo-relative links for:
  - Core architecture context (`docs/architecture/<...>.md`) that explains system boundaries touched by the decision.
  - Prior/adjacent decisions (`docs/adr/records/adr-<NNN>-<...>.md`) when supersession or dependency exists.
  - High-value context assets (`docs/context/packs/<...>.pack.md`, `docs/context/routing/<...>.md`, or `docs/context/context-map.md`) when routing or AI context should carry this decision.
- Prefer stable path references over prose-only mentions so maintainers can update links mechanically.
- Keep links bi-directional:
  - ADRs point to architecture/context docs in `Related Documentation`.
  - Architecture overviews/references should include `## Related ADRs` with direct links back to relevant ADR records.
  - Context packs may cite ADRs in `## Authoritative Docs` when the pack must preserve decision intent for implementation tasks.

## Start Here
- [ADR Records Home](./records/README.md)
- [ADR Discovery Registry](./records/adr-registry.json)
- [ADR Authoring Guide](./records/authoring-guide.md)
- [ADR-Informed Implementation and Review Examples](../contributors/adr-informed-implementation-and-review-examples.md)
- [ADR Template](../context/templates/adr.template.md)
- [Architecture Router](../architecture/README.md)
- [Docs Top-Level Contract](../README.md)
- [Baselines Router](../baselines/README.md)
