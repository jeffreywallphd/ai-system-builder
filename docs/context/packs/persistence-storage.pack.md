# Context Pack: Persistence and Storage

- Pack name: `persistence-storage`

## Purpose

- Keep implementation work aligned with the repository’s persistence/storage separation.
- Prevent conflating structured durable records with file/blob artifact handling.

## Use When

- Upload/download, generated artifact, export/import, or file-storage work.
- Temp workspace handling or local data directory decisions.
- Desktop AppData/server storage-root usage decisions.
- Persistence/storage adapter work and DB-vs-file responsibility boundaries.

## Do Not Use When

- Tasks with no persistence or storage impact.
- Pure UI-only tasks with no file/data boundary changes.

## Core Guidance

- Postgres is the default persistence target for structured durable application data.
- Storage adapters are a broad architecture category under `modules/adapters/storage`, not a single flat contract shape. Shared storage foundation contracts define family-neutral identity (`StorageKind`, `StorageProviderId`, `StorageBackingReference`).
- Storage is a separate concern from persistence and can include specialized storage families with distinct semantics.
- Artifact-object storage (keys/bytes/checksums/metadata, including `ArtifactObjectStorageLocator`) is one storage family; do not assume all storage concerns fit this shape.
- Artifact-repo storage is a valid storage specialization (provider/repository/revision/path plus import/publish behaviors).
- Hugging Face is now the first implemented artifact-repo provider adapter; do not frame it as "just another blob store" and do not treat it as the definition of the whole family.
- Ingestion/staged artifact contracts are the canonical higher-level intake semantics for inbound content; storage stays the underlying artifact capability.
- Persistence contracts stay record-oriented: operation identity + record reference + result/error envelope.
- Persistence operation names should stay helper-driven and transport-neutral (`lowercase.dot.segments` with no `api.`/`ipc.` prefixes).
- When persistence contracts include a record reference, operation identity should target that record type (`<recordType>.<action>[.<qualifier>...]`).
- Keep persistence family exports scoped to persistence contracts only.
- Keep application persistence-port seams operation-aware and record-oriented (not CRUD-generic), with focused anti-drift tests in `modules/application/ports/persistence/tests/`.
- Shared storage contracts should stay thin and family-neutral (`modules/contracts/storage`) and should avoid physical-path assumptions.
- Specialized families define operation contracts: artifact-object for key/blob semantics and artifact-repo for provider/repository/revision/path semantics.
- Shared ingestion contracts (`modules/contracts/ingestion`) should carry staged artifact intake metadata (for example source kind, original name, staged artifact identity) without becoming transport-specific.
- Storage key creation/normalization should flow through shared storage key helpers to prevent per-operation key-shape drift.
- Storage checksums should be computed in concrete storage adapters from persisted bytes and surfaced through descriptor results; checksum support does not imply deduplication behavior.
- Keep storage family exports scoped to storage contracts only.
- For artifact-browser read work, keep contracts split by concern:
  - browse/list contracts are metadata/catalog oriented,
  - detail/read contracts are artifact read-model oriented,
  - content retrieval stays in a separate content-read contract path and should remain descriptor/reference-oriented at canonical public boundaries (avoid raw-byte-first canonical payloads).
- The system artifact browser is a normalized browser over internal artifacts across backing-store differences.
- Do not implement direct filesystem browsing semantics in UI-facing contracts; keep artifact browser locators key-based and path-agnostic.
- Do not treat provider-native repo browsers (for example Hugging Face UI browsing) as replacements for normalized system artifact-browser contracts.
- Keep media retrieval on a separate retrieval path; do not collapse byte retrieval into descriptor-oriented artifact-browser contracts.
- Metadata records and file/blob content are different concerns and should stay separated. Use explicit linkage contracts (for example `ArtifactStorageBinding`) instead of flattening families.
- Application logic should depend on persistence/storage ports and contracts, not direct DB/filesystem details.
- AppData/server filesystem roots are deployment details, not architecture boundaries.
- Do not bury file/blob behavior inside runtime adapters or host glue.

