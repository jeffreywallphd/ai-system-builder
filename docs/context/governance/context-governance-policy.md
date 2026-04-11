---
title: Context Governance Policy
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/packs
  - docs/context/routing
  - dev/scripts/validate-docs-foundation.cjs
---

# Context Governance Policy

## Purpose and Audience

This policy defines how context-pack and routing artifacts are maintained so context remains accurate, deterministic, and easy to retrieve.

## Governance Rules

- Keep context artifact IDs stable once published.
- Treat contract files as compatibility surfaces; update versions intentionally.
- Keep pack and routing seed files valid JSON even when empty.
- Keep router pages concise and navigation-first; avoid duplicating full pack content.
- Keep context-pack entries and routing mappings aligned to `docs/context/context-asset-metadata.contract.json`.
- Apply lifecycle state transitions and conflict-resolution rules from `docs/context/governance/context-asset-lifecycle.md`.
- Apply high-risk review controls from `docs/context/governance/high-risk-context-pack-guidance.md` when changing security, runtime/host, or architecture-invariant packs.
- Apply rollout boundary assumptions from `docs/context/governance/context-system-rollout-boundaries.md` so initial-release scope remains explicit.

## Review Cadence

- Review governance, pack catalog, and routing map artifacts at least once per feature epic milestone.
- Update `last_reviewed` when governance changes are merged.
- For assets using `reviewExpectations`, keep cadence and review dates current.

## Change Management

- Add or update automated guardrails whenever structure contracts change.
- Document any contract-breaking changes in the same pull request that introduces them.
- Keep `.md` and `.ai.md` companion docs aligned when governance guidance changes.
- Require broader multi-team review when high-risk guidance triggers are met.
