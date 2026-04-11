---
title: High-Risk Context Pack Review and Update Guidance
doc_type: ai-context
status: active
authoritativeness: canonical
owned_by: team:developer-experience
last_reviewed: 2026-04-11
related_code_paths:
  - docs/context/packs/context-pack-catalog.seed.json
  - docs/context/governance/context-governance-policy.md
  - dev/tests/HighRiskContextPackGuidanceGuardrails.test.ts
---

# High-Risk Context Pack Review and Update Guidance

## Scope

This guidance defines stronger review and update rules for context packs that carry higher risk if they drift from current repository truth.

## High-Risk Pack Domains and Rationale

The following active packs are treated as high-risk domains:

- `identity-and-security`: carries authentication, authorization, secrets, trust, and redaction invariants; stale guidance can produce unsafe implementation or review outcomes.
- `runtime-and-host`: covers startup sequencing, host lifecycle, and control-plane boundaries; stale guidance can cause runtime regressions or unsafe startup behavior.
- `architecture-core`: defines layered boundaries and architectural invariants used by many features; stale guidance can spread cross-layer violations and design drift.

## Ownership and Review Expectations

- High-risk packs require domain-owner accountability (`team:security-platform`, `team:runtime-platform`, `team:platform-architecture`) plus governance visibility through `team:developer-experience`.
- High-risk catalog entries must include explicit `reviewExpectations` and risk notes in `docs/context/packs/context-pack-catalog.seed.json`.
- Minimum cadence for high-risk packs is `per-story-and-epic-milestone`, and updates must refresh `reviewExpectations.lastReviewed`.
- `.md` and `.ai.md` variants must stay aligned in the same pull request.

## Special Caution Areas

- Do not weaken or remove security posture language such as deny-by-default, least-privilege, redaction, or trust-boundary handling without source updates.
- Do not change runtime startup/lifecycle ordering guidance unless canonical architecture docs and affected tests are updated together.
- Do not alter architecture-core invariants in ways that permit new cross-layer shortcuts or ambiguous ownership boundaries.
- Avoid broad wording that hides scope; keep sensitive guidance concrete and path-grounded.

## Broader Review Triggers

Require broader multi-team review before merging a high-risk pack change when any of the following apply:

- The change modifies a pack invariant or anti-pattern statement.
- The change affects authoritative doc/code path references used by routing for `runtime-security`, `diagnostics`, `architecture-review`, or `coding-implementation`.
- The change alters priority, inclusion logic, or domain interpretation that can change task-to-context selection outcomes.
- The change introduces or removes sensitive scope (identity/authn/authz, trust material handling, startup authority, or architectural boundary contracts).

Recommended broader reviewers: owning domain team plus at least one additional team from security, runtime, architecture, or developer-experience based on impacted scope.

## Update and Verification Expectations

- Keep metadata and review notes synchronized with pack content changes.
- Update related governance docs when high-risk policy expectations change.
- Add or update guardrail tests whenever high-risk coverage or expectations shift.
- Run targeted guardrail tests and `npm run docs:validate:foundation` before merge.
