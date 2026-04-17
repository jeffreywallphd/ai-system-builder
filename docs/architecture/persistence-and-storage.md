# Persistence and Storage

## Core distinction

`ai-system-builder` treats **persistence** and **storage** as separate architecture concerns.

- **Persistence**: structured, durable application records and relational/queryable state.
- **Storage**: file/blob/artifact-oriented content and workspace-like material.

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

The shared storage contract vocabulary under `modules/contracts/storage` is intentionally:

- artifact-oriented (uploads, generated outputs, exports, temp workspace artifacts),
- key-based (logical artifact identifiers rather than physical path assumptions),
- metadata-aware (optional media type, size, checksum, and artifact metadata),
- operation-scoped (`store`, `retrieve`, `has`, `delete` request/result contracts).

Storage family invariants:

- artifact identity is logical-key-first and path-agnostic; keys are normalized through shared storage key helpers.
- storage request/result contracts stay artifact-operation-specific (`store`, `retrieve`, `has`, `delete`) and avoid persistence-style record semantics.
- checksum metadata in storage descriptors should be generated at the storage adapter boundary from the bytes actually written (for integrity/diagnostics), not treated as deduplication policy.
- storage family barrels should export storage-only surfaces so artifact usage is predictable and mechanically discoverable.

This keeps storage responsibilities explicit and separate from persistence-record modeling.

Current-state note:

- The currently implemented shared storage contracts are artifact/object-oriented (key/byte operations).
- This is not a claim that all storage families must use identical contracts.
- Additional storage contract families are expected as repo-backed adapters are introduced.

## Repo-backed storage direction (forward-looking)

Repo-backed providers are a valid storage class under the storage adapter category.

- A likely first provider example is **Hugging Face** (for model/dataset-style repository storage). Hugging Face is planned, not yet implemented in this prompt scope.
- Treat Hugging Face as repo-backed storage/provider semantics, not as "just another blob store."
- Import from provider repos and publish to provider repos are distinct operations with provider/revision/visibility semantics.
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
