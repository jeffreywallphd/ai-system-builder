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
| assets, asset packs/catalogs/manifests, asset definitions/instances/bindings/compositions, systems/subsystems/features as composable assets, UI components/pages as assets, workflows/tools as assets, resource-backed assets, generated outputs as assets, Hugging Face objects as asset/resource backings, AI-readable asset context, asset validation, asset configuration, asset ports/composition rules, Asset Registry read-facade transport wrappers, or Asset Library UI | `docs/context/packs/asset-kernel.pack.md` |
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


## Phase 6 Prompt 3: workspace repository ports and local persistence

For workspace persistence prompts, include `index`, `asset-kernel`, `persistence-storage`, `security`, `testing`, `desktop-host`, `server-host`, and `ipc-electron`, plus canonical Asset Kernel, system overview, module dependency, persistence/storage, host docs, and ADR-0016/ADR-0005. Scope is application ports under `modules/application/ports/workspace` and local file-backed persistence under `modules/adapters/persistence/workspace` for workspace records/indexes, active workspace selection preference, and workspace system-pack activation records. Active selection is a persisted preference/read model only, not global application-service state or authorization. System-pack activation persistence stores references by pack id/version only and must not call installers or copy/embed system pack manifests/assets/definitions. Do not add workspace creation use cases, API routes, IPC handlers, preload methods, UI, host wiring, page gating, Asset Library filtering, artifact/data/model/image scoping, resource storage directories, collaboration permissions, invites, sharing, sync, remote auth, user-library behavior, cross-workspace reuse, marketplace/package registry behavior, workflow execution, runtime/provider/network behavior, or public path leakage.

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

The `/api/assets` surface is GET-only for asset definition list/detail/version reads and resource-backed view list/detail reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, or execute workflows. Desktop IPC/preload and desktop/thin-client Asset Library clients/pages should stay in parity with this read-only facade-backed surface.

## Phase 2C Prompt 3: read-only Asset Registry desktop IPC/preload foundation

Desktop IPC/preload Asset Registry work should include `asset-kernel`, `desktop-host`, `ipc-electron`, `security`, and `testing`. Scope is definition list/read/version-read wrappers around the application read facade/read port only. Renderer UI, thin-client UI/client code, mutations, seeding, import/finalize/register, resource scans, runtime execution, provider calls, and direct persistence access remain out of scope.

## Phase 2C cleanup: read-only Asset Registry transport parity

For API/IPC/preload cleanup prompts, include `asset-kernel`, `server-host`, `desktop-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Keep the operation scope explicit: definition list, definition read, definition-version read, resource-backed view list, and resource-backed view read only unless a later prompt has already added more. Shared transport-adapter input normalization is appropriate; mutation, seeding, import/finalize/register, scan, runtime execution, provider calls, and persistence access remain out of scope.

## Phase 2C Prompt 4: shared Asset Library read client and UI read models

For shared Asset Library UI-client/read-model prompts, include `asset-kernel`, `desktop-host`, `server-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Scope is read-only definition and resource-backed view UI-facing read models, safe mappers, shared query/detail option types, desktop renderer preload-backed read client, and thin-client GET-only API read client. Mutations, seeding, import/finalize/register, scans, runtime/provider execution, byte reads, application service imports, host composition imports, persistence imports, server route-handler imports, and IPC-handler imports remain out of scope.

## Phase 2C Prompt 5: desktop read-only Asset Library page

