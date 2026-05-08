# Context Pack: Server Host

- Pack name: `server-host`

## Purpose

- Guide server host composition and HTTP transport adaptation without boundary drift.

## Use When

- Working in `apps/server`.
- Working in `modules/hosts/server`.
- Working in `modules/adapters/transport/api-express` or equivalent Express API transport surfaces.

## Do Not Use When

- Desktop-only host/IPC tasks.
- Runtime/domain/application changes with no server-host or HTTP transport impact.

## Core Guidance

- Server is a host model responsible for process lifecycle and composition.
- Express is the default API transport adapter, not the application architecture center.
- Keep internal application contracts distinct from HTTP-specific request/response details.
- Keep API contracts as transport specializations over shared transport envelopes; do not create API-only success/failure families.
- Keep operation identity transport-neutral (`workspace.create` style), with HTTP route details staying adapter-side.
- Route/controller code must stay thin and delegate use-case behavior inward.
- Server host composition is separate from transport adaptation.
- Server host composition may include multiple specialized storage adapter families (artifact-object plus artifact-repo storage) and should keep that composition explicit.
- Current composition includes artifact-object filesystem storage and the first artifact-repo provider adapter registration (Hugging Face).
- Pass host metadata inward via `modules/contracts/host` host-context contracts,
  not HTTP framework objects.
- Keep host-context metadata small and serialization-friendly (JSON-serializable values only).
- Do not encode auth/session/request/window/framework semantics in host-context metadata.
- `apps/thin-client` is a thin surface over server capabilities, not assumed full parity from day one.
- The thin-client image vertical slice is server-backed end to end for both write and read paths (feature-local HTTP client for upload plus artifact browse/read/content-read -> Express route mapping -> shared use case -> shared storage/persistence capabilities).

## Key Constraints

## Host-owned runtime and storage roots

- Server may own runtime sidecars such as ComfyUI/Python when server is execution authority.
- `SERVER_RUNTIME_ROOT` is the intended server runtime root override.
- `SERVER_STORAGE_ROOT` is for artifact storage, not runtime installs.
- Server model-management and image-generation should share server-owned model registry/cache only when server executes the feature.
- Server host runtime state should not be shared with desktop by default.
- See ADR-0013.


- Do not accumulate business logic in routes/controllers/middleware.
- Do not encode HTTP semantics into domain/application models.
- Keep host wiring, transport translation, and application orchestration as separate responsibilities.
- Do not hide provider-backed storage semantics behind ad hoc route/UI shortcuts; compose provider-backed adapters explicitly in host wiring.

## Canonical Source Docs

- `docs/architecture/host-model.md` — server host role and thin web client positioning.
- `docs/adr/ADR-0003-host-model-and-transport-separation.md` — host/transport separation decision.
- `docs/architecture/module-dependency-rules.md` — dependency and boundary rules.
- `docs/architecture/system-overview.md` — app/host/transport placement model.
- `docs/standards/coding-standards.md` — boundary-safe coding and anti-patterns.

## Common Over-Inclusions to Avoid

- Desktop/Electron details for server-only work.
- Pulling runtime adapter specifics unless server task directly invokes runtime integrations.
- Treating thin web client concerns as full-stack parity requirements.

## Prompt Assembly Notes

- Typical set: `index` + `server-host`.
- Add `architecture` for boundary-sensitive refactors.
- Add `logging` for startup/request diagnostics and `testing` for route/host integration behavior.



- Server `registerApi` composes the internal Asset Registry through `composeInternalAssetRegistry` using `storageRootDirectory`, which initializes `<storageRootDirectory>/asset-kernel/` and exposes only a host-internal getter for private composition/tests. It must not use `runtimeRootDirectory` for Asset Kernel records and must not add asset API routes, thin-client clients, automatic built-in seeding, resource scans, provider/network calls, resource-byte reads, or runtime start/probe/install behavior for the Asset Kernel.

## Current implementation checkpoint (server host)

- `composeServerHost` now wires artifact-repo use cases and route registration for `POST /api/artifact-repo/has`, `POST /api/artifact-repo/store`, `POST /api/artifact/publish`, and `POST /api/artifact/publish/verify`.
- `composeServerHost` now wires artifact-repo use cases and route registration for `POST /api/artifact-repo/has`, `POST /api/artifact-repo/store`, `POST /api/artifact/publish`, `POST /api/artifact/publish/verify`, and `POST /api/artifact/source/verify`.
- These routes delegate through application use cases; they do not bypass to storage adapters directly.
- Thin-client artifact-browser publish flow should target `POST /api/artifact/publish` as the primary user workflow route.
- Thin-client artifact-browser re-check flow should target `POST /api/artifact/publish/verify` to update durable verification state/time without republishing bytes.
- Thin-client artifact-browser source re-check flow should target `POST /api/artifact/source/verify` for imported-source backing verification refresh.
- Desktop host uses the same shared `PublishArtifactToRepoUseCase` path via IPC/preload transport (separate host/transport wiring, shared application orchestration).


