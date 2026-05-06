# Runtime Model

## Runtime posture

`ai-system-builder` is **TypeScript-first**.

- Node.js + TypeScript is the native/default runtime path.
- Core architecture (domain, application, contracts, host composition) is designed around this default.

This is a deliberate constraint to keep early implementation coherent and maintainable.

## Why support multiple runtimes at all

Some capabilities are best sourced from non-Node ecosystems (for example, Python-based tools or libraries).

The architecture therefore allows runtime plurality, but in a controlled way:

- external runtimes are integrated through explicit runtime contracts,
- external runtime execution sits in adapter space,
- core use cases remain in application/domain.

## Python position

Python is the first expected external runtime integration path.

Important boundary statement:

- Python is an adapter concern, **not** a co-equal architectural center.
- The system should work with zero Python dependencies for core behavior not requiring runtime adapters.

## Runtime layer responsibilities

Runtime adapters (under `modules/adapters/runtime/`) may own:

- process/session orchestration for external runtime execution,
- request/response translation to runtime contracts,
- error mapping, timeout/retry behavior at the boundary,
- runtime environment checks and adapter-level observability.

Runtime adapters should not own:

- business policy decisions,
- cross-use-case orchestration that belongs in application,
- domain invariants.

## Contract-first runtime integration

Runtime interactions must be described by explicit contracts (via `modules/contracts/`), such as:

- invocation payload shapes,
- expected result envelopes,
- error categories and normalization expectations.

Current baseline runtime contract family:

- `modules/contracts/runtime/runtime-target.ts` for runtime kind/target selection.
- `modules/contracts/runtime/runtime-execution-request.ts` for request envelope and execution options.
- `modules/contracts/runtime/runtime-execution-result.ts` and `runtime-execution-error.ts` for shared success/failure envelopes.
- `modules/contracts/runtime/runtime-execution-event.ts` and `runtime-execution-diagnostic.ts` for optional progress/output/diagnostic streaming.
- `modules/contracts/runtime/runtime-capability-id.ts`, `runtime-readiness-status.ts`, `runtime-readiness-action.ts`, `runtime-capability-status.ts`, and `runtime-readiness-snapshot.ts` for transport-neutral runtime readiness vocabulary.
- `modules/application/ports/runtime/runtime-execution.port.ts` as the application-facing runtime execution seam.
- `modules/application/services/runtime/runtime-readiness.service.ts` and `modules/application/ports/runtime/runtime-readiness.port.ts` as the application-level seam that maps host-owned runtime lifecycle signals into shared readiness snapshots.

## Runtime readiness contracts

Runtime readiness contracts describe host-owned capability availability before and around runtime task execution. They are shared contracts, not IPC/API/UI contracts and not Python or ComfyUI protocol models.

The readiness vocabulary covers these capability ids: `python-runtime`, `comfyui-runtime`, `image-generation`, `dataset-preparation`, `model-training`, `model-validation`, and `model-publishing`. Readiness statuses are `unknown`, `unavailable`, `not-installed`, `installing`, `starting`, `ready`, `degraded`, and `failed`. Recovery/action hints are `wait`, `start`, `install`, `repair`, `configure`, `retry`, and `view-logs`.

Readiness snapshots may include `capabilityId`, `status`, `healthy`, `available`, `summary`, structured `reason`, `recommendedActions`, generic `details`, `updatedAt`, dependency statuses, and optional host identity metadata. Snapshot scope is host-composed: a host should report only the capabilities it intentionally composes, unless it explicitly asks for every globally known capability. A missing-provider `unknown` status is appropriate for a direct `getCapabilityStatus()` call or an explicitly scoped snapshot capability without a provider; it should not be emitted for every known capability a host intentionally does not support. Within one snapshot read, dependency statuses used by derived feature capabilities must come from the same snapshot-scoped resolution as top-level capability entries so snapshots stay internally coherent and avoid repeated runtime/installer/supervisor reads. Runtime-specific mechanics such as Python protocol payloads, ComfyUI workflow/server details, local filesystem paths, temporary paths, process environment, secrets, and tokens must remain adapter-layer details and are not required shared readiness fields.

Runtime-backed feature starts must use an application-layer readiness guard for the derived feature capability when one exists (for example `image-generation`, `dataset-preparation`, `model-training`, `model-validation`, or runtime-backed `model-publishing`). The guard reads `RuntimeReadinessPort`, allows `ready` (and `degraded` only when explicitly configured by the caller), and rejects other statuses with transport-neutral unavailable details; it must not start, stop, install, repair, probe, or execute runtimes. Transports map these guarded-start rejections to IPC `unavailable` or API HTTP 503 failure envelopes with safe capability details, while task status, cancel, finalize-read, artifact, settings, and browse flows continue to use their existing semantics.

