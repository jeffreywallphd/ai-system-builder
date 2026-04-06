# Persistence Bootstrap and Lifecycle

This note documents the Story 13.2.1 baseline for authoritative persistence bootstrap infrastructure.

## Purpose

- Provide a reusable, host-safe persistence bootstrap seam under `src/infrastructure/persistence`.
- Keep SQLite initialization, baseline metadata bootstrap, and migration hook coordination in infrastructure.
- Keep startup and shutdown behavior explicit in the authoritative host bootstrap lifecycle.

## Canonical implementation seams

- Runtime + config resolver:
  - `src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`
- Authoritative host integration:
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`

## Bootstrap responsibilities

`createSqlitePersistenceRuntime(...)` now owns:

- infrastructure-safe SQLite path/config resolution
- connection initialization with baseline pragmas (`journal_mode`, `foreign_keys`)
- bootstrap metadata table creation
- bootstrap migration ledger creation
- deterministic migration hook execution with checksum tracking

This keeps migration-safe evolution explicit before domain-specific repository migrations run.

## Lifecycle integration

Authoritative host composition now wires persistence into the shared host startup pipeline:

- `persistence` stage initializes the runtime and runs bootstrap hooks.
- startup failure cleanup disposes persistence runtime resources.
- runtime `stop()` shutdown cleanup disposes persistence runtime resources after host shutdown.

The single authoritative server model remains unchanged: control-plane data writes are still owned by the authoritative host, and persistence concerns stay in infrastructure.

## Environment configuration

Primary authoritative server path configuration remains:

- `AI_LOOM_SERVER_DATABASE_PATH`

SQLite bootstrap runtime also supports infrastructure-level overrides:

- `AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH`
- `AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE`
- `AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS`

For authoritative server startup, explicit host `databasePath` configuration takes precedence, then environment fallbacks.
