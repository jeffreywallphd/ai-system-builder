---
title: ADR-<NNN> <Decision Title>
doc_type: adr
status: draft
authoritativeness: canonical
owned_by: <team-or-maintainer>
decision_date: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
related_code_paths:
  - <optional repo-relative path>
supersedes: <optional repo-relative doc path>
superseded_by: <optional repo-relative doc path>
---

# ADR-<NNN>: <Decision Title>

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

Use one taxonomy status value and update it when superseded/archived.

## Decision Date

Record when the decision was accepted (usually matches `decision_date` metadata).

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

Link architecture references, contributor guides, and baselines that provide broader context.

## Related Code Paths

List repo-relative code paths that implement or enforce this decision.

## Supersession

If applicable, capture replacement details:

- `Supersedes`: `<older ADR/doc path>`
- `Superseded By`: `<newer ADR/doc path>`
- `Reason`: `<one-line why supersession happened>`

## Follow-Up Actions

List concrete follow-up items needed to realize or enforce the decision.
