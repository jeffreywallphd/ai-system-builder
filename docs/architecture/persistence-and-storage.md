# Persistence and Storage

## Asset Kernel relationship

The Asset Kernel is the semantic composition model for reusable building blocks. Persistence and storage remain separate lower-level architecture concerns. Asset metadata may be persisted as structured records for asset definitions, instances, bindings, compositions, lifecycle, and provenance; binary/content payloads remain storage concerns. Phase 2A Prompt 9 adds a minimal local JSON Asset Kernel record adapter with schema-version manifest metadata, and Prompt 10 adds resource-backed mapping contracts/helpers only; neither prompt adds a migration framework, durable resource-backed mapping repository, or version-history service.

Resource-backed assets should reference artifact/resource storage identities instead of embedding raw file paths or bytes in asset metadata. Generated outputs produced by runtime tasks become reusable only after finalization/registration as artifacts or resource-backed assets. Hugging Face repository objects remain external repository objects until registered/imported as resource-backed assets. Existing artifact, model, dataset, and image concepts should not be renamed during Phase 2A.

## Core distinction

`ai-system-builder` treats **persistence** and **storage** as separate architecture concerns.

- **Persistence**: structured, durable application records and relational/queryable state.
- **Storage**: a thin shared foundation plus specialized storage families for artifact content and provider/repository-backed material.

This distinction is required even when both end up on the same machine or disk.

## Storage adapters as a broad architectural category

Storage in this repository is a broad adapter category, not one flat contract shape.

- `modules/adapters/storage/` is the umbrella area for storage adapter families.
- Storage may contain multiple specialized contract families and implementation families.
- Shared storage principles still apply (explicit boundaries, adapter-owned infrastructure details, transport/path neutrality at public contracts).
- Specialization is expected when semantics differ materially.

### Specialized storage families (direction)

At minimum, storage distinguishes two contract families over a shared foundation (`StorageKind`, `StorageProviderId`, and `StorageBackingReference`):

- **artifact-object storage adapters**
  - centered on artifact keys, bytes, checksums, and artifact metadata (`ArtifactObjectStorageLocator` and store/retrieve/has/delete key-object operations),
  - represented today by key-based artifact storage contracts and filesystem-backed implementations.
- **artifact-repo storage adapters**
  - centered on provider/repo identity, revision/version semantics, remote visibility/access semantics, and provider-native publish/import behavior,
  - valid storage adapters even though they are not simple key/blob stores.

Repo-backed storage is still storage.
It must not be collapsed into persistence-record concerns and should not be flattened into the same contract shape as artifact/object key-byte operations.

## Default persistence adapter target

Postgres is the default persistence adapter target for structured records.

This establishes a default operational direction for schema/migrations and relational data handling, without forcing every module to know Postgres specifics.

## Shared persistence contract baseline

The shared persistence contract vocabulary under `modules/contracts/persistence` is intentionally:

- record-oriented (structured durable data references and operation scope),
- result-oriented (persistence operation envelope with shared success/failure semantics),
- identity-explicit (record references by logical type plus stable record id),
- implementation-neutral (no ORM, SQL builder, or driver-specific contract leakage).

Persistence family invariants:

- persistence operations must use shared operation identity format (`lowercase.dot.segments`),
- persistence record references normalize record identity (`recordType`, `id`) at creation boundaries,
- operation identity remains transport-neutral (no API/IPC namespace leakage),
- when a persistence result/error includes a `record`, the operation must target that record type (`<recordType>.<action>[.<qualifier>...]`).
- persistence family barrels should export persistence-only surfaces so consumers get a predictable family boundary.
- application persistence ports should stay record-oriented and operation-aware (not generic CRUD bags) and should depend on persistence contracts, not adapter-native query APIs.

This keeps Postgres as the default adapter direction without coupling application/domain boundaries to Postgres-specific APIs.


### Asset Kernel local record adapter checkpoint

