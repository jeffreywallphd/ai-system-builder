# AI Companion: Documentation Placement Guide

## Purpose
- Route new docs into the correct taxonomy area so contributors and AI agents avoid maintenance drift.

## Area Routing Contract
- `docs/architecture/`: architecture contracts, boundaries, invariants, and durable design explanations.
- `docs/contributors/`: contributor implementation workflows, extension guardrails, and coding process constraints.
- `docs/operations/`: runbooks, diagnostics, troubleshooting, and admin/runtime procedures.
- `docs/baselines/`: historical snapshots, migration inventories, and completion baselines.
- `docs/adr/`: decision records with status, alternatives, and supersession history.
- `docs/context/`: shared taxonomy/glossary and cross-domain context for human/AI reasoning.
- `docs/prompts/`: prompt templates and prompt-engineering helpers.
- `docs/ui/`: UI behavior/UX contracts and frontend interaction rules.

## Quick Decision Flow
1. Formal decision record? -> `docs/adr/`.
2. Architecture explanation/contract? -> `docs/architecture/`.
3. Runtime operations/runbook? -> `docs/operations/`.
4. Contributor implementation workflow? -> `docs/contributors/`.
5. Historical baseline/migration snapshot? -> `docs/baselines/`.
6. Shared taxonomy/AI context pack? -> `docs/context/`.
7. Prompt template/helper? -> `docs/prompts/`.
8. UI behavior contract? -> `docs/ui/`.
9. If mixed role, keep one authoritative location and link from secondary areas.

## Required Examples
- Architecture explanation -> `docs/architecture/`.
- Runbook -> `docs/operations/`.
- Historical baseline -> `docs/baselines/`.
- ADR -> `docs/adr/`.
- AI-context taxonomy/glossary -> `docs/context/`.

## Anti-Patterns
- Runbooks in `docs/architecture/`.
- Contributor workflow docs in `docs/operations/`.
- Historical snapshots mixed into active canonical docs.
- Duplicated authority across folders instead of linking.
- Shared AI-context notes embedded directly in feature runbooks.

## Human Companion
- `docs/contributors/docs-placement-guide.md`
