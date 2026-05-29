# Context Pack: Runtime Model

- Pack name: `runtime`

## Purpose

- Guide runtime-related implementation while preserving the TypeScript-first, adapter-driven architecture.
- Keep runtime execution, readiness, diagnostics, and task lifecycle responsibilities distinct.

## Use When

- Implementing runtime execution flow, runtime contracts, Python/ComfyUI adapters, runtime task behavior, runtime readiness, or runtime diagnostics.
- Diagnosing runtime-backed feature failures.
- Changing runtime root, sidecar, installer, or capability-provider behavior.

## Do Not Use When

- Pure UI/docs work with no runtime execution or capability impact.
- Host wiring work that only passes through existing runtime seams and does not change runtime behavior.

## Core Guidance

- Node.js + TypeScript is the default core runtime path.
- Python/ComfyUI and other runtimes are adapter paths under `modules/adapters/runtime`.
- Shared runtime vocabulary belongs in `modules/contracts/runtime`.
- Runtime-specific protocol details stay out of core contracts and application/domain logic.
- Runtime operation identity should be helper-driven and transport-neutral.
- Runtime diagnostics specialize shared structured logging; do not invent parallel runtime-only diagnostics.
- Runtime readiness describes host-owned capability availability; it is not a runtime protocol payload or task lifecycle record.
- Runtime Task Registry is the lifecycle authority for accepted long-running tasks.
- Feature starts should guard required readiness before task creation and should not return pollable task ids when rejected as unavailable.

## Runtime Readiness Rules

- Capability ids cover Python runtime, ComfyUI runtime, image generation, dataset preparation, model training, model validation, and model publishing.
- Model publishing may be composed as a readiness capability while still reporting unavailable/not implemented until a task implementation exists.
- Readiness snapshots are host-scoped and should read each top-level provider at most once per snapshot.
- Missing-provider statuses are for direct or explicitly requested capabilities, not every unsupported future capability.
- Readiness reads, task status reads, task cancel reads, and task list reads must not start, stop, install, repair, or unboundedly probe runtimes.
- Provider failures become sanitized readiness/status objects with safe codes/details.

## Key Constraints

- No runtime-specific leakage into domain/application logic.
- Avoid ad hoc per-feature protocols and speculative runtime plugin frameworks.
- Keep filesystem paths, temp paths, env values, secrets, tokens, raw exception messages, command lines, HTTP internals, process internals, and raw adapter payloads out of public readiness/task payloads.
- Runtime/model/plugin downloads are supply-chain concerns and should route through installer/security/storage guidance when touched.
- Runtime roots are not Asset Kernel record roots or resource-backed view discovery roots.

## Asset Kernel Notes

- Include `asset-kernel` when assets declare runtime requirements or bind tools/workflows/models to runtime capabilities.
- Asset requirements may reference shared `RuntimeCapabilityId` values but must not duplicate readiness or task-registry contracts.
- Asset validation may structurally check requirements but must not execute or probe runtimes.
- Resource-backed Asset Registry reads must not use runtime readiness, Runtime Task Registry, ComfyUI, Python runtimes, generation, finalization, dataset preparation, model training/validation/publishing, or runtime install/probe/start behavior to discover records.
- Generated-output finalization is a separate controlled workflow and must not make Asset Kernel reads query runtime/task state.

## Workspace Notes

- Runtime task outputs created from workspace actions require explicit workspace context where implemented.
- Missing workspace context must fail safely for workspace-owned runtime outputs and must not fall back to global records.
- Global runtime readiness and provider diagnostics may remain global but must not masquerade as workspace-owned resources.

## Canonical Source Docs

- `docs/adr/ADR-0002-typescript-first-runtime-model.md` - core runtime decision.
- `docs/adr/ADR-0013-cross-host-runtime-ownership.md` - desktop/server runtime ownership.
- `docs/architecture/runtime-model.md` - runtime responsibilities and boundaries.
- `docs/architecture/runtime-readiness-binding.md` - readiness/capability handoff.
- `docs/architecture/module-dependency-rules.md` - adapter dependency constraints.
- `docs/standards/logging-standards.md` - runtime diagnostics and redaction.
- `docs/standards/testing-standards.md` - runtime adapter and boundary testing.

## Companion Packs

- `runtime-task-registry` for start/read/cancel/list lifecycle behavior.
- `runtime-installer` for installation, dependency setup, and installer state.
- `image-generation` for ComfyUI/image generation feature behavior.
- `server-host` or `desktop-host` when host-owned runtime composition changes.
- `security` for process, dependency, env, credential, and diagnostic hardening.
- `testing` for runtime regressions and adapter behavior.

## Common Over-Inclusions To Avoid

- Full host model detail for host-agnostic runtime contract work.
- Transport adapter specifics unless invocation crosses API/IPC boundaries.
- Treating readiness reads as health probes that start or repair sidecars.
- Keeping phase history in runtime prompt context.

## Prompt Assembly Notes

- Typical set: `index` + `runtime`.
- Add `runtime-task-registry`, `runtime-installer`, or feature packs only when those responsibilities are directly touched.
- Add `logging` for diagnosability-heavy runtime work and `testing` for fixes/refactors.