`modules/adapters/persistence/asset` provides the current minimal local Asset Kernel persistence adapter. It stores JSON-compatible `AssetDefinition`, `AssetInstance`, `AssetComposition`, and `AssetBinding` records under a host-supplied root in `asset-kernel/manifest.json`, `definitions.json`, `instances.json`, `compositions.json`, and `bindings.json`; the manifest currently uses `schemaVersion: 1` and `storeKind: "asset-kernel-local-store"`. The adapter implements application repository ports and remains infrastructure-only: it does not own Asset Kernel validation, business rules, host composition, API/IPC/UI exposure, resource-backed mapping helpers, artifact/object storage, workflow execution, graph execution, runtime readiness, prompt assembly, embeddings, or AI-generated context.

The local adapter persists records and references only. It must not embed raw file/blob bytes, generated model/image/dataset payload bytes, secrets, environment values, local filesystem handles, or adapter-native paths in asset records or public errors. Durable resource-backed asset mapping persistence and explicit persistence-to-storage linkage remain deferred beyond this checkpoint.

## What belongs in persistence

Examples:

- primary entities and aggregate state,
- references, relationships, and lifecycle metadata,
- job/task state records,
- audit metadata designed for structured querying.

These concerns belong behind persistence ports/contracts and adapters (for example in `modules/adapters/persistence/`).

## What belongs in storage

Examples:

- uploaded files,
- generated artifacts (reports, exports, model outputs),
- images/media/binary payloads,
- temporary workspace material,
- cache-like files or staging artifacts.
- provider-backed repository artifacts and package-like content where provider/repo identity and revision/publication semantics are part of storage behavior.

These concerns belong behind storage ports/contracts and adapters (for example in `modules/adapters/storage/`) with contract families matched to semantics.

## Desktop and server physical mapping

Physical location can vary by host mode:

- Desktop mode may store artifacts under OS-specific app data locations.
- Server mode may store artifacts in configured file paths, mounted volumes, or object/blob services.
- Server or hybrid compositions may also include repo-backed providers where the primary storage identity is provider/repository/revision rather than local filesystem path.
- For the current server app, the default filesystem storage root is resolved from the server app/module location so
  it is deterministic and not launch-`cwd` dependent; `SERVER_STORAGE_ROOT` remains the explicit override.

Important: physical location choice does **not** remove the architectural need for storage abstraction.

## Why this separation matters

Without this separation, teams tend to:

- bury file/blob behavior in host lifecycle code,
- hide artifact handling in runtime adapters,
- mix relational and file semantics in one unreliable abstraction,
- make migration, backup, and operational policies harder to reason about.

Separate boundaries keep policies clear and change safer.

## Boundary guidance

- Application/domain should define what must be persisted or stored, not how.
- Persistence adapters implement structured record behavior.
- Storage adapters implement storage-family behavior (artifact/object, repo-backed, and future specializations as needed).
- Hosts choose concrete adapter wiring per deployment mode.

## Shared storage contract baseline

The shared storage contract vocabulary under `modules/contracts/storage` is intentionally thin and family-neutral:

- identity primitives (`StorageKind`, `StorageProviderId`),
- thin backing references (`StorageBackingReference`),
- explicit linkage between internal artifacts and concrete backings (`ArtifactStorageBinding`).

The shared baseline does not force every storage family into one request/response shape.

Specialized storage families then define their own operation contracts:

- **artifact-object storage** keeps key/blob/object semantics (`store`/`retrieve`/`has`/`delete` with storage-key descriptors),
- **artifact-repo storage** keeps provider/repository/revision/path semantics (`store/retrieve/has artifact in repo`).

Storage family invariants:

1. Shared foundation remains thin and generic rather than object-storage-specific.
2. Artifact-object and artifact-repo are peer first-class families.
3. Object-family contracts stay key/blob oriented without repo/provider fields.
4. Repo-family contracts stay provider/repository/revision/path oriented without key/blob flattening.
5. Storage family barrels export storage-only surfaces so family boundaries remain explicit and mechanically discoverable.

This keeps storage responsibilities explicit and separate from persistence-record modeling.


## Asset Kernel local persistence and resource-backed mapping boundary

