# Documentation Map

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

This directory separates canonical system guidance from downstream task context and operational support material.

## Canonical Areas

- `docs/adr/`
  - Architecture Decision Records (ADRs): major architectural decisions and rationale.
- `docs/architecture/`
  - Current intended system structure, module boundaries, and operating model.
  - `docs/architecture/user-library-and-cross-workspace-reuse.md` defines User Library reuse, explicit promote/link/copy/import relationships, provenance, and propagation constraints.
  - `docs/architecture/asset-authoring-customization-and-overrides.md` defines workspace-scoped asset authoring, customization, and override architecture.
- `docs/standards/`
  - Canonical implementation and documentation rules.
- `docs/context/`
  - Downstream context-assembly support for implementation work; it summarizes canonical sources but does not replace them.

## Supporting Areas

- `docs/security/`
  - Security-oriented operational checks and manual verification guidance.
- `docs/diagnostics/`
  - Focused diagnostic and regression-check procedures.
- `docs/docs-mismatch-register.md`
  - Visible record of unresolved conflicts between code and documentation.
- `docs/context/templates/`
  - Templates for durable epic, feature, and story context artifacts.

## Start by Task

- Any repository task: read the root `AGENTS.md`, then `docs/context/packs/index.pack.md`.
- Narrow implementation task: use `docs/context/prompt-routing.md` to add only materially relevant packs.
- Architecture or dependency change: read `docs/architecture/system-overview.md`, `docs/architecture/module-dependency-rules.md`, and related ADRs.
- Persistence or deployment work: read `docs/architecture/persistence-and-storage.md`, `docs/architecture/host-model.md`, ADR-0003, and ADR-0004.
- Documentation work: read `docs/standards/documentation-standards.md` and use the canonical templates listed there.
- Automated or repository-scale implementation: read `docs/standards/ai-agent-development-standards.md`, apply `docs/standards/change-impact-matrix.md`, and check `docs/adr/decision-readiness.md`.
- Architecture verification: use `docs/architecture/architecture-verification.md` to distinguish direct fitness functions from representative coverage and known gaps.
- Agent-support evaluation: use `docs/context/pack-catalog.json`, `dev-tools/agent-evals/scenarios.json`, and `docs/standards/agent-support-evaluation-standards.md`.
- Security-sensitive work: add `docs/context/packs/security.pack.md` and inspect `docs/security/`.

If context guidance conflicts with an ADR, architecture document, or standard, the canonical source takes precedence and the conflict must be corrected or recorded.

## Current Architecture Pointers

- Workspace model: `docs/architecture/workspace-model.md`, including reference-only `system.foundation@1.0.0` activation and the no-hidden-workspace/no-auto-migration rule.
- User Library reuse: `docs/architecture/user-library-and-cross-workspace-reuse.md` and ADR-0017.
- Asset authoring, customization, and overrides: `docs/architecture/asset-authoring-customization-and-overrides.md` and ADR-0018.
- Effective asset projections: `docs/architecture/effective-asset-projections.md` and ADR-0019.
- Asset composition planning: `docs/architecture/asset-composition-planning.md` and ADR-0020.
- System Builder: `docs/architecture/system-builder.md` and ADR-0024; Systems is workspace-scoped while builder-application status belongs to Settings / Software status.
- Runtime readiness binding: `docs/architecture/runtime-readiness-binding.md` and ADR-0021.
- Execution plan preparation: `docs/architecture/execution-plan-preparation.md` and ADR-0022.
- Controlled conversational execution: `docs/architecture/controlled-conversational-system-execution.md` and ADR-0023.

## Agent Context

- Start prompt assembly from `docs/context/packs/index.pack.md`.
- Use `docs/context/prompt-routing.md` to choose only additional packs that are materially relevant.
- Include `docs/context/packs/persistence-storage.pack.md` for DB-vs-file/blob boundary work.


## Execution Context References

- Execution plan preparation pack: `docs/context/packs/execution-plan-preparation.pack.md`.
- Controlled conversational execution pack: `docs/context/packs/controlled-conversational-system-execution.pack.md`.
- Execution requires explicit approval plus supported runtime invocation boundaries.

## Verification

- Run `npm run docs:check` after documentation or context changes.
- Run `npm test` after implementation changes and before handoff when practical.
- Continuous integration enforces both gates for pull requests and changes to the default branch.
