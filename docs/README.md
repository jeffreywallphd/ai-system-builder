# Documentation Map

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

This directory is organized into four documentation areas with distinct roles.

## Areas and Roles

- `docs/adr/`
  - Architecture Decision Records (ADRs): major architectural decisions and rationale.
- `docs/architecture/`
  - Current intended system structure, module boundaries, and operating model.
  - `docs/architecture/user-library-and-cross-workspace-reuse.md` defines User Library reuse, explicit promote/link/copy/import relationships, provenance, and propagation constraints.
  - `docs/architecture/asset-authoring-customization-and-overrides.md` defines workspace-scoped asset authoring, customization, and override architecture.
- `docs/standards/`
  - Canonical implementation and documentation rules.
- `docs/context/`
  - Reusable context-assembly support for prompts and implementation work.

## How to Use These Docs

- Read ADRs for major decision history and constraints.
- Read architecture docs for structure and boundary guidance.
- Read standards docs for canonical rules to follow during implementation.
- Use context docs to assemble task-relevant current context without replacing canonical docs.
- If context docs conflict with ADR/architecture/standards docs, canonical docs take precedence.

## Current Architecture Pointers

- Workspace model: `docs/architecture/workspace-model.md`, including reference-only `system.foundation@1.0.0` activation and the no-hidden-workspace/no-auto-migration rule.
- User Library reuse: `docs/architecture/user-library-and-cross-workspace-reuse.md` and ADR-0017.
- Asset authoring, customization, and overrides: `docs/architecture/asset-authoring-customization-and-overrides.md` and ADR-0018.
- Effective asset projections: `docs/architecture/effective-asset-projections.md` and ADR-0019.
- Asset composition planning: `docs/architecture/asset-composition-planning.md` and ADR-0020.
- Runtime readiness binding: `docs/architecture/runtime-readiness-binding.md` and ADR-0021.
- Execution plan preparation: `docs/architecture/execution-plan-preparation.md` and ADR-0022.
- Controlled conversational execution: `docs/architecture/controlled-conversational-system-execution.md` and ADR-0023.

## Automation Note

- Start prompt assembly from `docs/context/packs/index.pack.md`.
- Use `docs/context/prompt-routing.md` to choose only additional packs that are materially relevant.
- Include `docs/context/packs/persistence-storage.pack.md` for DB-vs-file/blob boundary work.


## Execution Context References

- Execution plan preparation pack: `docs/context/packs/execution-plan-preparation.pack.md`.
- Controlled conversational execution pack: `docs/context/packs/controlled-conversational-system-execution.pack.md`.
- Execution requires explicit approval plus supported runtime invocation boundaries.
