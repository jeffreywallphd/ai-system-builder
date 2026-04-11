---
title: "AI Companion: Architecture Supersession and Retirement Governance"
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-supersession-registry.json
  - docs/architecture/architecture-migration-sequence-and-priority.ai.md
  - dev/tests/ArchitectureSupersessionGovernanceGuardrails.test.ts
---

# AI Companion: Architecture Supersession and Retirement Governance

## Purpose

Define a deterministic handling policy for superseded architecture docs so AI and human contributors can identify authoritative sources without ambiguity.

## Scope

This policy applies to legacy flat architecture docs during domain migration and cleanup.

In scope:
- required supersession signaling,
- link-stub redirect requirements,
- baseline archival and safe removal criteria.

Out of scope:
- taxonomy shape and domain boundaries,
- migration-wave priority order.

## Legacy State Model

Allowed legacy states:

1. `legacy-authority`
2. `migration-in-progress`
3. `migrated-link-stub`
4. `historical-baseline`

## Required Supersession Notice for Link Stubs

For `migrated-link-stub` docs, require:

1. Frontmatter: `status: superseded`, `authoritativeness: historical`, `superseded_by`.
2. `## Supersession Notice` explicitly stating non-authoritative status.
3. Explicit `Effective date`, `Reason`, and `Retention/removal trigger` lines.
4. `## Redirect` with canonical destination links.
5. Keep content concise and routing-only; avoid duplicate retired implementation detail.

## Safe Redirect and Retirement Rules

1. Replace with stub before deletion.
2. Keep legacy paths until routers/context packs are migrated.
3. Remove stubs only after inbound reference migration and passing tests.
4. Preserve historical context via canonical destinations or baselines.

## Registry Contract

- `architecture-supersession-registry.json` is the machine-readable source for superseded and legacy-authority docs.
- Entries include source path, legacy state, canonical destination guidance, and retention notes.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domainization Rollout Boundaries and Follow-On Work](./architecture-domainization-rollout-boundaries.md)
- [Architecture Migration Sequence and Priority Order](./architecture-migration-sequence-and-priority.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Supersession Registry](./architecture-supersession-registry.json)
