# Context Pack: Desktop Host

- Pack name: `desktop-host`

## Purpose

- Provide focused guidance for desktop host composition and Electron boundary discipline.

## Use When

- Working in `apps/desktop`.
- Working in `modules/hosts/desktop`.
- Implementing/changing Electron `main`, preload, IPC, window lifecycle, or desktop bootstrap wiring.

## Do Not Use When

- Server-only transport/host tasks.
- Runtime or domain/application changes with no desktop-host impact.

## Core Guidance

- Desktop is a host model, not the entire architecture.
- Electron and Electron Forge are the desktop host/build tooling path.
- Preload and IPC are transport/boundary mechanics, not business logic layers.
- IPC contracts must remain transport specializations: reuse transport request/response/error semantics and add only channel identity context.
- Keep IPC channel naming constrained and operation-derived (`ipc.<operation>.<kind>`), so operation and channel do not drift independently.
- Restrict IPC channel kind to `request`, `response`, or `event`; do not introduce ad hoc kind variants.
- Keep business policy and use-case orchestration in application/domain, not `main`/preload/IPC glue. Desktop runtime readiness IPC should depend on the application `RuntimeReadinessPort` and wrap shared runtime readiness contracts without duplicating readiness shapes.
- Desktop host code should compose adapters and lifecycle behavior, then delegate inward. Compose runtime capability guards from the same `RuntimeReadinessPort` used for desktop readiness IPC and inject them into runtime-backed start use cases; IPC should map guard failures to sanitized `unavailable` responses without changing read/cancel/finalize behavior.
- Desktop host code should compose adapters and lifecycle behavior, then delegate inward. Runtime readiness providers in desktop composition must read non-starting supervisor/installer signals only; provider failures are returned as sanitized failed readiness statuses, and Python-specific IPC remains a separate detailed control/diagnostic surface.
- Focused desktop composition helper modules are allowed for concrete adapter/use-case wiring and transport registration; keep them role-specific and composition-only so they do not become dumping grounds for business rules, runtime protocol details, or IPC payload mapping. Phase 1 currently extracted runtime readiness composition and a small runtime-task-registry helper only; broader desktop storage/model/image-generation decomposition remains future cleanup unless done explicitly.
- When adding desktop host features, typecheck the full desktop composition dependency closure under `apps/desktop/tsconfig.webpack.json`; `ts-loader` with `noEmitOnError` can surface reachable TypeScript diagnostics as a vague `emitted no output` failure at `composeDesktopHost.ts`.
- When desktop composition wraps a typed adapter/application port to add logging or host lifecycle behavior, spread the full existing port first and override only the adapted method(s); hand-built partial port objects can drift when port contracts add methods and surface as vague `ts-loader` no-output failures.
- Pass inward host metadata through `modules/contracts/host` host-context shapes,
  not Electron-specific objects.
- Keep host-context metadata small and serialization-friendly (JSON-serializable values only).
- Do not encode auth/session/request/window/framework semantics in host-context metadata.
- Electron-specific assumptions must not leak into shared application/domain contracts.

## Key Constraints

## Host-owned runtime execution guidance

- Desktop renderer should keep using preload/IPC even when a feature later executes remotely.
- Desktop host composition may later route features to local adapters or remote server API client adapters.
- Do not put configured-server calls directly in desktop renderer components for runtime-heavy feature execution.
- Desktop local runtime roots are desktop-owned.
- Desktop and server runtime roots should not be shared by default.
- See ADR-0013.


- Do not turn IPC handlers into a miscellaneous service layer.
- Keep desktop transport translation thin and contract-driven.
- Keep IPC request/response/error envelopes transport-compatible and free of Electron object leakage.
- Preserve compatibility with multi-host architecture by avoiding desktop-only coupling in core layers.

## Canonical Source Docs

- `docs/architecture/host-model.md` — host responsibilities and desktop-first staging.
- `docs/adr/ADR-0003-host-model-and-transport-separation.md` — separation of host lifecycle and transport concerns.
- `docs/architecture/module-dependency-rules.md` — dependency boundaries for hosts and adapters.
- `docs/standards/coding-standards.md` — anti-patterns around host/transport logic leakage.
- `docs/standards/logging-standards.md` — startup and boundary diagnostics expectations.

## Common Over-Inclusions to Avoid

- Loading server host/API transport guidance for desktop-only tasks.
- Treating Electron API details as architectural rules for all modules.
- Pulling persistence/storage deep detail unless desktop work changes those boundaries.

## Prompt Assembly Notes

