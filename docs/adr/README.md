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

## Start Here
- [ADR Records Home](./records/README.md)
- [ADR Template](../context/templates/adr.template.md)
- [Architecture Router](../architecture/README.md)
- [Docs Top-Level Contract](../README.md)
- [Baselines Router](../baselines/README.md)
