---
title: "AI Companion: Deployment Policy and Audit Governance Domain References"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - src/domain/deployment
  - src/domain/audit
  - src/application/policy-administration
---
# AI Companion: Deployment Policy and Audit Governance Domain References

## Purpose

Store canonical, durable architecture references for deployment-policy-and-audit-governance that implement or constrain the domain overview.

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

- `deployment-policy-resolution-and-overrides.md` - Policy resolution, override, and explainability boundaries.
- `audit-ledger-and-event-governance-contracts.md` - Audit ledger persistence and event governance contracts.
- `policy-administration-authority-surfaces.md` - Authoritative policy administration API and command surfaces.

## Reference Authoring Rules

- Keep each reference focused on one contract surface and explicit invariants.
- Link back to [Domain Overview](../overview.md) for boundary context.
- Include ## Related ADRs when a decision record constrains the reference.
- Include ## Related Context Packs when context routing depends on that contract for retrieval quality.
