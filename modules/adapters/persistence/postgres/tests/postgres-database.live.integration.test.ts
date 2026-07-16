import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  StructuredDocumentConflictError,
  mutateDocumentRecord,
} from "../../shared";
import { resolvePostgresPoolConfig } from "../client/createPostgresPool";
import { openPostgresDatabase } from "../postgres-database";

const liveDatabaseUrl = process.env.TEST_POSTGRES_URL?.trim();

test(
  "live PostgreSQL migration, transaction, health, and revision conformance",
  { skip: !liveDatabaseUrl },
  async () => {
    const config = resolvePostgresPoolConfig({
      DATABASE_URL: liveDatabaseUrl,
      POSTGRES_SSL_MODE: process.env.TEST_POSTGRES_SSL_MODE ?? "disable",
      POSTGRES_APPLICATION_NAME: "ai-system-builder-integration-test",
    });
    const databases = await Promise.all(
      Array.from({ length: 4 }, () => openPostgresDatabase({ config })),
    );
    const [database] = databases;
    const namespace = `integration-${randomUUID()}`;
    try {
      const first = await database.documents.writeDocument(
        namespace,
        "record",
        { value: 1 },
      );
      const second = await database.documents.writeDocument(
        namespace,
        "record",
        { value: 2 },
        { expectedRevision: first.revision },
      );
      await assert.rejects(
        () =>
          database.documents.writeDocument(
            namespace,
            "record",
            { value: 3 },
            { expectedRevision: first.revision },
          ),
        StructuredDocumentConflictError,
      );
      assert.equal(second.value.value, 2);
      await assert.rejects(
        () =>
          database.documents.runInTransaction(async (transaction) => {
            await transaction.writeDocument(namespace, "rolled-back", {
              value: "temporary",
            });
            throw new Error("expected rollback");
          }),
        /expected rollback/,
      );
      assert.equal(
        await database.documents.readDocument(namespace, "rolled-back"),
        undefined,
      );
      assert.deepEqual(
        await databases[1].documents.readDocument(namespace, "record"),
        second,
      );
      assert.equal(
        await databases[2].documents.readDocument(
          `${namespace}-other`,
          "record",
        ),
        undefined,
      );
      await Promise.all(
        Array.from({ length: 24 }, (_, index) =>
          mutateDocumentRecord(
            {
              rootDirectory: ".",
              documents: databases[index % databases.length].documents,
            },
            `${namespace}/counter.json`,
            { count: 0, writers: [] as number[] },
            (current) => ({
              value: {
                count: current.count + 1,
                writers: [...current.writers, index],
              },
              result: undefined,
            }),
          ),
        ),
      );
      const counter = await database.documents.readDocument<{
        count: number;
        writers: number[];
      }>(namespace, "counter.json");
      assert.equal(counter?.value.count, 24);
      assert.equal(new Set(counter?.value.writers).size, 24);
      assert.equal((await database.checkHealth()).healthy, true);
    } finally {
      await database.documents.deleteDocument(namespace, "record");
      await database.documents.deleteDocument(namespace, "counter.json");
      await Promise.all(databases.map((opened) => opened.close()));
    }
  },
);