For desktop Asset Library page prompts, include `asset-kernel`, `desktop-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Scope is the desktop-only definitions list/detail page, top-level `Assets` navigation, supported read-only query filters, accessible loading/empty/error states, and collapsed advanced read-only detail sections backed by the desktop Asset Library client. Thin-client UI, API/IPC/preload contract changes, mutations, seeding, import/finalize/register, resource scans, runtime/provider execution, byte reads, application service imports, host composition imports, persistence imports, server route handlers, and IPC handler imports remain out of scope.

## Phase 2C Prompt 6: thin-client read-only Asset Library page

For thin-client Asset Library page prompts, include `asset-kernel`, `server-host`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Scope is the thin-client read-only definition and resource-backed view list/detail page, `/assets` route/navigation, supported read-only query filters, accessible loading/empty/error states, and collapsed advanced read-only detail sections backed by the thin-client server API Asset Library client. Desktop UI, mutation contract changes, seeding, import/finalize/register, resource scans, runtime/provider execution, byte reads, application service imports, host composition imports, persistence imports, server route handlers, desktop preload/IPC imports, and speculative instances/compositions remain out of scope.

## Phase 2C Prompt 7: Asset Library advanced read-only detail panels

For Asset Library advanced detail panel prompts, include `asset-kernel`, `desktop-host`, `server-host`, `ipc-electron`, `security`, and `testing`, plus canonical Asset Kernel/host/dependency docs. Scope is shared read-only UI helpers/components for AI context, configuration summaries, ports, requirements, source/provenance, validation summaries only when already present or explicitly requested, and safe metadata. Desktop and thin-client page/client wiring remains host-specific. Normal selection must not request validation, technical panels stay collapsed by default, and shared UI helpers/components must not import application services, host composition, persistence adapters, transport handlers, runtime/storage adapters, desktop preload internals, or thin-client API clients.

## Phase 2C Prompt 8: final Asset Library read-only stabilization

For final Phase 2C stabilization prompts, include `asset-kernel`, `desktop-host`, `server-host`, `ipc-electron`, `security`, `testing`, and `persistence-storage`, plus canonical Asset Kernel/host/dependency/persistence docs. Scope is regression hardening only: read-only API/IPC/preload audits, UI boundary audits, explicit validation behavior, safe metadata/rendering, resource-backed computed-view safety, non-exposure tests, and docs/context alignment. Do not add mutation/execution/import/finalization/seeding, automatic validation, resource scans, runtime/provider calls, byte reads, or new product features.

## Phase 3 resource-backed provider stabilization

For resource-backed provider work, include `asset-kernel`, `persistence-storage`, `security`, `runtime`, `runtime-task-registry`, `desktop-host`, `server-host`, and `testing` as relevant, plus canonical Asset Kernel, host, persistence/storage, runtime, and module-dependency docs. Provider implementations belong in application ports/services; host wiring belongs in host composition; UI must stay behind transport/preload/client layers.

For API/IPC/UI Asset Library work that touches resource-backed Asset Registry reads, also include `ipc-electron`, `desktop-host`, `server-host`, and `security`. Keep public surfaces read-only and do not add registration, import, finalization, localization, publishing, seeding, scans, provider calls, runtime calls, workflow execution, or byte/content reads unless a later phase explicitly scopes controlled mutation behavior.

## Phase 4 Prompt 7: controlled asset mutation transport wrappers

For approved Phase 4 mutation transport wrapper work, include `asset-kernel`, `server-host`, `desktop-host`, `ipc-electron`, `security`, `testing`, `persistence-storage`, `runtime`, and `runtime-task-registry`, plus canonical Asset Kernel/host/module-dependency/persistence/runtime docs and ADR-0016/ADR-0005. Scope is limited to thin API, IPC, preload, and renderer bridge typing for `asset.register-resource-backed-view`, `asset.finalize-generated-output`, `asset.import-external-repository-object`, and `asset.localize-external-repository-object`. Do not add Asset Library UI actions, arbitrary asset create/update/delete/patch/editor operations, built-in seeding routes, provider browse/download routes, runtime execution routes, scans, byte/content reads, or direct repository/provider/storage/runtime imports in transport wrappers.

## Phase 4 Prompt 8: controlled Asset Library mutation UI actions

For controlled Asset Library UI actions, include `asset-kernel`, `desktop-host`, `server-host`, `ipc-electron`, `security`, `testing`, `persistence-storage`, `runtime`, and `runtime-task-registry`, plus canonical Asset Kernel/host/module-dependency/persistence/runtime docs and ADR-0016/ADR-0005. Scope is limited to confirmation-driven UI actions for `asset.register-resource-backed-view`, `asset.finalize-generated-output`, `asset.import-external-repository-object`, and `asset.localize-external-repository-object` through existing API/preload clients. Do not add arbitrary asset create/update/delete/patch/editor operations, built-in seeding, bulk mutation, provider browsing/download outside explicit import/localize, runtime execution, workflow/canvas authoring, dataset preparation, model training/validation/publishing, image generation, scans, byte/content reads, or direct application/host/persistence/provider/runtime imports in UI code.

## Phase 4 stabilization and Phase 5 handoff

For Phase 4 regression, documentation stabilization, or Phase 5 handoff prompts, include `asset-kernel`, `security`, `persistence-storage`, `testing`, `desktop-host`, `server-host`, `ipc-electron`, `runtime`, and `runtime-task-registry` as appropriate, plus canonical Asset Kernel/host/module-dependency/persistence/runtime docs and ADR-0016/ADR-0005. Verify that Phase 4 work remains limited to the four approved mutation workflows, that UI actions use UI/client/preload/API layers rather than application services directly, and that transports stay thin over application use cases.

Foundational built-in asset population belongs to Phase 5. General asset editing, composition authoring, workflow/canvas execution or authoring, plugin marketplaces, schedulers/queues, and automatic AI-generated asset libraries are not Phase 4 scope.

## Phase 5 Prompt 4: system foundation UI structural primitives

For system foundation UI structural primitive prompts, include `index`, `asset-kernel`, `security`, and `testing`, plus canonical Asset Kernel, module dependency, host, persistence/storage, and ADR-0016/ADR-0005 docs. Scope is application-side `system.foundation` pack entries only: semantic `AssetDefinition` records with configuration schemas, AI context, ports, and composition guidance. Do not add renderer components, CSS, visual editor/canvas behavior, form/field primitives, data display primitives, seeding/install/import/export, resolver execution, persistence, API/IPC/preload/UI, host wiring, runtime/provider/network/storage behavior, or workflow execution.

## Phase 5 Prompt 5: system foundation form and field primitives

For system foundation form and field primitive prompts, include `index`, `asset-kernel`, `security`, and `testing`, plus canonical Asset Kernel, module dependency, host, persistence/storage, and ADR-0016/ADR-0005 docs. Scope is application-side `system.foundation` pack entries only: semantic form/field `AssetDefinition` records under `forms-fields` with configuration schemas, AI context, ports, and composition guidance, including compatibility with existing UI structural primitives. Do not add renderer components, form renderers, validation engines, submission execution, file transfer/storage behavior, data display primitives, page/feature/workflow/system shells, seeding/install/import/export, resolver execution, persistence, API/IPC/preload/UI, host wiring, runtime/provider/network/storage behavior, visual composition editors, or workflow execution.

## Phase 5 Prompt 6: system foundation data display, state, and message primitives

For system foundation data display/state/message primitive prompts, include `index`, `asset-kernel`, `security`, and `testing`, plus canonical Asset Kernel, module dependency, host, persistence/storage, and ADR-0016/ADR-0005 docs. Scope is application-side `system.foundation` pack entries only: semantic display/state/message `AssetDefinition` records under `data-display` and `state-messages` with configuration schemas, AI context, ports, and composition guidance, including compatibility with existing UI structural and form primitives. Do not add renderer components, data-grid implementations, preview renderers, resource readers, storage readers, API clients, data fetching, page/feature/workflow/system shells, seeding/install/import/export, resolver execution, persistence, API/IPC/preload/UI, host wiring, runtime/provider/network/storage behavior, visual composition editors, or workflow execution.

## Phase 5 Prompt 7: system foundation page, feature, workflow, and system shells

For system foundation shell primitive prompts, include `index`, `asset-kernel`, `security`, and `testing`, plus canonical Asset Kernel, module dependency, host, runtime, persistence/storage, runtime-task-registry, and ADR-0016/ADR-0005 docs. Scope is application-side `system.foundation` pack entries only: semantic page/feature/workflow/system shell `AssetDefinition` records under `page-feature-shells` and `workflow-system-shells` with configuration schemas, AI context, ports, and composition guidance, including compatibility with UI structural, form, display, and state/message primitives. Do not add renderer pages, routes, workflow engines, runtime tasks, executable systems, scheduler/queue behavior, provider behavior, visual composition/canvas/wizard authoring, AI-generated system composition, seeding/install/import/export, resolver execution, persistence, API/IPC/preload/UI, host wiring, runtime/provider/network/storage behavior, or public pack exposure. Review B should focus on composition boundaries, override semantics, and no-execution/no-editor drift.

## Phase 5 Prompt 8: internal system foundation pack install/seeding

For internal system pack install/seeding prompts, include `index`, `asset-kernel`, `persistence-storage`, `security`, `testing`, `desktop-host`, and `server-host`, plus canonical Asset Kernel, module dependency, persistence/storage, host docs, and ADR-0016/ADR-0005. Scope is explicit application-side install behavior only: validate manifest/entries/definitions/quality gates before save, persist through Asset Kernel repository/use-case seams, mark safe pack/source metadata, preserve idempotency, and skip user/custom conflicts without overwrite. Do not add public API/IPC/preload/UI install/import/export behavior, host startup auto-seeding, marketplace/package registries, durable active-pack registries, resolver implementation, override application, filesystem/storage scans, runtime/provider/network behavior, or resource-byte reads.

## Phase 5 Prompt 9: Asset Library pack/source/category discoverability

For read-only Asset Library pack discoverability prompts, include `index`, `asset-kernel`, `desktop-host`, `server-host`, `ipc-electron`, `security`, `testing`, and `persistence-storage`, plus canonical Asset Kernel, host, module dependency, persistence/storage docs, and ADR-0016/ADR-0005. Scope is sanitized UI/read-facade/read-model metadata only: pack/source/category fields, `system.foundation` shown as system defaults, source/category/pack filtering or grouping, collapsed read-only detail metadata, and informational override/resolution visibility only when fields already exist. Do not add public pack install/import/export/activate/disable behavior, override editing, resolver implementation, active-pack registry behavior, marketplace/package behavior, host startup seeding, asset editing, visual composition/canvas/wizard authoring, storage scans, provider/network/runtime behavior, or byte/content reads.

## Phase 5 Prompt 10: pure asset resolver

For basic asset resolver prompts, include `index`, `asset-kernel`, `security`, `testing`, and `persistence-storage`, plus canonical Asset Kernel, module dependency, persistence/storage, host docs, and ADR-0016/ADR-0005. Scope is a pure application resolver under `modules/application/services/asset-packs` that accepts explicit candidate definitions, manifests, source-layer ordering, and override rules. Exact references resolve without overrides by default; semantic/default references may apply explicit enabled override rules when requested; overrides are non-destructive and selected only in resolution results. Do not add repository-backed resolution, active-pack persistence, public override editing, pack activation/priority UI, pack import/export/sharing, marketplace/package behavior, API/IPC/preload/UI exposure, host wiring, storage scans, provider/network/runtime/filesystem calls, composition authoring, or execution behavior.

## Phase 5 Prompt 11: pack manifest serialization and readiness

For pack serialization/readiness prompts, include `index`, `asset-kernel`, `security`, `testing`, `persistence-storage`, `desktop-host`, and `server-host`, plus canonical Asset Kernel, module dependency, persistence/storage, host docs, and ADR-0016/ADR-0005. Scope is pure application-side in-memory manifest serialization, parse safety, deterministic fingerprints/checksums, safe system.foundation and user/imported override fixtures, and tests that simulate future import/export readiness. Do not add public import/export routes, IPC/preload methods, UI buttons, file pickers, archive/signature formats, remote publishing, marketplace/package registry behavior, pack install/activation, active-pack persistence, override editing, filesystem reads/writes, storage scans, provider/network/runtime calls, byte/content reads, or host wiring.

## Phase 5 final stabilization and Phase 6 handoff

For Phase 5 regression, documentation stabilization, or Phase 6 handoff prompts, include `index`, `asset-kernel`, `security`, `testing`, `persistence-storage`, `desktop-host`, `server-host`, `ipc-electron`, `runtime`, and `runtime-task-registry`, plus canonical Asset Kernel, host, module-dependency, persistence/storage, runtime docs and ADR-0016/ADR-0005.

Scope is stabilization only: verify `system.foundation` as the canonical versioned, system-trusted system default pack; keep system defaults as pack entries and read-facade built-ins; keep primitives semantic and non-executing; keep install/seeding explicit/internal/idempotent/non-destructive with user/custom conflicts failing rather than silently succeeding; keep host startup free of automatic pack install; keep resolver behavior pure, caller-fed, and internal-only; keep exact refs bypassing overrides by default; keep semantic/default refs override-aware only when explicit enabled rules are allowed; keep serialization/fingerprinting pure and in-memory while remembering fingerprinting is not validation; keep Asset Library pack/source/category display read-only with workspace packs distinct from overrides; and update docs with Phase 6 authoring/override/composition-planning handoff.

Do not add Phase 6 behavior during stabilization. Public pack import/export/install/activate/disable, public override editing, marketplace/package registry, active-pack registry, general asset editor, visual composition/canvas/wizard authoring, workflow execution, runtime execution, AI-generated system composition, provider/network/storage side effects, and filesystem import/export remain deferred.

## Phase 6 Prompt 2: workspace contracts and scope vocabulary

For workspace contract prompts, include `index`, `asset-kernel`, `persistence-storage`, `security`, `testing`, `desktop-host`, `server-host`, and `ipc-electron`, plus canonical Asset Kernel, system overview, module dependency, persistence/storage, host docs, and ADR-0016/ADR-0005. Scope is contract-only shared vocabulary under `modules/contracts/workspace`: workspace ids/statuses, passive roles/actor/member placeholders, path-free storage descriptors, system-pack activation references, records, create commands, active selection, and explicit workspace request context. Workspace activation references `system.foundation@1.0.0` by id/version and must not copy manifests, assets, or definitions. Do not add persistence, repository ports, use cases, adapters, migrations, API/IPC/preload/UI, host wiring, workspace creation behavior, active workspace global state, page gating, Asset Library filtering, resource scoping, system-pack install/copy behavior, permission engines, invites, sharing, sync, remote auth, or multi-user runtime behavior.

## Phase 6 Prompt 4: workspace creation use case and foundation activation policy

For workspace creation application prompts, include `index`, `asset-kernel`, `persistence-storage`, `security`, `testing`, `desktop-host`, `server-host`, and `ipc-electron`, plus canonical Asset Kernel, system overview, module dependency, persistence/storage, host docs, and ADR-0016/ADR-0005. Scope is application use-case behavior under `modules/application/use-cases/workspace`: validate and normalize display names, generate safe workspace ids, create and persist `WorkspaceRecord` values through workspace ports, optionally persist active workspace selection only when explicitly requested, and optionally activate `system.foundation@1.0.0` by reference. The activation policy must not call the Phase 5 system pack installer, install/copy/embed pack manifests or definitions, mutate system packs, write Asset Kernel definition repositories, add host/API/IPC/preload/UI wiring, gate pages, change Asset Library effective views, scope artifacts/images/models/data, create resource directories, or add collaboration permissions, invites, sync, remote auth, user-library, marketplace, runtime, provider, or workflow behavior.

## Phase 6 Prompt 5: active workspace context and workspace-gated pages

For active workspace and page-gating prompts, include `index`, `asset-kernel`, `persistence-storage`, `security`, `testing`, `desktop-host`, `server-host`, and `ipc-electron`, plus canonical system overview, host model, persistence/storage, Asset Kernel, module dependency, and ADR-0016/ADR-0005 docs. Scope is renderer/thin-client active workspace context, workspace-required route metadata, workspace-required page gates, display-name-only active workspace labels, create/select workspace CTAs, and explicit workspace context plumbing for later clients. Do not implement Asset Library effective-view filtering, artifact/data/model/image persistence scoping, workspace pack availability logic, public pack import/export/install UI, system pack installer exposure, collaboration/permissions/invites/sharing/sync/remote auth, marketplace/package registry, workflow execution, or runtime/provider/network behavior.
