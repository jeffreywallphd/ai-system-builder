---
title: ADR-<NNN> <Decision Title>
doc_type: adr
status: draft
authoritativeness: canonical
owned_by: <team-or-maintainer>
adr_number: <NNN>
decision_status: proposed
decision_date: <YYYY-MM-DD>
review_tier: routine
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
- `review_tier`: required review expectation tier (`routine`, `heightened`).
- Keep the `Status` section value aligned with `decision_status` metadata.
- Keep `review_tier` aligned with the review guidance in `## Review Expectations`.

## ADR Lifecycle Rules

- Amend an existing ADR only for non-decisional edits (clarity, typo/link fixes, metadata hygiene).
- Create a new ADR when durable architecture direction changes.
- Full replacement pattern: old ADR becomes `superseded`, old `superseded_by` points to new ADR, and new ADR `supersedes` points back.
- Partial revision pattern: publish a scoped ADR for changed boundaries and keep prior ADR `accepted` or `deprecated` as appropriate.
- If `supersedes` or `superseded_by` is set, include `## Supersession` and explain replacement scope explicitly.

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

- `Review Expectations` (required when `review_tier: heightened`)
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

## Review Expectations

Document review depth proportional to risk:

- `routine`: normal ADR review path (one architecture maintainer review and standard async comments in the ADR PR).
- `heightened`: high-risk ADR path requiring stronger review evidence before `accepted` or `superseded`.

For `heightened` ADRs, include:

- `Risk Class`: why this ADR is high-risk (for example security, trust boundary, runtime control authority, or tenancy/isolation).
- `Required Reviewers`: cross-domain reviewers needed before status changes.
- `Broader Architecture Review Trigger`: whether broader architecture review is required and why.
- `Recertification Cadence`: expected review cadence to keep the ADR current.

## Related Documentation

Use repo-relative links so ADR context stays connected to architecture and routing assets:

- Architecture context: `docs/architecture/<related-doc>.ai.md`
- Related decisions: `docs/adr/records/adr-<NNN>-<related-decision>.ai.md`
- Context assets that should carry decision memory: `docs/context/packs/<pack-id>.pack.ai.md` and/or `docs/context/routing/<routing-doc>.ai.md`

When architecture docs are changed by this decision, add a backlink from those docs under `## Related ADRs`.

## Related Code Paths

List repo-relative code paths that implement or enforce this decision.

## Supersession

If applicable, capture replacement details:

- `Supersedes`: `<older ADR/doc path>`
- `Superseded By`: `<newer ADR/doc path>`
- `Reason`: `<one-line why supersession happened>`

## Follow-Up Actions

List concrete follow-up items needed to realize or enforce the decision.
