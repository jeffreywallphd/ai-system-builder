# Context Pack: Runtime Model

- Pack name: `runtime`

## Purpose

- Guide runtime-related implementation while preserving the repository’s TypeScript-first, adapter-driven model.

## Use When

- Implementing runtime execution flow or runtime contracts.
- Integrating Python/runtime adapters.
- Designing runtime boundary error/timing/translation behavior.

## Do Not Use When

- Tasks that do not touch runtime execution or runtime contracts.
- Pure UI, documentation-only, or host wiring changes with no runtime impact.

## Core Guidance

- Node.js + TypeScript is the default runtime path for core architecture.
- Use one orchestration model centered in application/domain design.
- Use one runtime contract model for boundary consistency.
- Support multiple runtimes through adapters (`modules/adapters/runtime/`), not feature-by-feature patterns.
- Keep shared runtime vocabulary in `modules/contracts/runtime/` and keep adapter protocol specifics out of core contracts.
- Use runtime readiness contracts for transport-neutral host-owned capability availability; do not use them as Python/ComfyUI protocol payloads or task lifecycle records.
- Keep runtime diagnostics as a strict specialization of shared logging vocabulary (not a parallel runtime-only diagnostics schema).
- Keep runtime operation identity helper-driven (`lowercase.dot.segments`) to prevent per-adapter naming drift.
- Keep runtime diagnostic mapping to `StructuredLogEvent` mechanical and stable across adapters.
- Keep runtime-specific mechanics out of domain/application logic.
- Treat Python as an adapter path, not a co-equal architecture center.
- Define or update runtime contracts before adding runtime-specific behavior.
- Runtime readiness describes capability availability before/around execution; the Runtime Task Registry remains the lifecycle authority for accepted long-running tasks. Runtime-backed feature starts should guard the derived feature capability when available, reject non-ready statuses as unavailable before task creation, and leave task read/cancel/list/status semantics to the registry. Rejected starts should not return pollable task ids. Model publishing has a composed readiness capability today, but desktop/server intentionally report it as unavailable/not implemented until a runtime task implementation exists.

## Runtime readiness vocabulary

- Shared readiness contracts live under `modules/contracts/runtime/` and are exported from the runtime family barrel.
- Capability ids currently cover Python runtime, ComfyUI runtime, image generation, dataset preparation, model training, model validation, and model publishing; model publishing is explicitly unavailable/not implemented in current desktop/server composition.
- Readiness status/action values are shared vocabulary for host/API/IPC/UI mapping; transports wrap these contracts rather than redefining them.
- The application runtime readiness service translates composed host-owned provider signals (for example supervisor health or installer status readers) into readiness snapshots using this vocabulary.
- A single readiness snapshot should use snapshot-scoped capability resolution: each top-level capability provider is read at most once, and derived feature dependency statuses should match the capability statuses resolved for that same snapshot.
- Snapshot scope is host-composed; default snapshots include composed provider capabilities only, while all known capabilities are reported only when a host explicitly chooses that scope.
- Missing-provider statuses are for direct capability reads or explicitly requested snapshot capabilities without providers, not for every capability a host intentionally does not support.
- Host composition provides concrete signal readers/providers and may combine multiple same-capability signals into one capability status; desktop IPC exposes the desktop host-scoped snapshot, while server API exposure remains deferred to a server prompt.
- Runtime-specific protocol details, filesystem paths, temp paths, secrets, tokens, raw exception messages, command lines, HTTP internals, and raw process data stay in adapters or diagnostics, not readiness fields; provider exceptions become sanitized `runtime.readiness.provider-failed` statuses with retry/view-logs actions and safe `failureKind`/`capabilityId` details only.
- The readiness service does not own process lifecycle, installation/discovery/repair/update status, or runtime task execution; supervisors, installer ports, and Runtime Task Registry remain the respective authorities. Readiness reads and task status/cancel/list reads must not start, stop, install, repair, or unboundedly probe runtimes. Provider-level failures should be isolated into sanitized readiness/status objects where possible.

## Key Constraints

- No runtime-specific leakage into core use-case or domain design.
- Avoid ad hoc per-feature protocols and speculative runtime plugin frameworks.
- Runtime protocol details that are not finalized must remain isolated and easy to evolve.
- Maintain runtime contract invariant tests for operation identity and runtime/logging diagnostic alignment.

## Canonical Source Docs

- `docs/adr/ADR-0002-typescript-first-runtime-model.md` — core runtime decision and alternatives rejected.
- `docs/architecture/runtime-model.md` — runtime responsibilities, boundaries, and open areas.
- `docs/architecture/module-dependency-rules.md` — dependency constraints for adapter integration.
- `docs/standards/coding-standards.md` — boundary-safe implementation requirements.
- `docs/standards/testing-standards.md` — testing approach for runtime adapters and boundaries.

