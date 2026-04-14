# Context Pack: Index (Baseline)

- Pack name: `index`

## Purpose

- Provide the always-included baseline context for all automation and implementation prompts.
- Establish repository-wide guardrails while keeping context payloads minimal.

## Use When

- Every automated prompt and implementation task in this repository.
- Any task that needs baseline standards before adding specialized packs.

## Do Not Use When

- Never omit for repository work.
- Do not treat this as a replacement for canonical docs when a task needs deeper detail.

## Core Guidance

- Respect architectural boundaries: keep domain/application free of host, transport, UI, and infrastructure leakage.
- Prefer minimum-sufficient context: include only additional packs required for the current task.
- Avoid speculative abstraction, package proliferation, and folder/package duplication without concrete need.
- Use role-revealing names; avoid vague catch-all naming for files, folders, and symbols.
- Update canonical docs in the same change when documented behavior/architecture/standards change.
- Use structured, meaningful logs with configurable verbosity and stage-level timing for long operations.
- Add regression tests for meaningful bug fixes when practical; prioritize behavioral value and deterministic tests.

## Key Constraints

- This pack is a routing baseline, not a second source of truth.
- Canonical rules remain in ADR, architecture, and standards docs.
- Prompt builders must add only targeted companion packs (not all packs by default).

## Canonical Source Docs

- `docs/adr/README.md` — ADR workflow and decision-record discipline.
- `docs/architecture/module-dependency-rules.md` — boundary and dependency direction constraints.
- `docs/architecture/system-overview.md` — repository shape and packaging restraint posture.
- `docs/standards/coding-standards.md` — implementation discipline and abstraction restraint.
- `docs/standards/naming-standards.md` — role-revealing naming requirements.
- `docs/standards/documentation-standards.md` — canonical documentation responsibilities and update rules.
- `docs/standards/logging-standards.md` — structured logging, verbosity, and diagnostics expectations.
- `docs/standards/testing-standards.md` — behavior-focused testing expectations and regression policy.

## Common Over-Inclusions to Avoid

- Loading every architecture/standards doc for routine, narrow tasks.
- Including host-specific packs for non-host work.
- Copying full canonical docs into prompt payloads.

## Prompt Assembly Notes

- Always include this pack first.
- Add only the smallest set of specialized packs required by the task.
- Typical order: `index` → task-specific pack(s) → targeted canonical doc links when needed.
