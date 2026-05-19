# Documentation Map

This directory is organized into four documentation areas with distinct roles.

## Areas and Roles

- `docs/adr/`
  - Architecture Decision Records (ADRs): major architectural decisions and rationale.
- `docs/architecture/`
  - Current intended system structure, module boundaries, and operating model.
  - `docs/architecture/user-library-and-cross-workspace-reuse.md` is the Phase 7 baseline for User Library reuse, explicit promote/link/copy/import relationships, provenance, and propagation constraints.
- `docs/standards/`
  - Canonical implementation and documentation rules.
- `docs/context/`
  - Reusable context-assembly support for prompts and implementation work.

## How to Use These Docs

- Read ADRs for major decision history and constraints.
- Read architecture docs for structure and boundary guidance.
- Read standards docs for canonical rules to follow during implementation.
- Use context docs to assemble task-relevant context without replacing canonical docs.
- If context docs conflict with ADR/architecture/standards docs, canonical docs take precedence.


## Current roadmap checkpoint

- Phase 6 is **Workspace Foundations**. Workspace-owned operations must carry explicit workspace context through contracts, clients, transports, use cases, ports, providers, and persistence; UI gating alone is not sufficient.
- Phase 7 is **User Library and Cross-Workspace Asset Reuse**.
- Phase 8 is **Asset Authoring, Customization, and Override Management**.
- Phase 9 is **Composition Planning and Authoring**.
- Phase 10 is **Execution Binding and Runtime-Orchestrated Systems**.
- Phase 11 is **Pack Import/Export, Sharing, and Distribution**.
- Phase 12 is **Collaboration, Permissions, and Multi-User Workspaces**.

See `docs/architecture/workspace-model.md` for the Phase 6 workspace model, including reference-only `system.foundation@1.0.0` activation and the no-hidden-workspace/no-auto-migration rule. See `docs/architecture/user-library-and-cross-workspace-reuse.md` and ADR-0017 for the finalized Phase 7 reuse closeout state and Phase 8 handoff constraints.

## Automation Note

- Start prompt assembly from `docs/context/packs/index.pack.md`.
- Use `docs/context/prompt-routing.md` to choose only additional packs that are materially relevant.
- Include `docs/context/packs/persistence-storage.pack.md` for DB-vs-file/blob boundary work.