- Typical set: `index` + `desktop-host`.
- Add `desktop-implementation` for renderer/main/preload structure work.
- Add `architecture` for cross-layer changes.
- Add `logging` for startup/IPC diagnostics and `testing` for regression-sensitive changes.

- Desktop remote server credentials should live behind desktop host credential-store seams (not renderer-local ad hoc storage).
- Future remote feature execution must use secure API client adapters behind desktop IPC boundaries.

## Asset Kernel Notes

- Desktop `registerArtifactUploadIpc` composes the internal Asset Registry through `composeInternalAssetRegistry` using `storageRootDirectory`, which initializes `<storageRootDirectory>/asset-kernel/` and exposes only a host-internal getter for private composition/tests. It also passes the Phase 3 safe resource-backed provider aggregate built from already-composed artifact metadata, finalized image descriptor, and persisted model read seams. The internal registry may expose an explicit application-side `system.foundation` installer seam, but desktop startup must not invoke it. It must not use `runtimeRootDirectory` for Asset Kernel records or provider reads and must not add asset IPC channels, preload methods, renderer UI, automatic built-in or system-pack seeding, resource scans, provider/network calls, resource-byte reads, or runtime start/probe/install behavior for the Asset Kernel.
- Phase 2C desktop IPC/preload exposes only read-only Asset Registry definition list/read/version-read wrappers. Desktop composition passes only the internal read facade/read port to IPC registration, not the full internal registry, repositories, mutation use cases, seed services, storage adapters, runtime adapters, provider clients, or scan seams.
- Desktop preload may expose only matching read methods (`listAssetDefinitions`, `readAssetDefinition`, and `readAssetDefinitionVersion`). Asset mutation, seeding, import, finalize, register, scan, publish, and execute remain deferred; thin-client UI is a separate server-backed Phase 2C read-only surface.
- Desktop renderer may now include a read-only Asset Library client and `Assets` page that call only preload-backed definition and resource-backed view read methods and map responses through shared UI-facing read models. Normal definition selection must not request validation; validation details may be loaded only by an explicit read-only user action through `includeValidation: true`. Resource-backed views are displayed read-only as computed descriptor projections with safe diagnostics. The page must keep advanced details collapsed by default and must not import IPC handlers/contracts beyond the existing preload bridge shape, host composition, application services, local persistence adapters, runtime adapters, providers, or mutation/seeding/import/finalize/scan/execute operations.
- Phase 2C Prompt 7 desktop Asset Library detail panels reuse shared read-only UI helpers/components for AI context, configuration, ports, requirements, source/provenance, available-only validation, and safe metadata. These panels remain collapsed by default, validation is not requested on normal selection, and safe metadata must omit sensitive/path/blob/raw values rather than hide them.
- Phase 2C Prompt 8 finalizes the desktop Asset Library definition baseline as read-only; the final Phase 3 cleanup adds read-only resource-backed view list/detail IPC/preload/client/UI visibility. Renderer code uses the preload-backed client and shared UI helpers; validation is explicit through `includeValidation`; built-in seeding stays internal; and desktop Asset Library code must not scan resources, read bytes, start/probe/install/repair runtimes, call providers, or expose mutation/import/finalization/execution controls.
- Phase 3 Prompt 8 keeps desktop resource-backed provider wiring internal to host composition and the Asset Registry read facade. The public desktop surface may list/read resource-backed views only through that facade; do not add automatic seeding, registration/import/finalization/localization/publishing flows, scans, provider/network calls, runtime/task-registry calls, or byte/content reads for resource-backed views.
- Phase 4 Prompt 7 adds only four approved asset mutation IPC/preload wrappers: register resource-backed view, finalize generated output, import external repository object, and localize external repository object. Desktop transport registration must receive only narrow application use cases, map typed mutation results/failures through existing IPC envelopes, sanitize thrown errors, and avoid host composition objects, repositories, providers, storage/runtime adapters, token stores, startup mutation execution, arbitrary editor channels, seeding channels, provider browse/download channels, and runtime execution channels.
- Phase 4 Prompt 8 allows the desktop Asset Library renderer to expose only confirmation-driven actions for those four workflows through the preload-backed Asset Library client. Renderer code must not call IPC channels directly or import application use cases/services.
- Phase 5 Prompt 9 allows the desktop Asset Library to display sanitized pack/source/category metadata for definitions and to filter/group by pack, source layer, and category through shared read-only UI helpers. `system.foundation` definitions should appear as `System default` assets from `System Foundation`; `workspace-pack` should display as `Workspace pack` unless explicit override metadata exists. Desktop must still avoid pack install/import/export/activate/disable controls, override editing, resolver activation, asset editing, composition authoring, resource scans, byte reads, provider calls, and runtime behavior.
- Phase 5 Prompt 10 adds only a pure application-side asset resolver. Desktop must not expose resolver IPC/preload methods or raw resolver result payloads, override editing, pack activation/priority controls, install/import/export behavior, active-pack persistence, scans, provider/runtime/network/filesystem calls, composition authoring, or execution behavior for that resolver.
- Phase 5 Prompt 11 adds only pure in-memory application serialization/fingerprint helpers and fixtures. Desktop must not add pack import/export IPC channels, preload methods, renderer buttons, file pickers, archive/signature handling, marketplace/registry clients, user pack install/activation, override editing, host startup import/export behavior, filesystem scans, provider/network/runtime calls, or byte/content reads.
- Include `asset-kernel.pack.md` when desktop work exposes or composes assets, asset-backed pages/components, generated outputs as reusable assets, or resource-backed previews.
- Desktop IPC/preload and renderer models must wrap shared asset contracts; they must not define desktop-specific asset semantics.
- Desktop host composition wires concrete runtime/readiness/storage providers for asset requirements; assets remain declarative.

