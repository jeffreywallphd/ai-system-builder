# Context Pack: Architecture

- Pack name: `architecture`

## Purpose

- Provide a compact, high-signal summary of repository architectural rules and boundary discipline.

## Use When

- Designing or modifying cross-layer behavior.
- Creating/moving modules where dependency direction matters.
- Reviewing architecture-sensitive refactors.

## Do Not Use When

- Narrow content-only doc edits with no architecture impact.
- Small local changes that do not cross boundaries.

## Core Guidance

- Maintain clean architecture direction: inner layers (domain/application) must not depend on outer infrastructure/host/UI layers.
- Keep contracts explicit at boundaries; avoid embedding boundary semantics in ad hoc types.
- Treat hosts (desktop/server) and transport (IPC/HTTP) as separate concerns.
- Preserve shared-first UI: reusable components in shared UI, thin platform-specific layers.
- Follow TypeScript-first runtime posture; external runtimes are adapter extensions, not architecture centers.
- Keep persistence (structured durable records) distinct from storage (artifact/file/blob concerns).
- Prefer disciplined simplicity: avoid premature frameworks, plugin systems, and package explosion.

## Key Constraints

- Business logic belongs in domain/application, not route handlers, IPC handlers, or host bootstrap code.
- Transport/framework specifics must stay in adapters.
- Changes to architectural boundaries require canonical doc updates and often ADR updates.

## Canonical Source Docs

- `docs/architecture/README.md` — architecture document usage model and review heuristics.
- `docs/architecture/system-overview.md` — overall system shape and boundary intent.
- `docs/architecture/module-dependency-rules.md` — explicit allowed/disallowed dependencies.
- `docs/architecture/runtime-model.md` — runtime boundary model.
- `docs/architecture/host-model.md` — host responsibilities and staging posture.
- `docs/architecture/persistence-and-storage.md` — persistence/storage separation model.
- `docs/adr/ADR-0002-typescript-first-runtime-model.md` — TypeScript-first decision.
- `docs/adr/ADR-0003-host-model-and-transport-separation.md` — host vs transport decision.
- `docs/adr/ADR-0004-persistence-and-storage-separation.md` — persistence/storage decision.

## Common Over-Inclusions to Avoid

- Pulling host-specific pack content when no host concerns are touched.
- Repeating entire architecture docs in prompts instead of referencing them.
- Adding speculative future hybrid/plugin design constraints not yet decided.

## Prompt Assembly Notes

- Typical set: `index` → `repository-overview` (optional) → `architecture`.
- Add one specialized pack (`runtime`, `desktop-host`, `server-host`, `logging`, `testing`) based on concrete task scope.
