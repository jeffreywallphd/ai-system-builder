# Host Model

## Asset Kernel relationship

Assets may declare host and permission requirements, but hosts remain responsible for composition and concrete runtime/readiness provider wiring. Asset metadata should stay declarative and transport/UI-neutral; desktop IPC, server API, and renderer models must not redefine asset semantics. Permission requirements can be validated structurally first, with enforcement added later through application and host policy seams.

## What a host means in this repository

A **host** is the runtime environment composition layer that starts and operates the system in a specific deployment mode.

In `ai-system-builder`, hosts are responsible for:

- lifecycle/startup/shutdown behavior,
- wiring application use cases to adapters,
- environment-specific composition choices.

Hosts are implemented under `modules/hosts/` and surfaced through `apps/*` entry points.

## Host types

## Desktop host (initial implementation priority)

- Built on Electron with Electron Forge (webpack plugin) as the canonical desktop dev/build/package path.
- Owns desktop lifecycle composition and desktop-specific wiring.
- Uses Electron IPC as a transport boundary (via transport adapters), not as business logic location.
- Desktop implementation is split intentionally across Electron `main`, preload, renderer, and host composition:
  - `main`: lifecycle/bootstrap/window creation only,
  - preload: narrow secure renderer bridge,
  - renderer: React UI composition only (no filesystem or IPC internals),
  - host composition (`modules/hosts/desktop`): adapter/use-case wiring.
- Desktop artifact publish/verification uses the same shared application use case path as server/thin-client (`PublishArtifactToRepoUseCase`, `VerifyPublishedArtifactBackingUseCase`) and is exposed through preload+IPC transport wiring rather than renderer-side orchestration.
- Desktop host composition may use focused helper modules for runtime readiness, storage, model management, image generation, and transport registration, but those helpers remain composition-only wiring seams and must not absorb business policy, runtime protocol logic, or IPC payload shaping. Phase 1 extracted runtime readiness helpers plus small runtime-task-registry wiring helpers; broader storage/model/image-generation decomposition remains future cleanup unless completed in a later change.

## Server host

- Owns server process lifecycle and composition.
- Uses transport adapters (default: Express) for API exposure.
- Keeps route/controller logic thin and delegates use-case behavior inward.
- Server host composition may use focused helper modules for runtime readiness, storage, model management, image generation, and API registration, but those helpers remain composition-only wiring seams and must not absorb business policy, runtime protocol logic, or Express payload shaping. Phase 1 extracted runtime readiness helpers plus small runtime-task-registry wiring helpers; broader storage/model/image-generation decomposition remains future cleanup unless completed in a later change.

## Why hosts are separate from transport adapters

Transport answers **"how requests/messages move"**.
Host answers **"what process/environment composes and runs the system"**.

Keeping these separate avoids common coupling failures:

- treating Express app setup as the architecture center,
- treating Electron IPC handlers as the business layer,
- mixing lifecycle concerns with request translation concerns.

## Host context contract boundary

When host-aware metadata must cross into inner layers, use the thin host context
contracts under `modules/contracts/host`.

- Keep host context limited to host identity/kind plus lightweight boundary
  metadata.
- Keep host identity ids normalized and serialization-friendly (trimmed non-empty
  string when present).
- Keep metadata JSON-serializable (plain objects, arrays, and primitive values).
- Keep metadata semantics host-neutral and intentionally small; do not introduce
  auth/session/request/response/window/framework semantics.
- Keep framework objects (`BrowserWindow`, Express request/response, etc.) out
  of host context contracts.
- Keep session/auth modeling out of host context unless explicitly introduced by
  a separate decision.

## Shared transport contract core and specialization

Transport adapters should share a transport-neutral contract core under `modules/contracts/transport`.

- The shared core defines generic transport request/response/error envelopes.
- API (HTTP) and IPC contracts specialize this core for transport-specific needs only.
- Specialization must not change application-facing operation identity and result/error semantics.
- API specialization must not introduce HTTP-only transport mechanics into shared contracts (status codes, headers, or framework request/response objects stay adapter-side).
- IPC specialization should add only channel identity context; it must not recreate transport success/failure envelopes.
- IPC channels must stay operation-derived as `ipc.<operation>.<kind>` where kind is `request`, `response`, or `event`.
- Transport-specific mechanics (HTTP status/headers or IPC channel registration details) remain in adapter-level contracts and implementations.

## Supported operating modes

The architecture is designed to support:

1. desktop-only,
2. server-only,
3. desktop-server hybrid (later).

### Staging rule

Desktop-first delivery is the first implementation target.

Server and hybrid compatibility should be preserved through boundaries and contracts, but early code should not absorb speculative hybrid complexity.

## Hybrid mode status

Hybrid synchronization/coordination architecture is **not yet fully designed**.

Contributors should:

