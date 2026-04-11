---
title: ADR-<NNN> <Decision Title>
doc_type: adr
status: draft
authoritativeness: canonical
owned_by: <team-or-maintainer>
adr_number: <NNN>
decision_status: proposed
decision_date: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
related_code_paths:
  - <optional repo-relative path>
supersedes: <optional repo-relative doc path>
superseded_by: <optional repo-relative doc path>
---

# ADR-<NNN>: <Decision Title>

## ADR Numbering and Naming Rules

- Allocate `<NNN>` as the next 3-digit number after the highest existing ADR in `docs/adr/records/`.
- Keep `<NNN>` consistent across filename, `adr_number`, frontmatter `title`, and H1 heading.
- Use filename format `adr-<NNN>-<kebab-case-title>.md` and pair AI companion as `adr-<NNN>-<kebab-case-title>.ai.md`.
- Do not renumber old ADRs or reuse retired numbers.

## ADR Metadata Rules

- `adr_number`: required 3-digit identifier for sorting and indexing.
- `decision_status`: required ADR lifecycle value (`proposed`, `accepted`, `superseded`, `deprecated`).
- `decision_date`: required acceptance date in `YYYY-MM-DD`.
- Keep the `Status` section value aligned with `decision_status` metadata.

## Required Sections

- `Status`
- `Decision Date`
- `Decision Statement`
- `Context and Problem Statement`
- `Decision Drivers`
- `Considered Options`
- `Chosen Approach`
- `Consequences`
- `Related Documentation`
- `Related Code Paths`

## Optional Sections

- `Supersession` (required when replacing an ADR or marking this ADR as superseded)
- `Follow-Up Actions`

## Status

Use one ADR lifecycle status value and keep it synchronized with `decision_status` metadata:

- `proposed`: decision is being reviewed.
- `accepted`: decision is approved and current.
- `superseded`: decision has been replaced by a newer ADR.
- `deprecated`: decision remains for legacy context but should not guide new work.

## Decision Date

Record when the decision was accepted (matches `decision_date` metadata).

## Decision Statement

State the final decision in 2-4 sentences.

## Context and Problem Statement

Summarize the problem, constraints, and why a decision was required now.

## Decision Drivers

List the forces that most influenced the decision (for example: security, performance, operability, delivery speed).

## Considered Options

List realistic options and the key tradeoff for each:

1. `<Option A>`: `<why accepted/rejected>`
2. `<Option B>`: `<why accepted/rejected>`
3. `<Option C>`: `<why accepted/rejected>`

## Chosen Approach

Describe the selected option and key implementation boundaries.

## Consequences

Describe expected benefits, tradeoffs, and risks.

## Related Documentation

Use repo-relative links and keep ADR memory connected to the rest of docs:

- Architecture context: `docs/architecture/<related-doc>.md`
- Related decisions: `docs/adr/records/adr-<NNN>-<related-decision>.md`
- Context assets that should carry this decision: `docs/context/packs/<pack-id>.pack.md` and/or `docs/context/routing/<routing-doc>.md`

When architecture docs are updated from this decision, add a backlink from that architecture doc under `## Related ADRs`.

## Related Code Paths

List repo-relative code paths that implement or enforce this decision.

## Supersession

If applicable, capture replacement details:

- `Supersedes`: `<older ADR/doc path>`
- `Superseded By`: `<newer ADR/doc path>`
- `Reason`: `<one-line why supersession happened>`

## Follow-Up Actions

List concrete follow-up items needed to realize or enforce the decision.
