---
title: "AI Companion: Context Governance Policy"
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

# AI Companion: Context Governance Policy

## Purpose and Audience

Use this policy when creating or changing context packs and routing artifacts.

## Governance Rules

- Keep context artifact IDs stable after publication.
- Treat contract JSON files as compatibility boundaries and version changes explicitly.
- Keep seed JSON artifacts valid and parseable at all times.
- Keep router docs concise and avoid embedding full pack bodies.
- Keep pack and routing metadata aligned to `docs/context/context-asset-metadata.contract.json`.
- Apply lifecycle transitions and conflict-resolution rules from `docs/context/governance/context-asset-lifecycle.ai.md`.
- Apply high-risk controls in `docs/context/governance/high-risk-context-pack-guidance.ai.md` for security, runtime/host, and architecture-invariant packs.
- Apply rollout boundary expectations from `docs/context/governance/context-system-rollout-boundaries.ai.md` so initial-release scope stays explicit.

## Review Cadence

- Re-review governance, pack catalog, and routing map artifacts at least once per epic milestone.
- Update `last_reviewed` whenever governance policy changes.
- If entries include `reviewExpectations`, keep cadence and review dates up to date.

## Change Management

- Add or update guardrail checks when structure contracts change.
- Document contract-breaking changes in the same pull request.
- Keep `.md` and `.ai.md` governance docs aligned.
- Require broader multi-team review when high-risk review triggers are met.