## Common Over-Inclusions to Avoid

- Full host model details when runtime work is host-agnostic.
- Transport adapter specifics unless runtime invocation crosses transport boundaries.
- Unnecessary architecture background unrelated to runtime execution.

## Prompt Assembly Notes

## Host-owned runtime instances

- Runtime contracts are shared; runtime instances are host-owned.
- Desktop and server runtime roots/processes are independent by default.
- Future per-feature remote/local routing belongs in host composition.
- ADR-0013 is the canonical source for cross-host runtime ownership.


- Typical set: `index` + `runtime`.
- Add `architecture` for cross-layer decisions.
- Add `logging` for diagnosability-heavy runtime work and `testing` for bug fixes/refactors.

- Runtime env vars and logs must be redacted for secrets.
- Runtime temp paths should not be exposed to clients/contracts.
- Runtime/model/plugin downloads are supply-chain security concerns.

## Server API readiness note

- Server API readiness is now a server transport wrapper over the application `RuntimeReadinessService` and shared runtime readiness contracts. Reads are host-scoped and must remain no-start/no-install/no-repair; do not use image-generation/model endpoints as general readiness probes.

## Asset Kernel Notes

- Include `asset-kernel.pack.md` when assets declare runtime requirements or bind tools/workflows/models to runtime capabilities.
- Asset requirements should reference shared `RuntimeCapabilityId` values and must not duplicate runtime readiness or task-registry contracts.
- Asset validation may structurally check declared requirements, but it must not execute runtimes or probe heavy sidecars.
- Phase 3 image/generated-output resource-backed views are read-side descriptor projections only. They must not query runtime readiness, task status/list delegates, ComfyUI, or image-generation execution paths to discover outputs; already-known generated-output descriptors must be supplied through a safe descriptor source.
- Detail reads for generated-output views should use the injected generated-output descriptor read seam when available and must not fall back to Runtime Task Registry discovery. Generated outputs remain unfinalized/unregistered until a separate finalization/registration path runs elsewhere.
- Phase 4 Prompt 4 implements that separate internal finalization/registration path without making the Asset Kernel use case a runtime or task-registry reader. It re-reads only a safe generated-output descriptor/view by id and delegates resource persistence to a narrow image/artifact application port; it must not query Runtime Task Registry, runtime readiness, ComfyUI, Python runtimes, task lifecycle operations, runtime roots, or execution adapters.
- Dataset/model resource-backed views must not use runtime readiness, Runtime Task Registry, dataset preparation, model training, model validation, model publishing, or runtime/provider clients to discover or enrich records. Dataset views are descriptor-only, and model views read persisted inventory only with model discovery disabled.
- External repository object resource-backed views must not use runtime readiness, Runtime Task Registry, model publishing tasks, provider clients, or repository/cache/file reads to discover or refresh external objects. Persisted model publishing summaries may be projected only as already-known metadata and must not trigger publish status checks or runtime work.
- Phase 3 Review B preserves that boundary across aggregate reads: external provider labels are descriptor metadata only, repository object paths are omitted from public output by default, and cross-family aggregation must not call runtime readiness, Runtime Task Registry, provider clients, discovery, import/localize/publish, or byte/content reads.
- Phase 3 Prompt 7 desktop/server host wiring keeps that no-runtime boundary: the resource-backed provider aggregate is built from safe descriptor/read seams and is passed to the internal Asset Registry only. Runtime roots are not provider input, and provider construction/list/read paths must not call runtime readiness, Runtime Task Registry, ComfyUI, Python runtime, generation, finalization, dataset preparation, model training/validation/publishing, or runtime install/probe/start behavior.
- Phase 3 Prompt 8 confirms stabilization only: resource-backed Asset Registry reads remain descriptor projections and must not become runtime readiness probes, runtime task discovery, image generation/finalization, dataset preparation, model training/validation/publishing, workflow execution, install/repair/start behavior, or runtime-root scans.

## Asset Kernel built-in catalog note

- Phase 2B Prompt 4 built-in Asset Kernel definitions may declare `runtime-capability` requirements using shared `RuntimeCapabilityId` values (`image-generation`, `dataset-preparation`, `model-training`, `model-validation`, and `model-publishing`). These definitions do not query readiness, start runtimes, create runtime tasks, or imply executable/ready status. The `model-publishing` built-in explicitly remains unavailable/not implemented until a runtime publishing path exists.

