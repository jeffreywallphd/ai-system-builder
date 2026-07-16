import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { QueryResult } from "pg";

import {
  resolvePostgresPoolConfig,
  type PostgresPoolLike,
  type PostgresQueryable,
} from "../client/createPostgresPool";
import {
  migratePostgresDatabase,
  openPostgresDatabase,
  POSTGRES_MIGRATION_0001,
  POSTGRES_MIGRATION_LOCK_KEY,
  createPostgresStructuredDocumentStore,
} from "../postgres-database";

test("PostgreSQL config is fail-closed and TLS-verifying by default", () => {
  assert.throws(() => resolvePostgresPoolConfig({}), /DATABASE_URL is required/);
  const config = resolvePostgresPoolConfig({ DATABASE_URL: "postgresql://user:secret@db.example/app" });
  assert.equal(config.sslMode, "verify-full");
  assert.equal(config.maxConnections, 10);
  assert.equal(JSON.stringify({ sslMode: config.sslMode, max: config.maxConnections }).includes("secret"), false);
});

test("PostgreSQL config validates bounded pool and TLS inputs", () => {
  assert.throws(
    () => resolvePostgresPoolConfig({ DATABASE_URL: "postgresql://db/app", POSTGRES_POOL_MAX: "0" }),
    /POSTGRES_POOL_MAX/,
  );
  assert.throws(
    () => resolvePostgresPoolConfig({ DATABASE_URL: "postgresql://db/app", POSTGRES_SSL_MODE: "prefer" }),
    /POSTGRES_SSL_MODE/,
  );
  assert.equal(resolvePostgresPoolConfig({ DATABASE_URL: "postgresql://db/app", POSTGRES_SSL_MODE: "disable" }).sslMode, "disable");
});

test("migration uses one transaction and an advisory transaction lock", async () => {
  const queries: { text: string; values?: readonly unknown[] }[] = [];
  const client: PostgresQueryable = {
    async query(text, values) {
      queries.push({ text, values });
      const rows = text.includes("MAX(version)") ? [{ version: 0 }] : [];
      return queryResult(rows);
    },
  };
  await migratePostgresDatabase(client, () => "2026-07-16T12:00:00.000Z");
  assert.equal(queries[0]?.text, "BEGIN");
  assert.deepEqual(queries[1]?.values, [POSTGRES_MIGRATION_LOCK_KEY]);
  assert.ok(queries.some((query) => query.text.includes("CREATE TABLE IF NOT EXISTS structured_documents")));
  assert.equal(queries[queries.length - 1]?.text, "COMMIT");
});

test("checked-in PostgreSQL migration matches the runtime migration", async () => {
  const checkedIn = await readFile(path.resolve("migrations", "postgres", "0001-create-structured-document-store.sql"), "utf8");
  assert.equal(normalizeSql(checkedIn), normalizeSql(POSTGRES_MIGRATION_0001));
});

test("startup failure releases the checked-out client before draining the pool", async () => {
  const lifecycle: string[] = [];
  const client = {
    async query(text: string) {
      if (text.includes("MAX(version)")) return queryResult([{ version: 1 }]);
      if (text.includes("SELECT 1 AS healthy")) throw new Error("connection lost: postgresql://secret");
      return queryResult([]);
    },
    release() { lifecycle.push("release"); },
  };
  const pool = {
    totalCount: 1,
    idleCount: 0,
    waitingCount: 0,
    async connect() { return client; },
    async query() { return queryResult([]); },
    async end() { lifecycle.push("end"); },
  } as unknown as PostgresPoolLike;

  await assert.rejects(
    () => openPostgresDatabase({
      config: resolvePostgresPoolConfig({ DATABASE_URL: "postgresql://user:secret@db.example/app" }),
      pool,
    }),
    (error: unknown) => error instanceof Error && error.message === "PostgreSQL startup validation failed.",
  );
  assert.deepEqual(lifecycle, ["release", "end"]);
});

test("idle pool errors are consumed and surfaced only as sanitized health counters", async () => {
  let idleErrorListener: ((error: Error) => void) | undefined;
  const client = {
    async query(text: string) {
      if (text.includes("MAX(version)")) return queryResult([{ version: 1 }]);
      return queryResult([]);
    },
    release() {},
  };
  const pool = {
    totalCount: 2,
    idleCount: 2,
    waitingCount: 0,
    on(event: string, listener: (error: Error) => void) {
      if (event === "error") idleErrorListener = listener;
    },
    async connect() { return client; },
    async query() { return queryResult([{ schema_version: 1 }]); },
    async end() {},
  } as unknown as PostgresPoolLike;
  const database = await openPostgresDatabase({
    config: resolvePostgresPoolConfig({ DATABASE_URL: "postgresql://db.example/app" }),
    pool,
    now: () => "2026-07-16T14:00:00.000Z",
  });
  idleErrorListener?.(new Error("postgresql://user:secret@db.example/app"));
  const health = await database.checkHealth();
  assert.equal(health.pool.idleClientErrorCount, 1);
  assert.equal(health.pool.lastIdleClientErrorAt, "2026-07-16T14:00:00.000Z");
  assert.equal(JSON.stringify(health).includes("secret"), false);
  await database.close();
});

test("serializable transactions retry the complete callback after serialization failure", async () => {
  let attempts = 0;
  const lifecycle: string[] = [];
  const client = {
    async query(text: string) {
      lifecycle.push(text);
      return queryResult([]);
    },
    release() { lifecycle.push("release"); },
  };
  const pool = {
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
    async connect() { return client; },
    async query() { return queryResult([]); },
    async end() {},
  } as unknown as PostgresPoolLike;

  const store = createPostgresStructuredDocumentStore(pool);
  const value = await store.runInTransaction(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error("retry"), { code: "40001" });
    return "committed";
  });

  assert.equal(value, "committed");
  assert.equal(attempts, 2);
  assert.equal(lifecycle.filter((entry) => entry === "BEGIN ISOLATION LEVEL SERIALIZABLE").length, 2);
  assert.equal(lifecycle.filter((entry) => entry === "ROLLBACK").length, 1);
  assert.equal(lifecycle.filter((entry) => entry === "COMMIT").length, 1);
  assert.equal(lifecycle.filter((entry) => entry === "release").length, 2);
});

function queryResult<T extends Record<string, unknown>>(rows: T[]): QueryResult<T> {
  return { command: "TEST", rowCount: rows.length, oid: 0, fields: [], rows };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}
