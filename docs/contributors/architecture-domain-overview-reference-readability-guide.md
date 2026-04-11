---
title: Architecture Domain Overview and Reference Readability Guide
doc_type: contributor-guide
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/domains/README.md
  - docs/architecture/domains
  - dev/tests/ArchitectureDomainOverviewReferenceReadabilityGuideGuardrails.test.ts
---

# Architecture Domain Overview and Reference Readability Guide

## Scope

Use this guide when writing or editing domain docs in `docs/architecture/domains/<domain-id>/`.
It applies to:
- `overview.md`
- `references/README.md`
- contract reference docs in `references/*.md`

Goal: keep domain docs fast to scan, role-correct, and low-duplication across ongoing migrations.

## Document Role Distinction

- `overview.md` explains concept-level boundary intent:
  - what the domain is for
  - where the domain starts and stops
  - which invariants must hold
  - which references are canonical for contract detail
- `references/README.md` is a map and authoring contract for reference docs.
- Each reference doc explains one contract surface in implementation-relevant detail.

Do not collapse these roles into a single narrative document.

## Recommended Section Ordering

Use the standard section order to preserve consistency across domains.

### Domain Overview Section Order

1. `## Domain Summary for Fast Context Selection`
2. `## Scope and System Boundary`
3. `## Canonical Responsibilities`
4. `## Cross-Cutting Invariants`
5. `## Integration and Dependency Boundaries`
6. `## Reference Map`
7. `## Canonical Source Documents Migrated into This Domain`

Write at this level:
- concept-first and boundary-first
- route to references for contract detail
- avoid endpoint payload tables and runbook procedure flow

### Domain Reference Section Order

For `references/README.md`:
1. what belongs in domain references
2. what does not belong in domain references
3. seed or canonical reference index
4. reference authoring rules

For each reference doc:
1. `## Context and Scope`
2. `## Contracts and Interfaces`
3. `## Data and State Invariants`
4. `## Failure and Recovery Semantics`
5. `## Extension Guardrails`
6. `## References`

## Brevity and Scannability Rules

- Keep section openings to one short orienting paragraph.
- Prefer compact bullets over long prose blocks.
- Keep one paragraph focused on one architectural idea.
- Use link-first routing when detail is already canonical elsewhere.
- Remove repeated restatements that do not change boundary understanding.

## Concept-First and Boundary Clarity Rules

Use this writing pattern:
1. state the architectural concept
2. state the boundary or invariant it imposes
3. state where detailed contract authority lives

Make boundary language explicit:
- in scope
- out of scope
- handoff to neighboring domain
- ownership and dependency direction

## Avoid Repeating ADR and Baseline Material

- Do not copy ADR rationale history into overview or reference docs.
- Keep decision rationale in `docs/adr/records/` and link the relevant ADR.
- Do not copy baseline snapshots into active domain docs.
- Keep historical state in `docs/baselines/` and link it only when needed for migration context.

## Editing Checklist

Before merging domain doc updates, confirm:
1. section ordering follows the domain overview or reference role.
2. prose is concise and concept-first.
3. boundary language is explicit and testable.
4. ADR and baseline content is linked, not duplicated.
5. overview text routes to references for contract detail.

## Related Documentation

- [Architecture Domain Folders](../architecture/domains/README.md)
- [Architecture Domain Cross-Linking Rules](../architecture/architecture-domain-cross-linking-rules.md)
- [Architecture Document Scope Boundaries](../architecture/architecture-document-scope-boundaries.md)
- [Documentation Placement Guide](./docs-placement-guide.md)