- avoid claiming parity behavior that is not implemented,
- avoid embedding assumptions that force one future hybrid topology,
- keep host composition modular so hybrid can be added intentionally later.

## Thin web client role

`apps/thin-client/` is a thin host-specific web surface for server interaction.

- It is not assumed to be full feature parity with desktop.
- It composes pages/features/components in a renderer-oriented structure and calls server APIs over HTTP through feature-local clients.
- It should remain structurally distinct from the desktop preload-backed path and avoid duplicating host logic.
- The initial server-backed image vertical slice includes both upload and read-side artifact browse/view behavior:
  - thin-client UI calls server HTTP contracts for artifact upload plus image-backed artifact browse/detail/content-read,
  - the Express adapter stays thin and delegates to shared application use cases,
  - shared server host composition continues to own storage/persistence capability wiring for both write and read flows.
- Multipart parsing for that server-backed artifact-upload path stays in the Express transport adapter and should parse
  the live request stream with Busboy rather than buffering the full request body before parsing.

## Practical boundaries

## Execution authority and feature placement

Host is the execution authority. Desktop and server each own runtime execution whenever they execute a feature.

Desktop renderer should continue using preload/IPC regardless of local execution or future remote execution. Thin-client calls server APIs and never owns runtime execution.

Future execution placement should be per feature rather than all-or-nothing. Example future placement:
- image generation: remote
- artifact browsing: local
- training: remote
- model management: local or remote by execution target

## Host-owned runtime roots

Runtime roots are host-owned. Desktop and server runtime roots are independent by default. Avoid sharing ComfyUI/Python install roots across hosts unless an advanced explicit override is configured.

Runtime roots must not be treated as artifact storage roots.

See ADR-0013 for canonical cross-host runtime ownership and placement guidance.


- Apps own framework bootstrap surfaces (for example `express()` instantiation and app-level middleware).
- Host modules compose dependencies and register transport adapters against app-provided ports.
- Transport adapter registration should be feature-sliced (for example `artifact-upload/...`) with only tiny top-level aggregators.
- Host modules may depend on application/contracts/adapters.
- Transport adapters may be selected by hosts.
- Hosts may compose multiple specialized storage adapter families (artifact-object plus artifact-repo providers) when task scope requires it.
- Server/desktop host composition should keep those storage-family choices explicit in composition wiring (for example future Hugging Face artifact-repo provider composition) rather than hiding provider semantics behind ad hoc transport/UI shortcuts.
- Business rules remain in domain/application.
- UI remains separate from host lifecycle internals.

If host code starts accumulating business logic, move that logic inward before it becomes entrenched.


### Private Asset Kernel composition

`modules/hosts/shared/composition/composeLocalAssetKernel.ts` is the shared internal helper for local Asset Kernel composition. It initializes and validates the adapter-owned `<storageRootDirectory>/asset-kernel/` record store and returns repository ports plus existing application registry use cases for host-internal consumers. `modules/hosts/shared/composition/composeInternalAssetRegistry.ts` builds on that helper by composing the application `AssetRegistryReadFacade` as an internal host-owned service with optional injected resource-backed view provider support. Desktop `registerArtifactUploadIpc` and server `registerApi` now compose this internal registry from their storage roots and expose only host-internal getters. No startup seeding, IPC channels, API routes, preload methods, renderer UI, thin-client UI, resource-backed scans/views, or runtime behavior are added, and runtime roots remain separate from Asset Kernel persistence.

Phase 2C desktop composition passes only the internal registry read facade/read port into Electron IPC registration for definition list/read/version reads. It does not pass the full internal registry composition, repositories, mutation use cases, seed services, storage adapters, runtime adapters, or provider clients to asset IPC handlers. Renderer UI and thin-client UI remain deferred.

### Current host parity for repo-backed artifact workflows

- Server API and desktop IPC/preload both expose shared publish, published-verify, source-verify, register-from-repo, and localize-from-repo use cases.
- Thin-client and desktop renderer surfaces remain host-specific UI layers but call into the same shared application workflow path.


## Hugging Face token host configuration

- Server host now exposes a persisted Hugging Face token config seam for thin-client users (`GET/POST/DELETE /api/config/huggingface-token`).
- Desktop host exposes equivalent token config through preload/IPC so renderer flows can save/update/clear token without environment restarts.
- Artifact register/localize/publish/verify flows read token from host config at execution time; users no longer need to re-enter token per action.
- Public repositories may work without token; private/gated repositories can require one.

## Host security composition guidance

Hosts choose concrete security modes through composition. Server host owns server security configuration and API transport security setup. Desktop host will later own configured remote-server credential handling, and thin-client relies on server APIs through secure fetch behavior. Development no-auth mode must be explicit and noisy. Future remote desktop execution must route through secure API client adapters behind desktop IPC boundaries. See ADR-0015.
