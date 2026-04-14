# Persistence and Storage

## Core distinction

`ai-system-builder` treats **persistence** and **storage** as separate architecture concerns.

- **Persistence**: structured, durable application records and relational/queryable state.
- **Storage**: file/blob/artifact-oriented content and workspace-like material.

This distinction is required even when both end up on the same machine or disk.

## Default persistence adapter target

Postgres is the default persistence adapter target for structured records.

This establishes a default operational direction for schema/migrations and relational data handling, without forcing every module to know Postgres specifics.

## Shared persistence contract baseline

The shared persistence contract vocabulary under `modules/contracts/persistence` is intentionally:

- record-oriented (structured durable data references and operation scope),
- result-oriented (persistence operation envelope with shared success/failure semantics),
- identity-explicit (record references by logical type plus stable record id),
- implementation-neutral (no ORM, SQL builder, or driver-specific contract leakage).

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
- cache-like files or staging assets.

These concerns belong behind storage ports/contracts and adapters (for example in `modules/adapters/storage/`).

## Desktop and server physical mapping

Physical location can vary by host mode:

- Desktop mode may store artifacts under OS-specific app data locations.
- Server mode may store artifacts in configured file paths, mounted volumes, or object/blob services.

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
- Storage adapters implement artifact/file/blob behavior.
- Hosts choose concrete adapter wiring per deployment mode.

## Shared storage contract baseline

The shared storage contract vocabulary under `modules/contracts/storage` is intentionally:

- artifact-oriented (uploads, generated outputs, exports, temp workspace assets),
- key-based (logical artifact identifiers rather than physical path assumptions),
- metadata-aware (optional media type, size, checksum, and artifact metadata),
- operation-scoped (`store`, `retrieve`, `has`, `delete` request/result contracts).

This keeps storage responsibilities explicit and separate from persistence-record modeling.

## Not yet finalized

The following are intentionally open:

- exact storage backend lineup per environment,
- standardized retention/lifecycle policies for all artifact classes,
- final conventions for linking persistence records to storage artifacts.

Until formalized, contributors should keep persistence and storage concerns explicitly separated and document any interim conventions in ADRs/context docs.