## Key Constraints

- Physical location does not define architecture; boundary ownership does.
- Do not assume filesystem placement answers persistence-vs-storage design questions.
- Keep persistence adapters and storage adapters as distinct responsibilities.
- Keep provider import semantics and provider publication semantics explicit; do not flatten them into local blob put/get assumptions.
- For app-layer seams, pass request metadata through `ApplicationRequestContext` and keep storage request payload contracts focused on storage semantics.
- Workspace-scoped artifact content reads must validate the workspace/catalog record before retrieving bytes; byte reads must not run after missing workspace, wrong workspace, missing record, or catalog-unavailable failures. Missing artifact catalog files are empty catalogs, but non-`ENOENT` read failures are safe operational failures, not empty lists.
- Public storage/catalog/generated-image failures must not include raw filesystem messages, absolute paths, storage roots, raw JSON lines, env/command values, stack traces, or resource contents. Safe details are limited to operation, filesystem error code, sanitized storage key when the key is already public contract vocabulary, and request/correlation ids.
- Workspace-owned upload clients must require an active workspace id and include it in API/IPC/form-data requests; client hooks should block workspace-owned uploads before transport when no active workspace is available.
- Normal model UI/API read models should not expose `localPath`, `validationReportPath`, or equivalent local filesystem diagnostics; keep those fields internal/admin-only unless explicitly documented and tested.

- Phase 6 Prompt 2 adds workspace storage descriptor contracts only. `WorkspaceStorageRootDescriptor` is path-free UI/public vocabulary; do not add workspace repositories, migrations, directory creation, active-selection persistence, activation storage behavior, or resource scoping until later Phase 6 prompts.

## Canonical Source Docs

- `docs/adr/ADR-0004-persistence-and-storage-separation.md` — decision rationale for separating persistence and storage.
- `docs/adr/ADR-0008-ingestion-and-staged-artifact-semantic-model.md` — direction for ingestion-centric staged artifact semantics above storage mechanics.
- `docs/architecture/persistence-and-storage.md` — current boundary model and practical implementation guidance.
- `docs/architecture/module-dependency-rules.md` — dependency constraints for adapters and inner layers.
- `docs/architecture/host-model.md` — host wiring responsibilities vs storage/persistence ownership.
- `docs/standards/coding-standards.md` — boundary-safe implementation expectations.

## Common Over-Inclusions to Avoid

- Pulling full runtime/host docs for tasks limited to persistence/storage boundary clarity.
- Treating AppData/server path conventions as canonical storage architecture.
- Copying full canonical persistence/storage docs into prompts.

## Prompt Assembly Notes

- Typical set: `index` + `persistence-storage`.
- Add `architecture` for cross-layer boundary changes.
- Add `desktop-host` or `server-host` only when host-specific composition or path wiring changes.



## Current implementation checkpoint (artifact-repo family)

- Hugging Face adapter uses official `@huggingface/hub` client methods (`fileExists`, `uploadFile`, `downloadFile`) as the only provider integration path (no handcrafted fallback provider path).
- Server and desktop hosts expose publish workflow wiring through the shared application use case path (`PublishArtifactToRepoUseCase`), while keeping artifact-object storage flows separate and intact.
- Publish flow writes durable `ArtifactStorageBinding` records for published artifact-repo backings.
- Published backing metadata read paths should prefer structured backing target fields + backing verification metadata (`verification.exists`, `verification.verifiedAt`) when present and use centralized locator decode helpers only as fallback for legacy records.


- Current artifact-browser read adapters should prefer structured repo target fields for backing metadata and use locator decode only for compatibility with legacy rows.
- Current verify/update flows should also prefer structured repo target fields and only decode locator for compatibility; updates should backfill structured targets when available.
- Remote registration slice now exists (`artifact.register.from-repo`): verify remote target, create internal catalog record, persist `imported-source` binding.
- New registration writes use system-owned internal artifact ids; provider/repository/path/revision remain backing/source identity.
- Imported artifacts can now be explicitly localized (`artifact.localize.from-repo`) to create local artifact-object bytes when only remote-source backing exists.
- Imported-source verification can now be re-checked independently (`artifact.source.verify`) while preserving artifact-first read/detail semantics.


