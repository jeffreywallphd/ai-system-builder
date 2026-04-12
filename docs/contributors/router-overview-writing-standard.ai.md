---
title: AI Companion: Router and Overview Writing Standard
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/README.ai.md
  - docs/architecture/README.ai.md
  - dev/tests/DocumentationRouterOverviewWritingStandardGuardrails.test.ts
---

# AI Companion: Router and Overview Writing Standard

## Scope

Apply this standard to high-level navigation and overview docs in the docs foundation.

- Router documents: README entry points at `docs/` root and top-level docs areas.
- Overview documents: docs with `doc_type: architecture-overview`.

Goal: keep routing docs concise and prevent overloaded catch-all READMEs.

## Document Roles

- Router documents route by role/task and link to authoritative docs.
- Overview documents explain durable boundaries and high-level shape.
- Reference details stay in role-specific docs such as `architecture-reference` or `runbook`.

## Target Length

- Router documents target 80-350 words and must stay at or below 500 words.
- Overview documents target 250-700 words and should stay at or below 900 words.
- When over cap, move detail into destination docs and keep summary-plus-links.

## Allowed Responsibilities

- Router documents may include:
  - audience/purpose boundaries
  - belongs-here / does-not-belong-here routing
  - start links and reader journeys
- Router documents must not include:
  - runbook procedures
  - full API/schema reference
  - long implementation tutorials
- Overview documents may include:
  - scope and system boundary framing
  - core components and invariants
  - high-level extension constraints
- Overview documents must not include:
  - exhaustive reference matrices
  - step-by-step operational procedures
  - duplicated reference sections

## Link Versus Restate

- Link when details are volatile, procedural, or already canonical elsewhere.
- Restate only stable orientation context needed for routing.
- Keep restated context to 1-2 sentences before linking to source-of-truth docs.

## Anti-Catch-All Guardrails

- Navigation docs are not reference docs.
- Avoid "miscellaneous" catch-all sections in routers.
- If router sections grow into implementation detail, move detail out and leave links.
- Keep one authoritative owner per responsibility and use links for discoverability.
