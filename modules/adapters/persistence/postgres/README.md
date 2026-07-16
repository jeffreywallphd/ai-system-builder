> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

# PostgreSQL Persistence

PostgreSQL is the structured persistence target for campus, corporate, and cloud
server deployment shapes. This family owns the bounded `pg` pool, TLS and timeout
configuration, startup validation, advisory-locked migrations, transactional
JSONB document implementation, optimistic revisions, repeatable-read portable
export, sanitized health/readiness data, and graceful drain behind existing
application ports.

The pool installs an idle-client error listener so an EventEmitter `error` does
not become an unhandled process failure. Only a counter and timestamp enter
health; raw driver error content remains private.

Explicit managed deployment shapes select this adapter before API registration
and run the rollback-preserving legacy import. A selected PostgreSQL target never
falls back to JSON. The optional live integration test requires
`TEST_POSTGRES_URL`; it is part of environment qualification.
Connection strings, credentials, SQL, pools, transactions, and driver errors must
remain within composition and adapter boundaries.