- Hugging Face token config now follows a host-side persisted config seam (server-storage-root for thin client and desktop AppData for desktop host) and is consumed dynamically by artifact-repo operations; do not fall back to client-only token state as source of truth.

- Enforce storage-key/path containment rules in filesystem adapters.
- Artifact reads/writes should be authorized by shared policy seams.
- Secrets are not ordinary settings payloads.
- Future at-rest encryption should use a data-protection port seam.

## Asset Kernel Notes

- Include `asset-kernel.pack.md` when storage/artifact work affects reusable/composable asset semantics.
- Artifacts/resources can back assets, but they do not replace `AssetDefinition`, `AssetInstance`, `AssetBinding`, or `AssetComposition`.
- Resource-backed assets should reference artifact/resource storage identities rather than embedding raw paths or bytes in asset metadata.
- Generated outputs become reusable only after finalization/registration as artifacts or resource-backed assets; Hugging Face objects remain external repository objects until registered/imported.
- Do not rename existing artifact/model/dataset/image concepts in Phase 2A.

## Asset Kernel local persistence checkpoint

- Prompt 9 adds `modules/adapters/persistence/asset` as a minimal local JSON persistence adapter behind Asset Kernel application repository ports; Phase 2B now wires shared internal Asset Registry read-facade composition into desktop/server host registration from `storageRootDirectory` under `<storageRootDirectory>/asset-kernel/`. Runtime roots are not Asset Kernel record roots. Phase 5 Prompt 8 adds explicit internal install/seeding for `system.foundation` through application services only: it validates before saving, writes normal definition records with safe pack/source metadata through repository/use-case seams, is idempotent for matching system-owned entries, and fails user/custom conflicts without overwrite. Phase 5 Prompt 10 adds a pure resolver that consumes explicit definitions/manifests/override rules supplied by the caller and does not read or write the local store; resolver results are internal and not public read payloads. Phase 5 Prompt 11 adds pure in-memory manifest serialization/fingerprint helpers and fixtures only; fingerprinting is not validation and does not write manifest files, create archives, store signatures, add import/export records, or change persistence adapters. Automatic startup seeding, public transport exposure, active-pack persistence, import/export/sharing, marketplace/package registry behavior, repository-backed resolution, storage scans, and resource-byte writes remain deferred; the store remains separate from artifact/resource bytes and runtime roots.
- It stores definitions, instances, compositions, and bindings as structured JSON-compatible records with a `schemaVersion: 1` manifest; it checks the current schema version/store kind on read, implements no migrations, is not artifact/object storage, and does not store bytes or resource payloads.
- Local repository text filtering is simple case-insensitive substring matching over selected saved record values; Asset Registry read-facade lists should forward supported repository filters before applying deterministic facade-side filtering only for query shapes the repository ports cannot express.
- Validation remains in application services/use cases before save; the adapter is a storage mechanism, but the durable write boundary rejects non-JSON record values instead of silently coercing them.
- Prompt 10 resource-backed mapping is pure mapping only: external repository object paths remain provider metadata, internal backing references use safe `asset-resource-backing` ids, and explicit persistence-to-storage linkage remains deferred.
- Phase 2B Prompt 5 resource-backed views are computed internal read-side projections only. They may expose sanitized Asset Kernel view objects for artifacts, finalized image assets, generated outputs, datasets, model records, document-like artifact descriptors, external/artifact repository objects, Hugging Face-like files, and previews, but they do not persist durable mappings, localize/download repository files, read artifact bytes, inspect dataset/model/image contents, or add API/IPC/UI/host exposure.
- Phase 3 Prompt 3 artifact/document resource-backed views are still metadata-only computed views. The application provider consumes the artifact browser metadata list seam, not artifact-object storage, filesystem catalog internals, or content retrieval. It must not expose storage paths or unsafe storage keys, read bytes/content, persist mappings, or create asset instances; host wiring remains deferred.
- Phase 3 Prompt 4 image/generated-output resource-backed views are also metadata-only computed views. Finalized image assets require an explicit descriptor-only image list seam; missing seams produce safe diagnostics. Generated outputs may be injected only as already-known descriptors and remain unfinalized/unregistered views. The provider must not scan gallery/runtime/storage directories, read image bytes/base64/content/previews, expose artifact storage paths, persist mappings, create asset instances, or finalize outputs.
- Phase 4 Prompt 4 generated-output finalization may write through an existing application-layer image/artifact finalization seam and then `AssetInstanceRepositoryPort`, but the Asset Kernel use case must not directly write adapters, filesystem, storage blobs, runtime state, or provider clients. Asset Kernel records store sanitized metadata/references only; image/artifact systems remain byte owners, and partial failure after image/artifact finalization must be explicit and retry-safe.
- Phase 4 Review A tightens this write path: command guards and safe instance ID generator availability are checked before source reads, duplicate searches, finalization seam calls, or `AssetInstanceRepositoryPort` writes. Partial failures after image/artifact finalization expose only safe finalized image/artifact references needed for retry, not paths, tokens, prompts, workflow payloads, raw errors, or stacks.
- Phase 4 Prompt 5 external object import/localization may create durable imported/localized state only behind the application external object import/localization port. The Asset Kernel use cases do not call provider clients, storage adapters, filesystem APIs, token stores, or byte/content readers directly; they persist only `AssetInstance` metadata/references after the port returns safe internal resource references/backings. Partial failure after durable import/localization is explicit and retry-safe.
- Phase 3 Prompt 6 external repository object views are computed only from already-known metadata seams such as injected safe descriptors, artifact-repo descriptors, artifact storage binding target metadata, or persisted model publishing summaries. They must not call artifact-repo/Hugging Face provider operations, inspect provider caches, read tokens, read repository bytes, localize/import/publish, persist mappings, or treat provider paths as Asset Kernel asset ids. Missing safe descriptor seams return sanitized unsupported diagnostics.
- Phase 3 Review B keeps repository object paths as descriptor identity input only and omits them from public resource-backed provider/facade output by default. Provider labels such as `local`, `http`, and `custom` remain metadata labels and do not authorize filesystem, network, token, provider-client, existence-check, import/localize/publish, registration, runtime, or byte-read behavior.
- Phase 3 Prompt 7 host wiring composes resource-backed views from safe descriptor/read seams only. Artifact browser metadata, finalized image asset descriptor records, persisted model inventory records, and persisted model publishing summaries may be read as descriptors; runtime roots, storage scans, artifact bytes/content, image files/base64, dataset/model files, provider clients, token stores, Hugging Face browse/download/upload, and artifact-repo store/localize/publish seams must not be used for Asset Registry resource-backed reads.
- Phase 3 Prompt 8 confirms no resource-backed mapping persistence is added. Computed views remain read models over existing descriptor seams; Asset Kernel persistence stores only definition/instance/composition/binding records, not resource bytes, source files, provider payloads, generated outputs, or durable view mappings.
- Phase 3 Review A clarifies lookup/pagination limits. Artifact/document provider detail reads are bounded browse-list fallbacks unless a future safe locator-bearing seam is added; cursor pagination is not claimed because the current artifact metadata browse seam has no cursor/limit contract. Image/generated-output providers should use descriptor-only direct read seams for safe reversible ids, and should only preserve source cursors when a single image/generated-output source is active.
- Phase 3 Prompt 5 dataset/model views are metadata-only projections over injected safe dataset descriptors and persisted model inventory records. Dataset descriptors are not discovered by scanning storage, and model inventory reads must pass `includeDiscovered: false`; local paths, materialization paths, cache/checkpoint/report/output paths, raw provider payloads, logs, bytes/blobs/base64, and secrets are omitted. The provider adds no persistence for mappings and no asset instances.
- API/IPC/UI, runtime execution/readiness, workflow/graph execution, prompt assembly, embeddings, and public host exposure remain out of scope for this adapter checkpoint.
- Phase 6 Prompt 3 adds workspace application repository ports and local file-backed adapters for workspace records/indexes, active workspace selection preference, and workspace system-pack activation records. Local workspace persistence uses the `workspaces/` namespace (`index.json`, `active-workspace.json`, per-workspace `workspace.json`, and per-workspace `activations/system-packs.json`), avoids raw path leakage in public errors/read models, stores activation references by pack id/version only, does not install/copy system pack definitions, and does not create artifact/image/model/data workspace resource directories yet. Phase 6 Prompt 4 adds the application create use case over these ports; it may persist an active selection only when explicitly requested and may persist a reference-only `system.foundation@1.0.0` activation without using the Phase 5 installer. No UI/API/IPC/preload surface, host wiring, page gating, Asset Library effective view, or resource scoping is implemented by this checkpoint.