## Phase 6 Prompt 5 active workspace gating

Desktop renderer routes that show workspace-owned resources must declare workspace requirements and render a workspace-required create/select state when no active workspace is selected. The active workspace is renderer/host context only, must display the workspace display name rather than raw paths or ids as the primary label, and must be passed explicitly to later workspace-scoped clients. This gating must not expose pack installers/import/export UI or implement resource persistence scoping.

## Phase 6 Prompt 6 workspace activation host boundary

Workspace system pack activation availability is internal application-layer behavior only. Desktop host prompts should not expose new IPC/preload methods, renderer UI, startup installers, system-pack copying, Asset Library effective-view filtering, resource persistence scoping, collaboration, or public pack management for this checkpoint unless a later prompt explicitly asks for host wiring.

## Workspace Asset Library read wiring

Desktop host composition wires public Asset Registry reads through the workspace effective-view facade. The renderer Asset Library uses the active workspace label/id from the gated workspace shell and passes the workspace id through preload/IPC. Hosts must not auto-seed, auto-activate, copy system pack definitions, or call system pack installers for this read path.


## Phase 6 Prompt 8 artifact workspace scoping

Artifacts and uploads are workspace-scoped. Artifact browse/upload/read operations require explicit workspace context and must not fall back to global artifact records. Uploaded bytes use a workspace-scoped storage keyspace; legacy global artifacts are not auto-migrated. Artifact-backed resource views require workspace context. Image assets, generated outputs, datasets, models, runtime task outputs, user-library behavior, and cross-workspace reuse remain deferred.

## Phase 6 Prompt 10 desktop workspace UX integration

Desktop renderer surfaces include a visible workspace selector/switcher and create-workspace flow. Workspace-required pages show a gated create/select state without an active workspace, then display the active workspace name and pass the active workspace id through desktop preload/IPC-backed clients after selection. Workspace switching keeps the route, refetches workspace-scoped data, and clears stale selected details where applicable.

The desktop UI must not show raw storage roots/paths or use raw workspace ids as primary labels. It must not generate authoritative workspace ids in the renderer, create hidden/default workspaces, auto-seed startup workspaces, expose pack installer/activation management UI, or add user-library/cross-workspace/collaboration behavior. The create-workspace System Foundation checkbox requests the existing `system.foundation@1.0.0` activation by reference only.

## Phase 6 final stabilization / Phase 7 handoff

Phase 6 final state: workspace is the normal boundary for user/project resources. No active workspace means workspace-scoped pages are gated and must not render underlying feature components or call workspace-scoped clients. Active workspace display uses the workspace display name. System Foundation remains system-owned and is made available only through a `system.foundation@1.0.0` workspace activation reference; workspace creation must not call the Phase 5 installer, copy pack definitions, create a hidden/default workspace, or perform startup seeding. Workspace-owned artifacts/uploads, image assets, generated outputs/finalization, dataset outputs, model records, and runtime task outputs require explicit workspace context where implemented, must not leak across Workspace A/B, and must not fall back to legacy global records. Global runtime readiness and system/provider diagnostics may remain global but must not masquerade as workspace-owned records. Collaboration fields are passive placeholders only.

Phase 7 is User Library and Cross-Workspace Asset Reuse. It should define explicit promote/link/copy/import flows and provenance/resolver behavior without accidental propagation. Do not implement user-library, cross-workspace reuse, collaboration permissions, invites/sync/remote auth, asset authoring, override editing, pack import/export/install, marketplace, visual composition, workflow execution expansion, provider/network expansion, or automatic legacy migration as part of Phase 6 stabilization.
