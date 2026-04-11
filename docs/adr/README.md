# ADR Documentation Router

## Audience
- Engineers proposing or reviewing architectural decisions.
- Maintainers tracking supersession and decision history.

## Purpose
- Architecture Decision Records and supersession history.

## Belongs Here
- ADR documents with context, decision, status, and consequences.
- Superseded ADRs with replacement references.
- Decision history that affects long-term architecture direction.

## Does Not Belong Here
- General architecture reference material without a decision record.
- Operational runbooks and support procedures.
- Contributor implementation tutorials.

## ADR File Home
- Store ADR files in `docs/adr/records/`.
- Use filename format `adr-<NNN>-<kebab-case-title>.md` and pair AI companion files as `*.ai.md`.
- Keep architecture overviews/references in `docs/architecture/`; use ADRs only for explicit choices and tradeoffs.

## Standard ADR Sections
- Required: `Status`, `Decision Date`, `Decision Statement`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Chosen Approach`, `Consequences`, `Related Documentation`, and `Related Code Paths`.
- Optional: `Supersession` (required whenever the ADR supersedes another ADR or is superseded) and `Follow-Up Actions`.
- Use the template directly so decision records remain concise and consistent: `docs/context/templates/adr.template.md`.

## Start Here
- [ADR Records Home](./records/README.md)
- [ADR Template](../context/templates/adr.template.md)
- [Architecture Router](../architecture/README.md)
- [Docs Top-Level Contract](../README.md)
- [Baselines Router](../baselines/README.md)
