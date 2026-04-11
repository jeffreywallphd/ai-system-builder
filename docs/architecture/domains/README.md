---
title: Architecture Domain Folders
doc_type: architecture-overview
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-domain-taxonomy.md
---

# Architecture Domain Folders

## Purpose

Define the canonical folder structure and document pattern under docs/architecture/domains/ so each domain has predictable overview and reference responsibilities.

## Folder Contract

- Use one folder per domain ID from docs/architecture/architecture-domain-taxonomy.md.
- Keep one overview.md per domain as the boundary and routing contract.
- Keep one references/README.md per domain as the reference-index and authoring contract.
- Keep detailed contracts in the domain references/ folder.
- Keep markdown and AI companion files aligned during migrations.

## Standard Domain Document Pattern

Each domain uses this minimum file shape:

```text
docs/architecture/domains/<domain-id>/
  overview.md
  overview.ai.md
  references/
    README.md
    README.ai.md
    <contract-reference>.md
    <contract-reference>.ai.md
```

No extra domain-level file types are required right now. Add new top-level file types only when architecture complexity cannot be expressed cleanly with overview plus references.

## Overview Responsibilities

`overview.md` is the domain boundary contract:
- Define scope, ownership seams, and cross-domain dependency rules.
- Add `## Domain Summary for Fast Context Selection` near the top with quick purpose, boundary, and importance signals.
- Include concise domain-specific role language so migration starts with clear system intent.
- State domain-wide invariants and concise migration direction.
- Add `## Domain Boundary Notes for Common Confusion` when adjacent domains have subtle or frequently conflated ownership seams.
- Route readers to canonical references in `./references/`.
- Keep summary language architecture-facing and avoid duplicating context-pack assembly content.

`overview.md` should not contain:
- endpoint payload catalogs, schema tables, or low-level API matrices
- runbook procedures or troubleshooting workflows
- ticket-level delivery plans or contributor process checklists

## Reference Responsibilities

`references/README.md` is the domain reference-index contract:
- Define what reference docs in the folder are allowed to cover.
- Include a short `## Seed Reference Placeholders` section with lightweight candidate references.
- Require one durable contract surface per reference doc.
- Require references to link back to `../overview.md` for boundary context.

Reference docs should not contain:
- duplicated domain boundary summaries from `overview.md`
- operational playbooks better owned by `docs/operations/`
- contributor process guidance better owned by `docs/contributors/`

Use [Architecture Domain Overview and Reference Readability Guide](../../contributors/architecture-domain-overview-reference-readability-guide.md)
for section ordering, brevity, concept-first explanation, boundary clarity, and de-duplication expectations.

## ADR and Context Pack Linking Rules

- Domain overviews must include `## Related ADRs` when ADRs constrain the domain boundary.
- Domain reference docs must include `## Related ADRs` when the specific contract is ADR-constrained.
- Domain overviews should include `## Related Context Packs` with links to relevant `docs/context/packs/*.pack.md` assets.
- Domain references should include `## Related Context Packs` when routing quality depends on that contract for AI retrieval.

For cross-doc inbound/outbound linking coverage (ADRs, context packs, baselines, contributor docs, and operations docs), use [Architecture Domain Cross-Linking Rules](../architecture-domain-cross-linking-rules.md).

## Content Placement Rules

When domain docs need content outside architecture scope, link instead of copying:

- operations procedures -> `docs/operations/`
- contributor workflows and authoring standards -> `docs/contributors/`
- decision rationale history -> `docs/adr/records/`
- retrieval assembly guidance -> `docs/context/packs/`

For cross-domain scope rules and anti-pattern handling, use [Architecture Document Scope Boundaries](../architecture-document-scope-boundaries.md).

## Domain Folders

- [core-platform-and-composition](./core-platform-and-composition/overview.md)
- [runtime-host-surfaces](./runtime-host-surfaces/overview.md)
- [identity-trust-and-security](./identity-trust-and-security/overview.md)
- [workspace-storage-and-assets](./workspace-storage-and-assets/overview.md)
- [execution-control-plane-and-scheduling](./execution-control-plane-and-scheduling/overview.md)
- [studio-and-system-composition](./studio-and-system-composition/overview.md)
- [api-and-transport-surfaces](./api-and-transport-surfaces/overview.md)
- [deployment-policy-and-audit-governance](./deployment-policy-and-audit-governance/overview.md)

## Migration Notes

- These folders are the target migration shape for later stories.
- Existing flat architecture docs remain authoritative until explicitly migrated.