Readiness does not replace `RuntimeTaskRegistryPort`. Readiness answers whether a host-owned capability appears available; the Runtime Task Registry still owns long-running task lifecycle operations (`startTask`, `getTaskStatus`, `cancelTask`, and listing/retention). Runtime installer contracts still own install/discovery/repair/update status. Runtime supervisors still own concrete process lifecycle and health checks. The application readiness service is transport-neutral and UI-neutral: it reads composed provider signals, maps known supervisor/installer states into the shared readiness vocabulary, derives feature capability status from runtime dependencies, reuses snapshot-scoped dependency statuses for derived capabilities, and must not start, stop, install, repair, probe, or execute runtimes. Host composition provides concrete provider closures/readers and may combine multiple same-capability signals (for example installer status plus supervisor health) into one readiness capability. Provider-level failures should be represented as readiness status objects when the readiness service can isolate them. Installer status remains generic `details` context such as `installStatus`; it does not replace supervisor process readiness. When install status is `unknown` while the supervisor is `ready`, the combined readiness status is `degraded` so callers see that execution appears available but install state is unresolved. Desktop IPC and server API routes expose host-scoped readiness snapshots and per-capability status by wrapping the shared readiness contracts in transport envelopes; they must not duplicate readiness shapes or start/stop/install/repair/probe runtimes during reads. Python-specific runtime IPC remains a detailed control and diagnostic surface, not the generic readiness model.

Runtime diagnostic normalization rule:

- `RuntimeExecutionDiagnostic` is a runtime specialization of shared structured logging vocabulary.
- Runtime diagnostics use the shared level/verbosity/outcome/error semantics from `modules/contracts/logging`.
- Runtime diagnostic event names use the `runtime.*` namespace and can be mechanically mapped to `StructuredLogEvent` without ad hoc field translation.

Runtime family normalization rules:

- Runtime operation names must use shared operation identity formatting (`lowercase.dot.segments`) via runtime/shared helpers, not ad hoc string conventions.
- Runtime diagnostics must be additive to logging contracts (for example `executionId` and `stage`) and must not redefine level/verbosity/error semantics.
- Runtime contract exports must stay family-local (`modules/contracts/runtime/index.ts`) and avoid re-exporting non-runtime families.
- Runtime contract tests must protect operation identity normalization and diagnostic-to-structured-log mapping behavior.
- Application runtime orchestration should depend on runtime and logging ports as separate seams; do not collapse runtime execution and logging concerns into one port surface.

This prevents feature teams from creating one-off runtime integration styles per feature.

## What is not finalized yet

The following runtime details are intentionally **not yet standardized**:

- exact wire protocol format across all runtime adapters,
- final process model (for example, long-lived worker vs. per-invocation process in each scenario),
- universal runtime capability discovery/version negotiation mechanism,
- final developer ergonomics for local/runtime adapter tooling.

Contributors should avoid hard-coding assumptions as if these are settled. Use contracts and isolate adapter logic so evolution remains low-cost.

## Practical guidance for contributors

When adding runtime-related functionality:

1. Define/extend a runtime contract first.
2. Implement runtime specifics in `modules/adapters/runtime/`.
3. Keep application use cases runtime-agnostic (depend on ports/contracts).
4. Keep domain unaware of runtime mechanics.
5. Record significant runtime decisions in ADRs when they affect long-term architecture.



## Host-owned runtime instances

Runtime contracts and adapters are shared; runtime instances are owned by the executing host. Runtime task records describe lifecycle semantics, not physical runtime location.

Desktop and server may both use ComfyUI adapters, but each host owns its own process/install/cache state by default. Runtime roots store sidecar installs, managed Python environments, dependency state, caches, and temp outputs. Artifact storage stores durable user/system artifacts.

`SERVER_RUNTIME_ROOT` and `SERVER_STORAGE_ROOT` should be separate. Remote execution placement should be implemented in host composition through adapter/client substitution, not by changing application/domain logic.

ADR-0013 is the canonical cross-host runtime ownership ADR.

## Runtime security guidance

Runtime adapters must harden process invocation against command injection, control/redact runtime environment variables, and avoid exposing runtime temp paths to clients. Python/ComfyUI runtime logs must redact secrets. Model/plugin/download flows are supply-chain inputs and need explicit risk controls. Runtime security is part of the system security architecture, but runtime code remains in runtime adapters rather than being moved into a monolithic security module. See ADR-0015.

## Server runtime readiness API

- The server API exposes host-scoped runtime readiness through the application `RuntimeReadinessService` at `GET /api/runtime/readiness` and `GET /api/runtime/capabilities/:capabilityId`.
- These reads wrap the shared `RuntimeReadinessSnapshot`, `RuntimeCapabilityStatus`, and `RuntimeCapabilityId` contracts; API-specific files must not duplicate the readiness shape.
- Readiness reads are no-start/no-install/no-repair operations: they may read bounded supervisor/installer status, but they must not start Python or ComfyUI, call feature-specific generation/model endpoints, install, repair, or probe runtime sidecars as a general readiness check.
- Feature-specific endpoints remain execution APIs, not general runtime readiness probes. Desktop IPC readiness exposure remains a separate transport surface from the server API, and thin-client UI consumption is deferred to later UI prompts.