- Phase 2A local Asset Kernel persistence is record storage for definitions, instances, compositions, and bindings only. Its text filtering is simple deterministic substring matching over selected saved record values.
- The local store manifest validates the current schema version, store kind, and basic timestamp shape on read; no migration framework or schema upgrade behavior is implemented.
- Asset persistence is a JSON-compatible durable boundary. Non-JSON record values such as functions, symbols, undefined values, non-finite numbers, Dates, buffers/streams, class instances, and circular references are rejected before write.
- Resource-backed mapping remains a pure application-layer contract mapper. External repository `objectPath` values stay provider metadata on `AssetExternalRepositoryObjectReference` and must not be promoted into canonical asset ids. Internal backing ids and `asset-resource-backing` references are sanitized mapping identifiers, not local paths, URLs, or provider-native object paths.
- This checkpoint adds no API/IPC/UI wiring, resource-byte storage, runtime/workflow/graph execution, prompt assembly, embeddings, AI-generated context, or automatic composition behavior.

## Repo-backed storage direction (current + next)

Repo-backed providers are a valid storage class under the storage adapter category.

### Implemented first provider slice

- **Hugging Face** is now the first concrete `artifact-repo` provider adapter implementation.
- The generic family remains provider-neutral (`ArtifactRepoStoragePort` + repo request/result contracts).
- A provider-neutral composition seam dispatches by `target.provider`; Hugging Face is currently one registered provider.
- Initial operations implemented: `hasArtifactInRepo`, `storeArtifactInRepo`, `retrieveArtifactFromRepo`.
- Published/re-check verification metadata is persisted on `ArtifactStorageBinding.backing.verification` (`exists`, `verifiedAt`) for durable read-side status.

### Auth and configuration (minimal by design)

- Token can be provided explicitly at composition boundary.
- Fallback env vars: `HF_TOKEN`, then `HUGGING_FACE_TOKEN`.
- Auth handling remains isolated to the provider adapter boundary.

### Practical constraints for this first slice

- This is intentionally a narrow vertical slice, not full provider lifecycle management.
- Upload path support can vary by provider/repo configuration; behavior should be treated as adapter-level and validated per deployment environment.
- Provider-native repository browsing/viewing semantics may exist, but they do not define internal system artifact-browser contracts.


## Ingestion and staged artifact semantic layer

The repository now treats ingestion/staged-artifact as the canonical semantic layer for inbound content.

- Storage is the artifact capability for bytes + key + adapter mapping.
- Ingestion is the semantic intake layer for staged artifacts.
- Artifact is the canonical ELT-side term for stored/flowing data objects.
- Asset terminology is reserved for composable system parts and larger built systems, not ELT-side data/blob/file material.
- Ingestion contracts provide a transport-neutral staged artifact descriptor with intake metadata (source kind, media type, size/checksum, original name when applicable).

This keeps storage generic while preventing image-only/file-only semantic drift in higher-level intake contracts.

Current implementation note:

- Image upload is the active vertical slice and is treated as a specialized ingestion path.
- This does not imply a full ingestion engine, catalog, or ELT orchestration is implemented yet.

## Artifact browser read-side direction (initial image-backed slice)

The first read-side browser/viewer slice is image-backed but artifact-shaped.

- `artifact.browse` is a metadata/query concern for catalog-style listing of existing artifacts through an explicit artifact catalog application-port seam (append/browse/read catalog records).
- `artifact.read` is a single-artifact detail/read-model concern for selected artifact metadata from the same catalog seam.
- `artifact.content.read` is a descriptor-oriented artifact-content contract and must not be collapsed into browse/detail contracts or byte payload contracts.
- actual image/media bytes for rendering should be delivered through a separate retrieval path that still resolves by storage key at the boundary.
- Canonical browse/read/content contracts should remain descriptor/reference-oriented at public boundaries (locator + metadata + availability/retrieval hints), not raw-byte-first payload contracts.
- Browser contracts stay storage-key based and path-agnostic; public browse/view contracts must not expose filesystem paths.
- Browser list/read models may include artifact/backing-state metadata (for example remote-only/localized/published cues) while preserving artifact-first semantics and path-agnostic contracts.
- The system artifact browser is a normalized browser over internal artifacts; it is not a filesystem browser.
- The system artifact browser is also not the same as a provider-native browser (for example a Hugging Face repository UI).
- External provider-native browsers may coexist, but normalized internal browse/read/content contracts remain the system source of truth.
- This is an early data-lake-like artifact browser/viewer surface, not a claim that full ingestion/catalog/ELT platform capabilities are complete.

