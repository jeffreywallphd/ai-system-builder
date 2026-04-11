---
title: "AI Companion: Identity Trust and Security Domain References"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/application/identity
  - src/application/authorization
---
# AI Companion: Identity Trust and Security Domain References

## Purpose

Store canonical, durable architecture references for identity-trust-and-security that implement or constrain the domain overview.

## What Belongs in Domain References

- One reference file per durable contract, interface family, or boundary rule.
- Normative constraints that directly guide implementation and review outcomes.
- Stable links to governing ADRs and relevant context packs when decision rationale matters.

## What Does Not Belong in Domain References

- Repeated domain boundary summaries that already live in `../overview.md`.
- Environment-specific runbook procedures and day-2 operations playbooks.
- Sprint-level delivery plans, temporary migration notes, or ticket-specific checklists.

## Reference Authoring Rules

- Keep each reference focused on one contract surface and explicit invariants.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Include `## Related ADRs` when a decision record constrains the reference.
- Include `## Related Context Packs` when context routing depends on the contract.

