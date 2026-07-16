# Persistence Operations

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

- Status: active operator runbook
- Decision authority: [ADR-0025](../adr/ADR-0025-deployment-shaped-structured-persistence.md), [ADR-0026](../adr/ADR-0026-local-sqlite-runtime.md), and [ADR-0027](../adr/ADR-0027-managed-postgresql-runtime.md)
- Architecture authority: [Persistence and Storage](../architecture/persistence-and-storage.md)

This runbook covers the implemented database boundary. Artifact bytes have a
separate lifecycle and must be backed up from `SERVER_STORAGE_ROOT` or the
equivalent desktop artifact directory. Runtime installations and caches are
replaceable and are not database backup content.

## Operational safety rules

1. Stop the desktop application before a local restore. Quiesce server writes or
   put the managed deployment into maintenance before a coordinated database and
   artifact restore.
2. Take and verify a backup before application or schema upgrades. Never delete
   the JSON import rollback copy or pre-restore SQLite file until acceptance is
   complete.
3. Supply connection strings, token hash secrets, CA material, and backup
   credentials through the deployment secret boundary. Do not paste them into
   committed environment files or logs.
4. Treat portable NDJSON exports as sensitive. They contain application records,
   not secrets by design, but may contain user-authored or imported content.
5. Do not use runtime caches as a recovery source and do not restore structured
   records without the corresponding durable artifact set when referential
   consistency matters.

## Local SQLite

The data root is Electron's platform-specific application `userData` directory;
the database is `<data-root>/persistence/ai-system-builder.sqlite3`. The
maintenance command uses the pinned Electron runtime so it exercises the same
`node:sqlite` implementation as the desktop package. Health, backup, and export
require an existing database and do not silently select JSON.

```text
npm run persistence:sqlite -- health --data-root <desktop-user-data>
npm run persistence:sqlite -- backup --data-root <desktop-user-data> --destination <backup.sqlite3>
npm run persistence:sqlite -- export --data-root <desktop-user-data> --destination <portable.ndjson>
```

The health command checks SQLite integrity, schema version, WAL mode, and foreign
key enforcement. Backup uses SQLite's online backup API. The portable export is a
transactionally consistent, deterministic NDJSON document containing a versioned
manifest, document count, and SHA-256 digest.

Restore validates database integrity and the exact supported schema before
replacement. It requires the explicit confirmation flag and retains the old live
database as `<database>.pre-restore`:

```text
npm run persistence:sqlite -- restore --data-root <desktop-user-data> --backup <backup.sqlite3> --confirm-replace
```

After restore, run health, start the desktop app, verify representative workspace,
System Builder, Settings / Software status, library, plan, and artifact reads,
then retain or remove the pre-restore copy according to approved retention policy.
SQLite documents the online backup API and `VACUUM INTO` as live-database backup
options in its [backup guidance](https://www.sqlite.org/backup.html).

## Managed PostgreSQL

The same runtime configuration used by the server is used by the maintenance
command. `DATABASE_URL` is mandatory; TLS verification is the default.

```text
npm run persistence:postgres -- health
npm run persistence:postgres -- export --destination <portable.ndjson>
```

Health reports only schema compatibility, query latency, pool counts, and
sanitized idle-client error counters/timestamps. Export
runs under a transactionally consistent transaction and writes the same versioned NDJSON
format as SQLite. Neither command prints the connection string.

Use the database platform's physical or managed backup service for disaster
recovery. For a logical backup, use the matching PostgreSQL client toolchain and
the platform credential mechanism; custom format supports selective inspection
and `pg_restore`:

```text
pg_dump --format=custom --no-owner --file <backup.dump> <database-connection>
pg_restore --list <backup.dump>
pg_restore --clean --if-exists --no-owner --dbname <empty-restore-target> <backup.dump>
```

PostgreSQL documents `pg_dump` as a consistent export that does not block normal
readers or writers, while warning that the client version must not be older than
the source server major version; see the official
[pg_dump documentation](https://www.postgresql.org/docs/current/app-pgdump.html).
Restore first to an isolated target, run the application's health and live
conformance test, compare representative counts/identities, and only then change
traffic or connection configuration.

Repository CI also runs a destructive logical-recovery drill against its
disposable PostgreSQL 18 service:

```text
RECOVERY_POSTGRES_CONTAINER=<disposable-container-id> \
RECOVERY_POSTGRES_DATABASE=<disposable-database> \
RECOVERY_POSTGRES_USER=<qualification-user> \
TEST_POSTGRES_URL=<qualification-url> \
npm run test:postgres-recovery
```

The command seeds deterministic application records, writes and inspects a
custom-format dump, copies the dump outside the database container, force-drops
and recreates the disposable source database, restores it with `pg_restore`,
runs application health and marker checks, and compares the canonical portable
export count and SHA-256 digest. It writes sanitized timing/checksum evidence
under `artifacts/qualification/postgres-recovery`. Never point this command at a
shared, staging, or production database: destruction is intentional.

## Upgrade and rollback

The application owns monotonic migrations and serializes startup migration work.
Current schema version is 1 for both engines.

- An older schema is migrated during startup inside a database transaction.
- The exact current schema is accepted without mutation beyond startup validation.
- A schema newer than the application supports fails startup; there is no silent
  downgrade, fallback, or dual write.
- Checked-in and runtime migration SQL must remain byte-semantically equivalent.
- Schema changes should follow expand, migrate, verify, then contract. Destructive
  contract work requires a separate accepted decision and a restore drill.
- An application rollback is safe only while the previous release supports the
  deployed schema. Otherwise restore the pre-upgrade database and matching
  artifact snapshot before starting the previous release.

For a rollout: record the app/image digest, verify a recent recoverable backup,
drain traffic, deploy one instance to run the serialized migration, wait for
`/health/ready`, run smoke reads/writes, then expand. On failure, stop the new
release, preserve diagnostics, and follow the compatibility rule above.

## Readiness and observability

The server exposes unauthenticated orchestration probes before API authentication:

- `GET /health/live` checks only that the process can serve a request.
- `GET /health/ready` requires compatible structured persistence and readable,
  writable artifact storage. It reports sanitized schema versions, query latency,
  pool total/idle/waiting and idle-client error state, and artifact capacity
  without paths, SQL,
  connection strings, record content, or exception messages.

Readiness failure should remove an instance from traffic; it should not immediately
restart an otherwise live process. This follows the distinction in the official
[Kubernetes probe guidance](https://kubernetes.io/docs/concepts/workloads/pods/probes/).
Aggregate latency, waiting connections, failed readiness checks, free capacity,
migration failures, and pool errors in the deployment monitoring platform.
Backup age and recovery success are external backup-system signals and are not
invented by the application.

## Recovery objectives and drills

Campus, corporate, and cloud operators must approve retention, backup frequency,
RPO, RTO, regional/host failure scope, encryption, and ownership before declaring
a deployment production-qualified. At least quarterly or at the approved cadence:

1. restore a database backup to isolation;
2. restore or attach the matching artifact snapshot;
3. run health, migrations, live PostgreSQL conformance, and representative reads;
4. verify portable export digest/count and selected relationships;
5. measure elapsed restore and data-loss windows against the approved objectives;
6. record evidence, app/database versions, and corrective actions.

No value for those objectives is assumed by this repository because the decision
register intentionally leaves them to the owning deployment organization.

The CI drill measures logical recovery time but does not declare an RTO or RPO.
Logical dumps are portable recovery evidence; high-reliability managed shapes
still need the owning platform's tested physical backup/PITR path and matching
artifact-store recovery.
