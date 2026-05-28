# Context Pack: Persistence and Storage

- Pack name: `persistence-storage`

## Purpose

- Keep work aligned with the repository's persistence/storage separation.
- Prevent structured records, artifact bytes, repository objects, and runtime roots from being conflated.

## Use When

- Upload/download, generated artifact, import/export, artifact browser, or file/blob storage work.
- Model, dataset, image, generated-output, or shared model storage location work.
- Local AppData/server storage-root decisions, temp/staged intake, persistence adapters, or storage adapters.
- Workspace-scoped resource storage, artifact reads, or model/image/dataset persistence.

## Do Not Use When

- Pure UI-only work with no data, file, or storage boundary changes.
- Runtime execution work that does not read/write records or resources.

## Core Guidance

- Persistence stores durable structured records; storage stores bytes, objects, and provider-backed resources.
- AppData/server path conventions are deployment details, not architecture boundaries.
- Persistence contracts are record-oriented and operation-identity driven.
- Storage contracts are family-specific: shared foundation identity, artifact-object key/blob semantics, artifact-repo provider/repository/revision/path semantics, and ingestion/staged-artifact intake semantics.
- Artifact browser list/detail/content concerns stay separated; media/content retrieval must not collapse into descriptor-first browse contracts.
- Storage keys are opaque contract vocabulary and must flow through shared helpers; UI-facing contracts must stay path-agnostic.
- Application logic depends on persistence/storage ports, not direct DB/filesystem/provider details.
- Host wiring composes concrete adapters and roots; runtime roots must not be used as persistence or asset-resource roots unless a canonical doc explicitly says so.
- Workspace-owned records and resources require explicit workspace context and must not fall back to global records.
- Shared model storage is an additional configured model source, not a replacement for workspace model storage.

## Key Constraints

- Keep persistence adapters and storage adapters distinct.
- Keep provider import, localization, publication, and verification semantics explicit; do not flatten them into local blob put/get.
- Workspace-scoped artifact byte reads must validate workspace/catalog ownership before reading bytes.
- Missing catalogs can be empty when documented; non-`ENOENT` failures are safe operational failures.
- Public failures must not expose filesystem messages, absolute paths, storage roots, raw JSON lines, commands, env values, stacks, secrets, or resource contents.
- Normal UI/API model read models must not expose raw `localPath`, validation report paths, cache paths, or equivalent local diagnostics unless an admin boundary is documented and tested.
- Asset Kernel records store sanitized metadata/references only; they do not own artifact bytes, generated outputs, model files, dataset files, or provider payloads.

## Current Implementation Shape

- Artifact-object storage owns key/byte/checksum/metadata behavior.
- Artifact-repo storage owns provider/repository/revision/path import and publish behavior; Hugging Face is one provider adapter, not the whole storage family.
- Hugging Face token configuration is host-side persisted config, not client-only state.
- Artifact browser reads normalize internal artifacts across backing-store differences.
- Remote registration/localization flows create or localize internal artifacts through shared application use cases.
- Workspace local persistence uses a `workspaces/` namespace for workspace records, active selection preference, and system-pack activation references.
- Workspace resource scoping applies where implemented for artifacts/uploads, image assets, generated outputs/finalization, dataset outputs, model inventory records, and runtime task outputs.

## Asset Kernel Notes

- Include `asset-kernel` when storage/resource work affects reusable assets or Asset Registry resource-backed views.
- Resource-backed views are computed, descriptor-only, sanitized read models over safe seams.
- Providers must not scan storage, read bytes, call provider clients, call runtimes, inspect model/dataset/image contents, or persist durable mappings during reads.
- Generated outputs become reusable only after explicit finalization/registration.
- External repository objects remain external until explicit import/localization/registration.
- `system.foundation@1.0.0` activation is reference-only and must not copy/install pack definitions into workspace storage.

## Canonical Source Docs

- `docs/adr/ADR-0004-persistence-and-storage-separation.md` - persistence/storage decision.
- `docs/adr/ADR-0008-ingestion-and-staged-artifact-semantic-model.md` - staged artifact intake model.
- `docs/architecture/persistence-and-storage.md` - boundary model and implementation guidance.
- `docs/architecture/workspace-model.md` - workspace scoping and active selection.
- `docs/architecture/asset-kernel.md` - asset/resource-backed view semantics.
- `docs/architecture/module-dependency-rules.md` - adapter dependency constraints.
- `docs/architecture/host-model.md` - host composition vs storage ownership.
- `docs/standards/coding-standards.md` - boundary-safe implementation expectations.

## Common Over-Inclusions To Avoid

- Pulling runtime/host docs for pure persistence/storage boundary work.
- Treating filesystem placement as architectural ownership.
- Treating provider-native repo browsers as replacements for normalized artifact-browser contracts.
- Copying full persistence/storage docs into prompts.

## Prompt Assembly Notes

- Typical set: `index` + `persistence-storage`.
- Add `asset-kernel` for resource-backed Asset Registry or Asset Library work.
- Add `security` when storage reads/writes expose public diagnostics, credentials, tokens, paths, or provider metadata.
- Add `desktop-host` or `server-host` only when host-specific root composition, API/IPC wiring, or thin-client behavior changes.
