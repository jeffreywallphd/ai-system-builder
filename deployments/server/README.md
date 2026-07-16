# Managed Server Deployment Templates

> AI documentation reminder: when behavior in this area changes, update the related ADRs, architecture docs, context packs, and README files in the same change.

These templates package the server host for the `campus-server`,
`corporate-server`, and `cloud` deployment shapes. They preserve the architecture
boundary: PostgreSQL stores structured records, `SERVER_STORAGE_ROOT` stores
artifact bytes on a durable mounted service, and `SERVER_RUNTIME_ROOT` stores
replaceable runtime installations and caches.

## Files

- `Dockerfile` builds the server with Node.js 24 LTS and runs as an unprivileged
  user.
- `compose.qualification.yaml` is an isolated PostgreSQL 18 qualification stack.
  It disables database TLS only on the private Compose network and is not a
  production manifest.
- `kubernetes-deployment.example.yaml` is a production-oriented starting point
  with secret references, TLS mounts, a durable artifact volume, ephemeral
  runtime storage, graceful termination, and distinct liveness/readiness probes.
- `config/environments/server/*.env.example` are shape-specific environment
  profiles. They intentionally omit secret values.

## Required operator choices

Before deployment, pin the built image by immutable digest, provision PostgreSQL
and artifact storage, inject `DATABASE_URL`, `SERVER_TOKEN_HASH_SECRET`, the
PostgreSQL CA, and TLS material through the platform secret boundary, and replace
the Kubernetes storage claims with qualified services. The current filesystem
artifact adapter requires a durable mounted path; an object-storage adapter is a
separate future increment.

The repository does not choose organization tenancy, retention, RPO, RTO, high
availability, or backup schedules. Operators must obtain those approved values
and apply the procedures in `docs/operations/persistence-operations.md` before a
shape can be declared production-qualified.
