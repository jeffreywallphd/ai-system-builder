# Prompt Routing

Use this guide to select **minimum-sufficient** context packs for prompts.

## Baseline (Always Include)

- `docs/context/packs/index.pack.md` is the authoritative baseline pack.
- Include it in all automated prompt assembly.

## Add Packs by Task Concern

| If the task materially involves... | Add this pack |
| --- | --- |
| repo layout, module placement, dependency direction at a repo level | `docs/context/packs/repository-overview.pack.md` |
| cross-layer architecture or boundary decisions | `docs/context/packs/architecture.pack.md` |
| assets, asset definitions/instances/bindings/compositions, systems/subsystems/features as composable assets, UI components/pages as assets, workflows/tools as assets, resource-backed assets, generated outputs as assets, Hugging Face objects as asset/resource backings, AI-readable asset context, asset validation, asset configuration, asset ports/composition rules, Asset Registry read-facade transport wrappers, or Asset Library UI | `docs/context/packs/asset-kernel.pack.md` |
| authn/authz, credential handling, transport encryption, storage security, audit, runtime/process security policy | `docs/context/packs/security.pack.md` |
| runtime adapters, runtime contract shape, runtime execution flow | `docs/context/packs/runtime.pack.md` |
| runtime task registry lifecycle for long-running runtime tasks (start/read/cancel, shared lifecycle/progress/retention semantics) | `docs/context/packs/runtime-task-registry.pack.md` |
| image generation feature architecture/contracts, ComfyUI runtime-sidecar concerns, image asset modeling | `docs/context/packs/image-generation.pack.md` |
| runtime installer architecture, installer contracts/ports, install-state modeling | `docs/context/packs/runtime-installer.pack.md` |
| Electron/desktop host lifecycle, IPC/preload boundaries, desktop composition | `docs/context/packs/desktop-host.pack.md` |
| Electron IPC contracts, operation-derived channels, handler registration, preload invoke boundaries | `docs/context/packs/ipc-electron.pack.md` |
| desktop renderer structure, page/feature/component boundaries, renderer API-client usage | `docs/context/packs/desktop-implementation.pack.md` |
| desktop renderer CSS/style architecture, shared style layering, token-first styling decisions | `docs/context/packs/desktop-styling.pack.md` |
| server host lifecycle, Express transport boundaries, thin web client coupling | `docs/context/packs/server-host.pack.md` |
| persistence vs storage responsibilities, ingestion/staged-artifact semantics for uploads/scrape/generated intake paths, artifact browser/read/view contracts (list/detail/content separation), shared storage foundation contracts (`StorageKind`, `StorageProviderId`, `StorageBackingReference`), artifact-object storage contracts, artifact-repo storage contracts/provider concerns (including Hugging Face dataset/model repo integration direction), AppData/server roots, metadata-vs-file boundaries | `docs/context/packs/persistence-storage.pack.md` |
| documentation updates, canonical-vs-context discipline, doc governance | `docs/context/packs/docs-standards.pack.md` |
| structured logging behavior, diagnosability, log field/level discipline | `docs/context/packs/logging.pack.md` |
| test strategy, regression coverage, layered testing expectations | `docs/context/packs/testing.pack.md` |
| debugging, error diagnosis, failure lifecycle analysis, bug-fix prompts | `docs/context/packs/debugging-error-handling.pack.md` |

## Debugging/Error Routing (Explicit)

For prompts containing debugging/failure language (for example: `error`, `bug`, `broken`, `failed`, `fails`, `exception`, `stack trace`, `traceback`, `diagnose`, `debug`, `fix this issue`, `fetch failed`, `hangs`, `timeout`, `progress not updating`, `background task`, `runtime keeps running`, `transport disconnect`, `IPC failure`, `preload failure`, `worker failure`, `Python runtime failure`):

- Always include `docs/context/packs/debugging-error-handling.pack.md`.
- If the failure touches runtime/Python/worker/background-task behavior, also include `docs/context/packs/runtime.pack.md`.
- If the failure touches IPC/preload/desktop transport boundaries, also include `docs/context/packs/desktop-host.pack.md` (and `docs/context/packs/server-host.pack.md` when server transport boundaries are involved).
- If the failure touches renderer/UI state or progress display, also include `docs/context/packs/desktop-implementation.pack.md` (and `docs/context/packs/desktop-styling.pack.md` only when styling behavior is part of the defect).

Routing rule for feature prompts:

- If the task relates to image generation, ComfyUI, or image assets, include `docs/context/packs/image-generation.pack.md`.
- If the task relates to runtime installer, auto install, ComfyUI install, sidecar install, or Git runtime install, include `docs/context/packs/runtime-installer.pack.md`.
- Keep routing minimum-sufficient; do not include unrelated packs or full-repo context by default.

## Selection Rules

