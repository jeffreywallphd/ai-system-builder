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

## Review Cadence

- Review governance, pack catalog, and routing map artifacts at least once per feature epic milestone.
- Update `last_reviewed` when governance changes are merged.

## Change Management

- Add or update automated guardrails whenever structure contracts change.
- Document any contract-breaking changes in the same pull request that introduces them.
- Keep `.md` and `.ai.md` companion docs aligned when governance guidance changes.
