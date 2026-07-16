import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { StructuredDocumentConflictError } from "../../shared";
import { resolvePostgresPoolConfig } from "../client/createPostgresPool";
import { openPostgresDatabase } from "../postgres-database";

const liveDatabaseUrl = process.env.TEST_POSTGRES_URL?.trim();

test("live PostgreSQL migration, transaction, health, and revision conformance", { skip: !liveDatabaseUrl }, async () => {
  const database = await openPostgresDatabase({
    config: resolvePostgresPoolConfig({
      DATABASE_URL: liveDatabaseUrl,
      POSTGRES_SSL_MODE: process.env.TEST_POSTGRES_SSL_MODE ?? "disable",
      POSTGRES_APPLICATION_NAME: "ai-system-builder-integration-test",
    }),
  });
  const namespace = `integration-${randomUUID()}`;
  try {
    const first = await database.documents.writeDocument(namespace, "record", { value: 1 });
    const second = await database.documents.writeDocument(namespace, "record", { value: 2 }, { expectedRevision: first.revision });
    await assert.rejects(
      () => database.documents.writeDocument(namespace, "record", { value: 3 }, { expectedRevision: first.revision }),
      StructuredDocumentConflictError,
    );
    assert.equal(second.value.value, 2);
    assert.equal((await database.checkHealth()).healthy, true);
  } finally {
    await database.documents.deleteDocument(namespace, "record");
    await database.close();
  }
});