- Start with `index.pack.md`, then add only packs materially relevant to the task.
- Do not include packs “just in case.”
- Select packs based on the task’s actual architectural and implementation concerns.
- Pack inclusion does not remove the requirement to read/update canonical docs when task scope requires it.

## Escalate to Canonical Docs When

- The task changes architecture, repository structure, standards, or documented behavior.
- The task changes boundaries, dependency direction, host/transport/runtime responsibilities, or persistence/storage responsibilities.
- The task creates or changes canonical rules; update canonical docs in the same work item.
- A pack summary appears incomplete or ambiguous for the requested change.

Packs are summaries and routing aids, not substitutes for canonical sources.

## Stop Condition

- If required canonical guidance is missing, unclear, or conflicting, do not invent policy silently; treat the task as requiring canonical clarification/update in the same work item.



## Hybrid execution and host-owned runtime routing

For tasks involving desktop-server hybrid execution, local/remote feature placement, host-owned runtime roots, server runtime root vs artifact storage root, or desktop delegation to configured server:

- Always include `index.pack.md`.
- Include `architecture.pack.md` for boundary decisions.
- Include `runtime.pack.md` for runtime root/process/adapter work.
- Include `desktop-host.pack.md` when desktop IPC/preload/host routing is involved.
- Include `server-host.pack.md` when server host/API/runtime is involved.
- Include `image-generation.pack.md` when ComfyUI/image generation is involved.
- Include `persistence-storage.pack.md` when artifact storage roots, generated outputs, or storage/runtime root separation is involved.

Escalation: if a task changes host-owned runtime behavior or per-feature execution placement, read ADR-0013 directly.


## Security routing and escalation

For security tasks, keep context minimum-sufficient:

- Always include `index.pack.md` + `security.pack.md`.
- Include `server-host.pack.md` when server route/middleware/mode behavior is in scope.
- Include `desktop-host.pack.md` and/or `desktop-implementation.pack.md` when desktop/thin-client flows are in scope.
- For thin-client pairing, secure fetch, token storage, or 401/403 UX tasks, include:
  - `security.pack.md`
  - `server-host.pack.md`
  - thin-client/desktop implementation pack(s) as applicable
  - affected feature pack(s) (for example `image-generation.pack.md`, artifact browser/storage-related packs, model-related packs when present)
- Include `persistence-storage.pack.md` for token-store/security-store or artifact-authorization boundary changes.
- Include `runtime.pack.md` only when runtime security/process concerns are directly in scope.

If a task changes route policy, security status semantics, token handling, or security API error behavior, read ADR-0015 directly.
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The initial `/api/assets` surface is GET-only for asset definition list/detail/version reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Desktop IPC/preload/renderer UI and thin-client UI/client exposure remain deferred.

## Phase 2C Prompt 3: read-only Asset Registry desktop IPC/preload foundation

Desktop IPC/preload Asset Registry work should include `asset-kernel`, `desktop-host`, `ipc-electron`, `security`, and `testing`. Scope is definition list/read/version-read wrappers around the application read facade/read port only. Renderer UI, thin-client UI/client code, mutations, seeding, import/finalize/register, resource scans, runtime execution, provider calls, and direct persistence access remain out of scope.

## Phase 2C cleanup: read-only Asset Registry transport parity

For API/IPC/preload cleanup prompts, include `asset-kernel`, `server-host`, `desktop-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Keep the operation scope explicit: definition list, definition read, and definition-version read only unless a later prompt has already added more. Shared transport-adapter input normalization is appropriate; renderer UI, thin-client UI, mutation, seeding, import/finalize/register, scan, runtime execution, provider calls, and persistence access remain out of scope.

## Phase 2C Prompt 4: shared Asset Library read client and UI read models

For shared Asset Library UI-client/read-model prompts, include `asset-kernel`, `desktop-host`, `server-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Scope is definitions-only UI-facing read models, safe mappers, shared query/detail option types, desktop renderer preload-backed read client, and thin-client GET-only API read client. Asset Library pages/routes/navigation, mutations, seeding, import/finalize/register, scans, runtime/provider execution, byte reads, application service imports, host composition imports, persistence imports, server route-handler imports, and IPC-handler imports remain out of scope.

## Phase 2C Prompt 5: desktop read-only Asset Library page

For desktop Asset Library page prompts, include `asset-kernel`, `desktop-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Scope is the desktop-only definitions list/detail page, top-level `Assets` navigation, supported read-only query filters, accessible loading/empty/error states, and collapsed advanced read-only detail sections backed by the desktop Asset Library client. Thin-client UI, API/IPC/preload contract changes, mutations, seeding, import/finalize/register, resource scans, runtime/provider execution, byte reads, application service imports, host composition imports, persistence imports, server route handlers, and IPC handler imports remain out of scope.