This keeps persistence-storage linkage explicit (metadata/read models referencing artifact keys or `ArtifactStorageBinding` backing references) while preserving separation between structured record/query behavior and artifact byte retrieval behavior.

## Not yet finalized

The following are intentionally open:

- exact storage backend lineup per environment,
- standardized retention/lifecycle policies for all artifact classes,
- final conventions for linking persistence records to storage artifacts.

Until formalized, contributors should keep persistence and storage concerns explicitly separated and document any interim conventions in ADRs/context docs.

## Family invariant tests

Contract-family tests should protect this boundary model directly:

- persistence invariants (operation identity + record alignment + family exports),
- storage invariants (key normalization + artifact operation shapes + family exports).
- application persistence-port seam invariants in `modules/application/ports/persistence/tests/` (thin operation-aware record requests/results and no storage-key drift).

If these invariants change, update canonical docs and context packs in the same change.


### Current server-exposed artifact-repo operations

Server host composition now exposes a minimal but usable artifact-repo API slice through application use cases (not direct adapter calls):

- `POST /api/artifact-repo/has` -> `HasArtifactInRepoUseCase`
- `POST /api/artifact-repo/store` -> `StoreArtifactInRepoUseCase`
- `POST /api/artifact/publish` -> `PublishArtifactToRepoUseCase` (store + verify + published binding write)

This is intentionally partial. It does **not** claim full provider management or provider-native browser parity.

### Current desktop artifact-repo publish path

Desktop host composition also wires the shared `PublishArtifactToRepoUseCase` with filesystem artifact storage, binding persistence, and Hugging Face artifact-repo storage adapter.

- Renderer -> preload bridge -> Electron IPC -> shared publish use case.
- Publish success persists `ArtifactStorageBinding` (`role = published`) and desktop artifact detail surfaces that backing metadata.

### Hugging Face provider hardening status

The Hugging Face adapter remains one provider behind the generic artifact-repo port and uses the official `@huggingface/hub` client methods (`fileExists`, `uploadFile`, `downloadFile`) as the only integration path.

- Provider/repo/path validation is explicit and deterministic.
- Auth is adapter-boundary-only and required for write operations.
- Provider status mapping is explicit (`validation`, `not-found`, `unavailable`, `internal`).
- Published-backing linkage is persisted as `ArtifactStorageBinding` (`role = published`, `kind = artifact-repo`) after successful publish verification.
- Artifact detail read flow can surface published-backing metadata from binding records so thin-client detail panels can render durable remote backing state.
- Published backing data is now hardened as a structured target + verification model:
  - `target` (`provider`, `repository`, `path`, `revision`, `locator`)
  - `verification` (`exists`, `verifiedAt`)
- Locator fallback compatibility remains supported through centralized backing-target resolution helpers for legacy rows.
- Artifact identity and backing identity are now explicitly separated:
  - internal artifact id is system-owned for new repo registrations/imports,
  - provider/repository/path/revision identify backing/source relationships.


### Repo-backing authority update (April 2026)

- New publish and register-from-repo writes must populate structured `backing.target` fields (`provider`, `repository`, `path`, `revision`) on `ArtifactStorageBinding`.
- Read and verify/update paths now treat structured target data as authoritative and only fall back to locator decoding for legacy bindings that predate structured targets; legacy verify/update flows should backfill structured targets when possible.
- Remote registration now writes `role = imported-source` bindings (not `published`) to preserve backing semantics.
- Imported artifacts can now be explicitly localized/downloaded through shared orchestration (`artifact.localize.from-repo`) while keeping artifact browser as the primary surface.
- Imported-source verification is exposed as a separate shared operation (`artifact.source.verify`) so source backing status can be refreshed distinctly from published backing status.


## Hugging Face token persistence

- Hugging Face token configuration is stored as host-side config, not browser-only state.
- Server path persists token under server storage root config directory and surfaces masked status to thin client.
- Desktop path persists token under desktop AppData artifact config directory and surfaces masked status to renderer via preload/IPC.
- Hugging Face artifact-repo storage adapter resolves token dynamically from this config seam for publish/register/localize/verify workflows.



