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
- Storage is a separate concern for files, blobs, uploads, exports, generated artifacts, and temp workspace content.
- Metadata records and file/blob content are different concerns and should stay separated.
- Application logic should depend on persistence/storage ports and contracts, not direct DB/filesystem details.
- AppData/server filesystem roots are deployment details, not architecture boundaries.
- Do not bury file/blob behavior inside runtime adapters or host glue.

## Key Constraints

- Physical location does not define architecture; boundary ownership does.
- Do not assume filesystem placement answers persistence-vs-storage design questions.
- Keep persistence adapters and storage adapters as distinct responsibilities.

## Canonical Source Docs

- `docs/adr/ADR-0004-persistence-and-storage-separation.md` — decision rationale for separating persistence and storage.
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
