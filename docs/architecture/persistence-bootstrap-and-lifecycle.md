# Persistence Bootstrap and Lifecycle

This note documents the Story 13.2.1 baseline for authoritative persistence bootstrap infrastructure.

## Purpose

- Provide a reusable, host-safe persistence bootstrap seam under `src/infrastructure/persistence`.
- Keep SQLite initialization, baseline metadata bootstrap, and migration hook coordination in infrastructure.
- Keep startup and shutdown behavior explicit in the authoritative host bootstrap lifecycle.

## Canonical implementation seams

- Runtime + config resolver:
  - `src/infrastructure/persistence/sqlite/SqlitePersistenceRuntime.ts`
- Transaction coordination runtime seam:
  - `src/infrastructure/persistence/sqlite/SqliteTransactionCoordinator.ts`
- Authoritative persistence composition seam:
  - `src/infrastructure/persistence/AuthoritativePersistenceComposition.ts`
- Authoritative host integration:
  - `src/hosts/server/AuthoritativeServerCompositionRoot.ts`

## Bootstrap responsibilities

`createSqlitePersistenceRuntime(...)` now owns:

- infrastructure-safe SQLite path/config resolution
- connection initialization with baseline pragmas (`journal_mode`, `foreign_keys`)
- bootstrap metadata table creation
- bootstrap migration ledger creation
- deterministic migration hook execution with checksum tracking
- migration replay resilience for additive-column drift (`ALTER TABLE ... ADD COLUMN` duplicate-column faults are treated as idempotent replays so host startup can recover from partially applied legacy schemas)

This keeps migration-safe evolution explicit before domain-specific repository migrations run.

## Story 13.2.4 transaction coordination baseline

- Shared application transaction boundary contract and helper now live in:
  - `src/application/common/ports/PlatformTransactionPorts.ts`
- SQLite transaction coordination now provides unit-of-work style grouped mutation execution with:
  - outer transaction boundaries (`BEGIN IMMEDIATE`, `COMMIT`, `ROLLBACK`)
  - nested savepoint handling for re-entrant transaction scopes
  - serialized outer transaction execution for a shared connection
- Repository adapter participation now includes:
  - `SqliteIdentityPersistenceAdapter.runInTransaction(...)`
  - `SqliteWorkspacePersistenceAdapter.runInTransaction(...)`
- Application use cases can opt into grouped multi-repository updates by injecting a transaction manager and calling `runInTransactionBoundary(...)` instead of handling low-level transaction primitives.
- Rollback semantics are explicit and test-covered for failure cases where one persistence step in a grouped mutation fails.

## Lifecycle integration

Authoritative host composition now wires persistence into the shared host startup pipeline:

- `persistence` stage initializes the runtime and runs bootstrap hooks.
- `persistence` stage composes authoritative persistent platform services (repository adapters, audit sinks, and platform persistence adapter bundle) and stores them as startup artifacts.
- SQLite bootstrap now runs deterministic domain migration hooks from `createAuthoritativePersistenceMigrationHooks(...)` before feature registration.
- `feature-registration` stage injects composed persistent platform services into `startIdentityServerHost(...)` so runtime delivery flows use startup-composed authoritative adapters.
- startup failure cleanup disposes persistence runtime resources.
- startup failure cleanup also disposes composed persistent platform services.
- runtime `stop()` shutdown cleanup disposes composed persistent platform services and persistence runtime resources after host shutdown.

The single authoritative server model remains unchanged: control-plane data writes are still owned by the authoritative host, and persistence concerns stay in infrastructure.

## Environment configuration

Primary authoritative server path configuration remains:

- `AI_LOOM_SERVER_DATABASE_PATH`

SQLite bootstrap runtime also supports infrastructure-level overrides:

- `AI_LOOM_PERSISTENCE_SQLITE_DATABASE_PATH`
- `AI_LOOM_PERSISTENCE_SQLITE_JOURNAL_MODE`
- `AI_LOOM_PERSISTENCE_SQLITE_FOREIGN_KEYS`

For authoritative server startup, explicit host `databasePath` configuration takes precedence, then environment fallbacks.