## Asset Kernel local record persistence

Local Asset Kernel persistence is structured record persistence, not artifact/blob storage. `composeLocalAssetKernel` composes it from a durable storage root, and the adapter owns the `<storageRoot>/asset-kernel/` layout for `manifest.json`, definitions, instances, compositions, and bindings. The helper returns path-safe diagnostics (`storeKind`, `schemaVersion`, and initialized state) rather than local filesystem paths, and it does not store artifact/resource bytes, generated image/model/dataset payloads, secrets, tokens, runtime installs, or provider-native file handles.

Desktop and server host registration now initialize this store for internal host composition under `storageRootDirectory` only; runtime roots must not be used for Asset Kernel records or resource-backed provider reads. Phase 2B Prompt 3 adds only an application-owned built-in asset definition seeding service that uses repository/use-case seams to validate before save, create missing valid definitions, mark built-in seed metadata, treat `seedId` + `seedVersion` + fingerprint as the idempotency key, and skip user/custom, fingerprint-mismatched, or seed-version-mismatched conflicts without overwrite; seed-version conflicts use the explicit `skipped-seed-version-mismatch` status. Phase 5 Prompt 8 adds a similar explicit internal application service for trusted system packs: `system.foundation` install validates the manifest, definitions, and quality gates before saving, persists normal Asset Kernel definitions with safe pack/source metadata, is idempotent, and skips user/custom conflicts without overwrite. It does not write files directly, import persistence adapters, create migrations, create durable active-pack records, apply override/resolver behavior, expose public install/import/export surfaces, or run automatically during host startup. Phase 2B Prompt 6 adds the registry read facade as an application-layer service only; it reads through repository ports and an optional computed resource-backed view provider, never scans storage, never executes seeding, and validates only when explicitly requested. Shared host-level `composeInternalAssetRegistry` wiring composes the local store, read facade, and Phase 3 safe resource-backed provider aggregate for private consumers while retaining path-safe diagnostics and no automatic seeding. Phase 2C and the final Phase 3 cleanup add read-only Asset Registry API/IPC/preload wrappers and desktop/thin-client Asset Library pages over persisted definitions and computed resource-backed view list/detail reads. This does not change the persistence/storage boundary: Asset Library UI and transport code must not access local persistence adapters, storage adapters, filesystem paths, resource bytes, provider clients, runtime roots, or resource scans directly. Built-ins appear only when already persisted/seeded through internal seeding, and resource-backed views remain computed descriptor-only read models that do not read bytes or turn generated outputs/external repository objects into registered assets.

Phase 3 Prompt 8 confirms that resource-backed mappings are still not persisted. Artifact/document, image/generated-output, dataset/model, and external-repository object views are computed from safe descriptor/read seams only. Asset Kernel persistence continues to store records only, not resource bytes, generated outputs, source files, thumbnails, model files, dataset files, provider payloads, or durable resource-backed view mappings.

## Runtime roots are not artifact storage roots

Runtime roots are neither persistence nor artifact-object storage roots. Runtime roots contain sidecar installs, managed Python environments, dependency state, runtime caches, and temporary sidecar outputs.

Artifact storage roots contain durable artifacts and catalog-backed content. ComfyUI `output/` should be treated as runtime/temp staging until generated outputs are finalized into artifact storage.

Server defaults should keep `SERVER_STORAGE_ROOT` and `SERVER_RUNTIME_ROOT` distinct. Desktop local mode should use desktop-owned runtime roots and desktop-owned artifact storage roots. Server/thin-client mode should use server-owned runtime roots and server-owned artifact storage roots. Future desktop-remote mode should not assume remote artifacts are local files.

See ADR-0013 and ADR-0012.

## Storage security guidance

Storage keys are opaque identifiers, not raw paths. Filesystem storage adapters must enforce path canonicalization + containment under configured storage roots. Artifact content reads/writes should be authorization-aware. Secrets and credentials are not ordinary settings payloads. Optional encryption at rest should be introduced via a `DataProtectionPort` seam, and audit events should cover sensitive artifact operations. See ADR-0015.
