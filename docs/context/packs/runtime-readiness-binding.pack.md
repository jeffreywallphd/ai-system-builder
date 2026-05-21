# Context Pack: Runtime Readiness Binding (Phase 11)

- Pack name: `runtime-readiness-binding`

## Purpose

- Route prompts that define or implement Phase 11 runtime readiness binding behavior.
- Keep readiness capability/binding work non-executing and composition-plan dependent.

## Use When

- Runtime readiness checks over validated composition plans.
- Runtime capability inventory, requirements, provider availability, model/storage/service availability.
- Binding candidates, capability gaps, blockers, diagnostics, and Phase 12 execution handoff metadata.

## Canonical docs/files to inspect

- `docs/architecture/runtime-readiness-binding.md`
- `docs/adr/ADR-0021-runtime-readiness-binding.md`
- `docs/architecture/asset-composition-planning.md`
- `docs/adr/ADR-0020-asset-composition-planning.md`
- `docs/architecture/effective-asset-projections.md`
- `docs/adr/ADR-0019-effective-asset-projections.md`
- Runtime/adapter architecture docs and safe runtime adapter seams when present.

## Core constraints

- Phase 11 is non-executing readiness only.
- Depend on validated Phase 10 composition plans.
- Use safe runtime inventory abstractions only.
- Surface explicit blockers/diagnostics for missing, unavailable, unsupported, stale, invalid, or unvalidated requirements.
- Do not expose secrets/tokens/raw env/raw paths/bytes/base64/provider payloads/signed URLs.

## Anti-drift rules

- Never label Phase 11 as executable/ready-to-run/running/completed.
- Never bypass Phase 10 validated plan requirements.
- Never invoke providers/models/runtimes in readiness checks.
- Never install dependencies or download models in Phase 11.
- Keep readiness status/blocker vocabulary stable and conservative.

## Relationship to Phase 9, Phase 10, and runtime adapters

- Phase 11 primarily consumes Phase 10 validated plan outputs.
- Phase 9 projection summaries are secondary freshness context only when surfaced safely by Phase 10 read models.
- Runtime adapters/hosts provide safe inventory summaries through application seams; no execution methods are called.

## Phase 11 prompt ownership

- Prompt 1: architecture baseline + ADR + docs/context pack.
- Prompt 2+: contracts/ports/persistence/readiness services/read models/transports/UI (as separately scoped prompts).

## Prompt 8 transport status

- API, IPC, preload, and client transport exposure is intended to remain thin and workspace-explicit.
- Operation families should be semantically aligned across API/IPC/preload/desktop-client/thin-client surfaces.
- Deferred or unavailable operations must be represented consistently and safely.
- Visible runtime-readiness UI remains deferred (Prompt 9 scope).
- Runtime/provider/workflow/model execution remains out of scope for Prompt 8.

## Non-goals

- Workflow/runtime/model/ComfyUI execution.
- Provider invocation.
- Runtime installation, model download, credential creation, secret storage.
- Shell commands, environment mutation, workflow JSON generation, executable payload generation.
- Pack import/export, marketplace, collaboration permissions, live cross-workspace sync.

## Phase 12 handoff

Phase 11 outputs readiness-binding metadata for Phase 12 execution plan preparation/materialization planning. Execution remains deferred unless a later phase explicitly enables it.
