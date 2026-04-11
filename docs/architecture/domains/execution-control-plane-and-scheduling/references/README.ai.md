---
title: "AI Companion: Execution Control Plane and Scheduling Domain References"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/runs
  - src/domain/scheduling
---
# AI Companion: Execution Control Plane and Scheduling Domain References

## Purpose

Store canonical, durable architecture references for execution-control-plane-and-scheduling that implement or constrain the domain overview.

## What Belongs in Domain References

- One reference file per durable contract, interface family, or boundary rule.
- Normative constraints that directly guide implementation and review outcomes.
- Stable links to governing ADRs and relevant context packs when decision rationale matters.

## What Does Not Belong in Domain References

- Repeated domain boundary summaries that already live in ../overview.md.
- Environment-specific runbook procedures and day-2 operations playbooks.
- Sprint-level delivery plans, temporary migration notes, or ticket-specific checklists.

## Seed Reference Placeholders

Use this short list as migration scaffolding. Create each placeholder file when the first canonical contract lands, then replace placeholder language with authoritative content.

- `run-lifecycle-state-authority.md` - Authoritative run lifecycle state transition rules.
- `scheduling-policy-application-contracts.md` - Scheduling policy evaluation and application boundaries.
- `execution-readiness-and-dispatch-gates.md` - Execution readiness checks and dispatch gating contracts.

## Reference Authoring Rules

- Keep each reference focused on one contract surface and explicit invariants.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Include ## Related ADRs when a decision record constrains the reference.
- Include ## Related Context Packs when context routing depends on that contract for retrieval quality.
