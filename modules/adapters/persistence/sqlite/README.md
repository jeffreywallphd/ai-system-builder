> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

# Local SQLite Persistence

This adapter family owns the local deployment's SQLite-specific implementation
details. The adapter now opens Node's built-in SQLite driver in the Electron main
process, enforces WAL/full-sync/foreign-key/busy-timeout policy, applies monotonic
migrations, supplies transactional structured documents with optimistic
revisions, reports sanitized health, and performs online backup plus validated
restore. See ADR-0026.

Desktop main composition selects this runtime before IPC registration. Existing
JSON data passes through the explicit inventory, rollback copy, transactional
import, reconciliation, activation marker, and divergence guard before typed
repositories become active. Maintenance commands provide health, backup, guarded
restore, and deterministic portable export through the same Electron runtime.

Artifact bytes, model files, datasets, generated images, provider repository
objects, runtime installations, and secrets do not belong in this database.

The checked-in SQL under `migrations/sqlite` must remain semantically identical
to the runtime migration constant; an automated test enforces that relationship.
