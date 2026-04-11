---
title: "AI Companion: High-Risk Context Pack Review and Update Guidance"
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/packs/context-pack-catalog.seed.json
  - docs/context/governance/context-governance-policy.ai.md
  - dev/tests/HighRiskContextPackGuidanceGuardrails.test.ts
---

# AI Companion: High-Risk Context Pack Review and Update Guidance

## Scope

Apply this guidance when changing context packs whose drift can create security, runtime, or architecture-boundary failures.

## High-Risk Pack Domains and Rationale

Treat these active packs as high-risk:

- `identity-and-security`: contains authentication/authorization/secrets/trust/redaction invariants; stale context can cause unsafe implementation or review guidance.
- `runtime-and-host`: contains startup, host lifecycle, and control-plane boundary rules; stale context can create boot/runtime regressions.
- `architecture-core`: contains layered architecture invariants; stale context can normalize cross-layer violations across many tasks.

## Ownership and Review Expectations

- Domain owner remains accountable (`team:security-platform`, `team:runtime-platform`, `team:platform-architecture`) with governance visibility from `team:developer-experience`.
- High-risk catalog entries must keep explicit `reviewExpectations` and risk notes in `docs/context/packs/context-pack-catalog.seed.json`.
- Minimum cadence is `per-story-and-epic-milestone`; refresh `reviewExpectations.lastReviewed` whenever high-risk pack changes merge.
- Keep `.md` and `.ai.md` companions synchronized in one pull request.

## Special Caution Areas

- Do not weaken security posture language (deny-by-default, least-privilege, redaction, trust boundaries) without authoritative source updates.
- Do not change runtime startup/lifecycle ordering guidance without aligned canonical docs and test updates.
- Do not loosen architecture-core invariant language that protects layer boundaries and ownership seams.
- Keep high-risk guidance concrete and path-grounded; avoid vague broadening statements.

## Broader Review Triggers

Require broader multi-team review before merge when:

- An invariant or anti-pattern statement is modified.
- Authoritative doc/code references used by `runtime-security`, `diagnostics`, `architecture-review`, or `coding-implementation` routes are changed.
- Pack priority, inclusion behavior, or domain interpretation changes can affect deterministic routing outcomes.
- Sensitive domain scope is added/removed (identity/authn/authz, trust material handling, startup authority, architecture-boundary contracts).

Recommended review set: owning domain team plus at least one additional reviewer from security, runtime, architecture, or developer-experience based on impact.

## Update and Verification Expectations

- Keep pack metadata and risk notes synchronized with content changes.
- Update governance docs when high-risk review policy changes.
- Update guardrail tests when high-risk scope or expectations change.
- Run targeted guardrails and `npm run docs:validate:foundation` before merge.
