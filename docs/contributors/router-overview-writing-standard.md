---
title: Router and Overview Writing Standard
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/README.md
  - docs/architecture/README.md
  - dev/tests/DocumentationRouterOverviewWritingStandardGuardrails.test.ts
---

# Router and Overview Writing Standard

## Scope

Use this standard for high-level navigation and overview docs in the documentation system foundation.

- Router documents: README entry points at `docs/` root and top-level docs areas.
- Overview documents: docs tagged `doc_type: architecture-overview`.

This standard keeps navigation readable, prevents catch-all READMEs, and protects the boundary between navigation and reference.

## Document Roles

- Router documents route readers by role or task and point to authoritative destinations.
- Overview documents summarize boundaries, intent, and durable shape without replacing detailed contracts.
- Reference content belongs in `architecture-reference`, `runbook`, `contributor-guide`, `adr`, or other role-appropriate docs.

## Target Length

- Router documents target 80-350 words and must stay at or below 500 words.
- Overview documents target 250-700 words and should stay at or below 900 words.
- If a doc crosses the cap, split detail into destination docs and keep only a concise summary plus links.

## Allowed Responsibilities

- Router documents may include:
  - audience and purpose
  - "belongs here" and "does not belong here" boundaries
  - start links and common reader journeys
- Router documents must not include:
  - operational procedures
  - full API or schema reference
  - long implementation tutorials
- Overview documents may include:
  - scope and boundary framing
  - core components and invariants
  - high-level extension guidance
- Overview documents must not include:
  - exhaustive parameter or endpoint matrices
  - step-by-step runbook procedures
  - duplicated reference sections already covered elsewhere

## Link Versus Restate

- Link when detail is volatile, procedural, or already authoritative in another doc.
- Restate only stable orientation context needed to choose the right link.
- Keep restated content short: 1-2 sentences before linking to the source of truth.

## Anti-Catch-All Guardrails

- Navigation docs are not reference docs.
- Do not add "miscellaneous" catch-all sections to routers.
- If a router section starts accumulating implementation detail, move that detail to a role-specific document and keep a link in the router.
- Keep a single authoritative owner for each content responsibility; use links for discoverability instead of duplication.
