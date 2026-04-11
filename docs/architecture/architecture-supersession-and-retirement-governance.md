---
title: Architecture Supersession and Retirement Governance
doc_type: architecture-reference
status: active
authoritativeness: canonical
owned_by: team:platform-architecture
last_reviewed: 2026-04-11
related_code_paths:
  - docs/architecture/architecture-supersession-registry.json
  - docs/architecture/architecture-migration-sequence-and-priority.md
  - dev/tests/ArchitectureSupersessionGovernanceGuardrails.test.ts
---

# Architecture Supersession and Retirement Governance

## Purpose

Define one safe, explicit pattern for handling architecture docs that are no longer canonical so contributors can always identify current authority.

## Scope

This document governs legacy flat architecture docs during and after domain migration.

In scope:
- Supersession notice requirements.
- Redirect/link-stub requirements.
- Baseline archival and removal criteria.

Out of scope:
- Domain taxonomy definitions.
- Migration sequencing priority.

## Legacy State Model

Use only these states for legacy architecture docs:

1. `legacy-authority`: not migrated yet; still authoritative.
2. `migration-in-progress`: split or relocation underway; explicit target links required.
3. `migrated-link-stub`: no longer authoritative; retained as a redirect.
4. `historical-baseline`: archived under `docs/baselines/`.

## Required Supersession Notice for Link Stubs

A `migrated-link-stub` document must include:

1. Frontmatter with `status: superseded`, `authoritativeness: historical`, and `superseded_by`.
2. A `## Supersession Notice` section that says the document is non-authoritative.
3. Explicit `Effective date`, `Reason`, and `Retention/removal trigger` lines.
4. A `## Redirect` section with canonical destination links.
5. Keep content concise and routing-focused; do not restate retired implementation details.

## Safe Redirect and Retirement Rules

1. Do not delete legacy docs in the same change that introduces a new canonical destination.
2. Convert replaced legacy docs to link stubs first, then update inbound routers and context packs.
3. Keep legacy path stability until inbound links are migrated and guardrail tests pass.
4. Remove stubs only when the path has no required inbound references and history is preserved in canonical docs or baselines.

## Registry Contract

- `architecture-supersession-registry.json` is the canonical machine-readable ledger for superseded and legacy-authority architecture docs.
- Each entry must include source path, state, canonical destination guidance, and retention notes.

## Related Documentation

- [Architecture Documentation Router](./README.md)
- [Architecture Domainization Rollout Boundaries and Follow-On Work](./architecture-domainization-rollout-boundaries.md)
- [Architecture Migration Sequence and Priority Order](./architecture-migration-sequence-and-priority.md)
- [Architecture Domain Migration Inventory](./architecture-domain-migration-inventory.md)
- [Architecture Supersession Registry](./architecture-supersession-registry.json)
