> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

# Database Migrations

This directory is reserved for reviewed, monotonic database schema migrations.
SQLite and PostgreSQL migrations may be engine-specific while implementing the
same repository-level record semantics. Each database adapter must maintain a
migration ledger, reject schemas newer than the running binary, and acquire an
engine-appropriate exclusive migration lock before repository activation.

SQLite and PostgreSQL migration `0001` files establish their migration ledgers
and constrained structured-document compatibility schemas behind typed
repository adapters. Their runtime mirrors are drift-tested. The separate JSON
import workflow inventories an allowlist, preserves a rollback copy, imports in
one transaction, reconciles records, and writes a cutover marker; schema migration
scripts never silently consume or delete JSON data.
