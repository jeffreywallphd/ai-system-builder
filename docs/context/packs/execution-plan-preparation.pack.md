# Context Pack: Execution Plan Preparation (Phase 12)

- Pack name: `execution-plan-preparation`
- Scope: Phase 12 planning architecture and related doc work.

## Purpose

Define and protect the non-executing execution-plan-preparation layer that turns runtime-readiness-backed composition context into safe execution plan candidates/previews shown inside Assets / Plans / Setup.

## Use When

Include this pack when tasks materially involve:

- execution plan preparation,
- execution plan candidates/previews,
- planned steps/dependencies,
- planned inputs/outputs,
- safety gates/preflight/dry-run planning,
- execution blockers/diagnostics,
- Phase 13 handoff boundaries.

## Canonical docs/files to inspect

- `docs/architecture/execution-plan-preparation.md`
- `docs/adr/ADR-0022-execution-plan-preparation.md`
- `docs/context/packs/runtime-readiness-binding.pack.md` (when readiness binding dependencies are involved)
- `docs/context/packs/asset-composition-planning.pack.md` (when source composition references are involved)
- `docs/context/packs/effective-asset-projections.pack.md` (when projection freshness/staleness affects planning)

## Core constraints

- Planning layer only; no execution.
- Workspace-scoped ownership.
- Depend on safe Phase 11 readiness binding metadata.
- Use safe adapter/provider references only (no raw credentials/env/paths/payloads).
- Produce inspectable, conservative status/blocker/diagnostic outputs.

## Anti-drift rules

- Do not label Phase 12 as runnable/executed/completed.
- Keep `ready-for-review` explicitly non-executing.
- Keep preflight/dry-run semantics metadata-only.
- Do not add provider/runtime invocation behavior to Phase 12 docs/contracts in this phase.
- Keep plan records sanitized (no commands, workflow execution JSON, provider payloads, secrets, raw paths, base64/blobs, signed URLs).

## Relationship to Phase 9 / Phase 10 / Phase 11 / runtime adapters

- Phase 9: do not reconstruct projection internals.
- Phase 10: composition plan is an upstream reference surface.
- Phase 11: runtime readiness binding is the required prerequisite seam.
- Runtime adapters: referenced by safe adapter identity only; invocation deferred.

## Phase 12 prompt ownership sequence

1. Prompt 1 — architecture baseline, ADR, docs, context pack.
2. Prompt 2 — contract vocabulary.
3. Prompt 3 — application ports + persistence adapters.
4. Review A.
5. Prompt 4 — requirements/step derivation from runtime-ready bindings.
6. Prompt 5 — provider-specific planning adapters (still non-executing).
7. Prompt 6 — safety gates, dry-run validation, resource estimates, blockers/diagnostics.
8. Review B.
9. Prompt 7 — read model integration.
10. Prompt 8 — API/IPC/preload/client exposure (optionally 8a/8b/8c split).
11. Prompt 9 — minimal execution preview UI.
12. Prompt 10 — docs hardening/closeout.
13. Review C.

## Non-goals

No runtime/provider/workflow/model execution, no executable payload generation, no dependency install/model download, no credential/secret creation/storage, no shell/env mutation, no job lifecycle/progress/cancellation/runtime logs, no pack import/export, no marketplace/collaboration/live sync, no source-record mutation.

## Phase 13 handoff

Phase 12 hands off prepared execution plan metadata to Phase 13 execution orchestration and controlled runtime/provider invocation.
