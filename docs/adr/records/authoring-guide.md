# ADR Authoring Guide

Use this alongside the ADR template. The template defines structure; this guide defines quality.

## Purpose

Write ADRs that capture one architectural decision clearly enough that future contributors and AI agents can apply it without reopening the same debate.

## Writing Standard

- Frame one concrete problem, not a broad architecture tour.
- Compare realistic alternatives that were actually considered.
- State the decision in direct language ("We will ...") and avoid ambiguous phrasing.
- Document tradeoffs honestly, including costs and risks.
- Keep implementation details limited to durable boundaries and invariants.

## Lifecycle Decision Rules

- Use amendment-in-place only when architecture direction does not change.
- Create a new ADR when the decision boundary changes and future work must behave differently.
- Full replacement: mark the old ADR as `superseded`, set old `superseded_by`, and set new `supersedes`.
- Partial replacement: publish a narrowly scoped ADR for the revised area and keep the old ADR as `accepted` or `deprecated` based on remaining authority.
- Keep supersession links bi-directional so readers can navigate from historical decision to current authority and back.

## Section Quality Rules

- `Decision Statement`: 2-4 sentences with the final outcome, scope, and any non-negotiable constraints.
- `Context and Problem Statement`: include why this decision is needed now and what fails without it.
- `Considered Options`: include at least one serious rejected option and why it lost.
- `Chosen Approach`: describe architectural boundaries, not sprint tasks.
- `Consequences`: include benefits, drawbacks, and residual risks.
- `Related Documentation`: include explicit repo-relative links to impacted architecture docs, related ADRs, and any context packs/routing assets that should carry this decision into context assembly.

## Good vs Bad Examples (AI Loom Studio Context)

### Decision Statement

- Bad: "We should probably use an event bus for flexibility."
- Good: "We will keep the authoritative server as the only policy-write authority and publish policy-change events to worker hosts for read-model refresh. Workers will not persist independent policy truth."

### Considered Options

- Bad: "Option A was simpler."
- Good: "Option A (single authority + event fanout) was selected because it preserves control-plane authority boundaries. Option B (per-host write ownership) was rejected because it creates reconciliation risk and weakens auditability."

### Consequences

- Bad: "This is better and should scale."
- Good: "This reduces authorization drift and improves incident forensics, but introduces temporary staleness risk in worker read models during event delivery delays."

## Anti-Patterns to Avoid

- Long architecture essays that restate `docs/architecture/` without making a decision.
- Transient implementation logs ("Day 1/Day 2 changes", ticket checklists, migration diary notes).
- Speculative future brainstorming presented as accepted architecture.
- Low-signal text with no explicit option tradeoffs or no clear decision owner.

## Authoring Checklist

- Can a reader identify the final decision in under 30 seconds?
- Can a reader explain why at least one alternative was rejected?
- Are risks and drawbacks explicit instead of implied?
- Does the ADR avoid implementation noise that will age quickly?
- Does `Related Documentation` create bi-directional navigation with architecture/context docs instead of leaving the ADR isolated?