## Phase 6 Prompt 6 workspace activation persistence boundary

The workspace activation availability use cases consume persisted activation reference records through `WorkspaceSystemPackActivationRepository` only. They produce compact active-pack availability and safe diagnostics, recognize only `system.foundation@1.0.0`, and may update only existing known activation status between active/inactive. They must not create resource directories, copy/install system pack definitions, write Asset Kernel definition records, call system-pack installers, expose raw persistence errors, or add artifact/data/model/image scoping. Asset Library effective-view filtering and public pack management remain later work.

## Phase 6 Prompt 8 artifact workspace scoping

Artifacts and uploads are workspace-scoped. Artifact browse/upload/read operations require explicit workspace context and must not fall back to global artifact records. Uploaded bytes use a workspace-scoped storage keyspace; legacy global artifacts are not auto-migrated. Artifact-backed resource views require workspace context. Image assets, generated outputs, datasets, models, runtime task outputs, user-library behavior, and cross-workspace reuse remain deferred.

Phase 6 Prompt 9 update: User/workspace-owned image asset records, generated-output descriptors/finalization, dataset preparation outputs, model inventory records, and runtime task outputs created from workspace actions require an explicit workspace id. Missing workspace context must fail safely and must not fall back to global records. Workspace-owned records from one workspace must not be listed or read as another workspace. Generated-output finalization validates source workspace ownership before writing finalized image assets or Asset Kernel instances, and finalized provenance/metadata carries workspace context. Legacy global image/model/dataset/generated-output records are not silently assigned to a hidden/default workspace and are not auto-migrated; a future explicit import/migration flow may be needed. Global runtime readiness, installed-runtime/model diagnostics, and provider configuration diagnostics may remain global, but they must not be presented as workspace-owned resource records. User-library and cross-workspace reuse remain later work.

## Phase 6 final stabilization / Phase 7 handoff

Phase 6 final state: workspace is the normal boundary for user/project resources. No active workspace means workspace-scoped pages are gated and must not render underlying feature components or call workspace-scoped clients. Active workspace display uses the workspace display name. System Foundation remains system-owned and is made available only through a `system.foundation@1.0.0` workspace activation reference; workspace creation must not call the Phase 5 installer, copy pack definitions, create a hidden/default workspace, or perform startup seeding. Workspace-owned artifacts/uploads, image assets, generated outputs/finalization, dataset outputs, model records, and runtime task outputs require explicit workspace context where implemented, must not leak across Workspace A/B, and must not fall back to legacy global records. Global runtime readiness and system/provider diagnostics may remain global but must not masquerade as workspace-owned records. Collaboration fields are passive placeholders only.

Phase 7 is User Library and Cross-Workspace Asset Reuse. It should define explicit promote/link/copy/import flows and provenance/resolver behavior without accidental propagation. Do not implement user-library, cross-workspace reuse, collaboration permissions, invites/sync/remote auth, asset authoring, override editing, pack import/export/install, marketplace, visual composition, workflow execution expansion, provider/network expansion, or automatic legacy migration as part of Phase 6 stabilization.