- Server route surface now includes `POST /api/artifact/register-from-repo` delegating to shared application use-case orchestration.
- Server route surface now also includes `POST /api/artifact/localize-from-repo` for explicit localization/download of imported artifacts through shared application orchestration.


- Server host route surface now includes Hugging Face token config endpoints (`GET/POST/DELETE /api/config/huggingface-token`) so thin-client users can recover from auth-required artifact errors without leaving the product.

- Server host composes security mode and Express security middleware wiring.
- Server host owns security store path resolution.
- `lan-https-token` requires TLS cert/key paths and `SERVER_TOKEN_HASH_SECRET`.
- Security status supports public discovery and authenticated-principal semantics when a bearer token is sent.
- Unknown `/api/*` routes should be denied by centralized route policy (`security.route-policy-missing`).
- Server app bootstraps HTTP/HTTPS listener; host/transport layers own route/middleware behavior.
- Do not place business logic or token verification directly in feature routes.

## Runtime readiness API

- Server host composition owns the server `RuntimeReadinessService` and passes an explicit capability scope for Python runtime, ComfyUI runtime, image generation, dataset preparation, model training, model validation, and model publishing; model publishing is intentionally unavailable/not implemented until runtime task support is added.
- Focused server composition helper modules are allowed for concrete adapter/use-case wiring and API registration; keep them role-specific and composition-only so they do not become dumping grounds for business rules, runtime protocol details, or Express payload mapping. Phase 1 currently extracted runtime readiness composition and a small image-generation runtime-task-registry helper only; broader server storage/model/image-generation decomposition remains future cleanup unless done explicitly.
- Server readiness providers should read bounded supervisor/installer status only and must not start/stop/install/repair runtimes; provider failures are returned as sanitized failed readiness statuses. Runtime-backed API starts should reuse the composed `RuntimeReadinessPort` through the application guard and map not-ready capabilities to HTTP 503/unavailable envelopes with safe details.  Thin-client UI consumption is deferred to later prompts.

## Asset Kernel Notes

- Include `asset-kernel.pack.md` when server work exposes or composes assets, resource-backed assets, generated outputs, Hugging Face-backed material, or asset validation/registry flows.
- Server API routes must wrap shared asset contracts; they must not define server-specific asset semantics.
- Server host composition wires concrete runtime/readiness/storage/security providers for asset requirements; assets remain declarative.
## Phase 2C Prompt 2: read-only Asset Registry server API foundation

Phase 2C begins by exposing only a narrow, read-only server API foundation for Asset Registry definition reads. The server routes wrap an application-owned Asset Registry definition read port/read facade and must not receive persistence adapters, host composition helpers, mutation use cases, built-in seeding services, or local repositories.

The current `/api/assets` surface is GET-only for asset definition list/detail/version reads. It must not scan resources, read bytes, call runtimes, call providers, seed built-ins, import/finalize/register assets, mutate assets, or execute workflows. Server host composition may keep the full internal registry private, but `registerExpressApi` and the asset route registration receive only the narrow read facade/read port. Renderer UI and thin-client UI/client exposure remain deferred.

## Phase 2C Prompt 4: thin-client Asset Library read client

The thin-client may now include a read-only Asset Library API client that calls only GET `/api/assets/definitions`, `/api/assets/definitions/:definitionId`, and `/api/assets/definitions/:definitionId/versions/:version`. The client maps server envelopes into shared UI-facing Asset Library read models/results and must not import server route handlers, application services, host composition, persistence adapters, runtime adapters, or mutation/seeding/import/finalize/scan/execute operations.

## Phase 2C Prompt 6: thin-client Asset Library page

Thin-client now registers an `Assets` page at `/assets`. The page is definitions-only and uses the read-only server API Asset Library client wrappers for list/detail reads; normal selection must not request validation, and validation details may be loaded only by an explicit read-only user action through `includeValidation: true`. It must not call application services, host composition, persistence adapters, route handlers, desktop IPC/preload modules, runtime/provider clients, seeding, mutation, import/finalize/register, scans, or execution behavior. Advanced detail sections are read-only and collapsed by default.
