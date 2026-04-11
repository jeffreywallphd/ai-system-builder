# AI Companion: ADR Documentation Router

## Audience
- AI assistants routing decision-history questions.
- Engineers checking where architectural decisions are recorded.

## Purpose
- Entry point for ADRs and decision supersession history.

## Belongs Here
- ADR records with context, alternatives, status, and consequences.
- Supersession trails between old and replacement decisions.
- Durable decision history for long-term architecture governance.

## Does Not Belong Here
- General architecture references without a formal decision.
- Operational procedures.
- Contributor implementation workflows.

## ADR File Home
- Store ADR files in `docs/adr/records/`.
- Use filename format `adr-<NNN>-<kebab-case-title>.md` and keep AI companions as `*.ai.md`.
- Keep broad design contracts in `docs/architecture/`; use ADRs for explicit architecture decisions and rationale.

## Standard ADR Sections
- Required: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional: `Supersession` (required whenever the ADR supersedes another ADR or is superseded) and `Follow-Up Actions`.
- Author from `docs/context/templates/adr.template.ai.md` to keep ADR memory durable and consistent.

## Start Here
- [ADR Records Home](./records/README.ai.md)
- [ADR Template](../context/templates/adr.template.ai.md)
- [Architecture Router](../architecture/README.ai.md)
- [Docs Top-Level Contract](../README.ai.md)
- [Baselines Router](../baselines/README.ai.md)
