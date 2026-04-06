# AI Companion: Persistence Bootstrap and Lifecycle

## Purpose

- Story 13.2.1 adds a reusable persistence bootstrap seam for authoritative storage startup.
- SQLite initialization/config/bootstrap metadata concerns now have a shared infrastructure module instead of being host-only wiring detail.

## Canonical files

- `src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`
- `src/hosts/server/AuthoritativeServerCompositionRoot.ts`

## What the runtime bootstrap now does

- Resolves SQLite bootstrap configuration from explicit host settings + environment fallbacks.
- Initializes SQLite connection pragmas (`journal_mode`, `foreign_keys`).
- Ensures bootstrap metadata + migration-ledger tables exist.
- Executes registered bootstrap migration hooks with checksum validation and replay safety.

## Host lifecycle wiring

- Authoritative host `persistence` stage now initializes the shared SQLite persistence runtime before feature registration.
- Startup-failure cleanup now disposes persistence runtime resources.
- Runtime stop cleanup now disposes persistence runtime resources alongside host shutdown.

## Config keys

- Authoritative host path key:
  - `AI_LOOM_SERVER_DATABASE_PATH`
- SQLite bootstrap override keys:
  - `AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH`
  - `AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE`
  - `AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS`

Explicit host `databasePath` remains the first-precedence value for authoritative startup composition.
