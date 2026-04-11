# AI Companion: ADR Authoring Guide

Use this with `docs/context/templates/adr.template.ai.md`. The template enforces section shape; this guide enforces signal quality.

## Goal

Produce ADRs that are concise, decision-focused, and durable for human and AI reuse.

## Quality Rules

- Capture one decision per ADR.
- Explain the problem pressure that required the decision now.
- Compare realistic alternatives with explicit accept/reject reasoning.
- State the final decision directly with architectural scope boundaries.
- Record tradeoffs and risks, not only benefits.

## Lifecycle Decision Rules

- Amend an ADR in place only when the decision remains unchanged.
- Publish a new ADR when durable architecture direction changes.
- Full replacement pattern: old ADR `superseded` + old `superseded_by` + new ADR `supersedes`.
- Partial revision pattern: create a focused ADR for changed scope and keep prior ADR `accepted` or `deprecated` depending on remaining authority.
- Require bi-directional supersession links so current authoritative ADRs are discoverable from older records.

## High-Risk Review Rules

- Set `review_tier: heightened` when the decision changes security/trust boundaries, runtime control authority, tenancy/isolation guarantees, or supersedes those decisions.
- Keep `review_tier: routine` for ADRs that are architectural but do not alter high-risk boundaries.
- For `review_tier: heightened`, include `## Review Expectations` with:
  - `Risk Class`
  - `Required Reviewers`
  - `Broader Architecture Review Trigger`
  - `Recertification Cadence`
- Keep this section concise: enough governance signal to protect high-risk decisions without adding unnecessary bureaucracy.

## Section Expectations

- `Decision Statement`: clear final choice, not intent language.
- `Context and Problem Statement`: constraints and failure mode if undecided.
- `Considered Options`: real options, including rejected ones.
- `Chosen Approach`: stable architecture boundaries and authority model.
- `Consequences`: upside, downside, and residual risk.
- `Related Documentation`: explicit repo-relative links to affected architecture docs, related ADR records, and context pack/routing assets that should preserve decision context.

## Good vs Bad (AI Loom Studio)

### Decision Statement

- Bad: "We may move policy writes closer to each host later."
- Good: "Policy writes remain authoritative-server only. Other hosts consume policy updates as read-only projections."

### Considered Options

- Bad: "Option B was not ideal."
- Good: "Option B (host-local policy writes) was rejected because it fragments authority and complicates audit lineage."

### Consequences

- Bad: "This design is best."
- Good: "This improves policy consistency and governance traceability, but increases dependency on reliable event publication for read-model freshness."

## Reject These Patterns

- ADRs that become architecture primers instead of decisions.
- ADRs that capture sprint chronology instead of durable rationale.
- Speculative content without accepted/rejected outcomes.
- Filler text that omits concrete tradeoffs.

## Fast Self-Check

- Is the final decision obvious immediately?
- Can a reviewer name the top rejected alternative and reason?
- Are non-trivial downsides explicit?
- Is transient implementation detail excluded?
- Does `Related Documentation` keep bi-directional navigation with architecture/context docs so ADR memory is connected?
- Is `review_tier` correct for the risk class and does `## Review Expectations` exist when `review_tier: heightened`?

