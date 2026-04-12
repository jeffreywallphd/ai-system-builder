import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  SecretKinds,
  SecretScopes,
  archiveSecretRecord,
  softDeleteSecretRecord,
  disableSecretRecord,
  rotateSecretRecord,
  createSecretRecord,
} from "@domain/security/SecretDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteSecretRecordPersistenceAdapter } from "../SqliteSecretRecordPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function createServerSecretRecord(): ReturnType<typeof createSecretRecord> {
  return createSecretRecord({
    secretId: "secret:server:openai",
    name: "llm.openai.api_key",
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.apiKey,
    metadata: {
      displayName: "OpenAI API Key",
      description: "Primary OpenAI production key.",
      tags: ["openai", "production", "sensitivity:restricted"],
      labels: {
        service: "openai",
        environment: "prod",
      },
    },
    createdBy: "user:admin",
    createdAt: "2026-04-05T12:00:00.000Z",
    initialVersion: {
      versionId: "secret:server:openai:v1",
      createdBy: "user:admin",
      encryptedPayloadRef: "enc:secret:server:openai:v1",
      payloadDigestSha256: "sha256:openai:v1",
      payloadByteLength: 12,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });
}

describe("SqliteSecretRecordPersistenceAdapter", () => {
  it("applies migrations and creates secret persistence tables", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-secret-schema-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "secrets.sqlite");

    const adapter = new SqliteSecretRecordPersistenceAdapter(databasePath);
    await adapter.createSecret({
      record: createServerSecretRecord(),
      mutation: {
        operationKey: "op:secret:create:schema",
        actorId: "user:admin",
        occurredAt: "2026-04-05T12:00:00.000Z",
      },
    });
    adapter.dispose();

    const database = openSqliteCompatDatabase(databasePath);
    const versionRow = database.prepare("SELECT MAX(version) AS version FROM secret_record_repository_migrations")
      .get() as { version?: number };
    expect(versionRow.version).toBe(3);

    const tables = database.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'secret_records',
          'secret_versions',
          'secret_version_material',
          'secret_record_mutation_replays',
          'secret_reencryption_operations'
        )
      ORDER BY name ASC
    `).all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual([
      "secret_record_mutation_replays",
      "secret_reencryption_operations",
      "secret_records",
      "secret_version_material",
      "secret_versions",
    ]);

    database.close();
  });

  it("supports create, fetch, list, rotate-version activation, disable, and soft-delete flows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-secret-roundtrip-"));
    createdRoots.push(root);
    const adapter = new SqliteSecretRecordPersistenceAdapter(path.join(root, "secrets.sqlite"));

    const createdRecord = createServerSecretRecord();
    const created = await adapter.createSecret({
      record: createdRecord,
      mutation: {
        operationKey: "op:secret:create:1",
        actorId: "user:admin",
        occurredAt: "2026-04-05T12:00:00.000Z",
      },
    });
    expect(created.changed).toBeTrue();
    expect(created.record.secretId).toBe("secret:server:openai");

    const replayCreate = await adapter.createSecret({
      record: createdRecord,
      mutation: {
        operationKey: "op:secret:create:1",
        actorId: "user:admin",
        occurredAt: "2026-04-05T12:00:00.000Z",
      },
    });
    expect(replayCreate.wasReplay).toBeTrue();

    const fetched = await adapter.findSecretById("secret:server:openai");
    expect(fetched?.reference.name).toBe("llm.openai.api_key");
    expect(fetched?.versions).toHaveLength(1);

    const byNameAndScope = await adapter.findSecretByNameAndScope({
      name: "LLM.OPENAI.API_KEY",
      owner: { scope: SecretScopes.server },
    });
    expect(byNameAndScope?.secretId).toBe("secret:server:openai");

    const rotatedRecord = rotateSecretRecord({
      record: createdRecord,
      rotatedBy: "user:rotation-admin",
      rotatedAt: "2026-04-06T00:00:00.000Z",
      nextVersion: {
        versionId: "secret:server:openai:v2",
        createdBy: "user:rotation-admin",
        encryptedPayloadRef: "enc:secret:server:openai:v2",
        payloadDigestSha256: "sha256:openai:v2",
        payloadByteLength: 16,
        keyEncryptionContext: {
          keyId: "kek:server:default",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.server,
        },
      },
    });

    const saved = await adapter.saveSecret(rotatedRecord, {
      operationKey: "op:secret:rotate:1",
      actorId: "user:rotation-admin",
      occurredAt: "2026-04-06T00:00:00.000Z",
    });
    expect(saved.changed).toBeTrue();
    expect(saved.record.currentVersionId).toBe("secret:server:openai:v2");

    const fetchedAfterRotate = await adapter.findSecretById("secret:server:openai");
    expect(fetchedAfterRotate?.versions).toHaveLength(2);
    expect(fetchedAfterRotate?.currentVersionId).toBe("secret:server:openai:v2");
    expect(fetchedAfterRotate?.versions[0]?.state).toBe("superseded");
    expect(fetchedAfterRotate?.versions[1]?.state).toBe("active");
    if (!fetchedAfterRotate) {
      throw new Error("Expected rotated secret to be persisted.");
    }

    const conditionalRotateRecord = rotateSecretRecord({
      record: fetchedAfterRotate,
      rotatedBy: "user:rotation-admin",
      rotatedAt: "2026-04-06T00:05:00.000Z",
      nextVersion: {
        versionId: "secret:server:openai:v3",
        createdBy: "user:rotation-admin",
        encryptedPayloadRef: "enc:secret:server:openai:v3",
        payloadDigestSha256: "sha256:openai:v3",
        payloadByteLength: 18,
        keyEncryptionContext: {
          keyId: "kek:server:default",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.server,
        },
      },
    });

    const staleConditionalSave = await adapter.saveSecretWhenCurrentVersionMatches?.(
      conditionalRotateRecord,
      {
        operationKey: "op:secret:rotate:stale-conditional",
        actorId: "user:rotation-admin",
        occurredAt: "2026-04-06T00:05:00.000Z",
      },
      "secret:server:openai:v1",
    );
    expect(staleConditionalSave?.conditionMatched).toBeFalse();
    const unchangedAfterStaleConditional = await adapter.findSecretById("secret:server:openai");
    expect(unchangedAfterStaleConditional?.currentVersionId).toBe("secret:server:openai:v2");
    expect(unchangedAfterStaleConditional?.versions).toHaveLength(2);

    const successfulConditionalSave = await adapter.saveSecretWhenCurrentVersionMatches?.(
      conditionalRotateRecord,
      {
        operationKey: "op:secret:rotate:successful-conditional",
        actorId: "user:rotation-admin",
        occurredAt: "2026-04-06T00:05:00.000Z",
      },
      "secret:server:openai:v2",
    );
    expect(successfulConditionalSave?.conditionMatched).toBeTrue();
    expect(successfulConditionalSave?.record.currentVersionId).toBe("secret:server:openai:v3");

    const fetchedAfterConditionalRotate = await adapter.findSecretById("secret:server:openai");
    expect(fetchedAfterConditionalRotate?.currentVersionId).toBe("secret:server:openai:v3");
    expect(fetchedAfterConditionalRotate?.versions).toHaveLength(3);
    if (!fetchedAfterConditionalRotate) {
      throw new Error("Expected conditionally rotated secret to be persisted.");
    }

    const listedActive = await adapter.listSecrets({
      scope: SecretScopes.server,
      tagAnyOf: ["openai"],
    });
    expect(listedActive).toHaveLength(1);

    const disabledRecord = disableSecretRecord({
      record: fetchedAfterConditionalRotate,
      disabledBy: "user:security-admin",
      disabledAt: "2026-04-06T01:00:00.000Z",
    });
    await adapter.saveSecret(disabledRecord, {
      operationKey: "op:secret:disable:1",
      actorId: "user:security-admin",
      occurredAt: "2026-04-06T01:00:00.000Z",
    });

    const listedWithoutDisabled = await adapter.listSecrets({
      scope: SecretScopes.server,
      includeDisabled: false,
    });
    const listedWithDisabled = await adapter.listSecrets({
      scope: SecretScopes.server,
      includeDisabled: true,
    });
    expect(listedWithoutDisabled).toHaveLength(0);
    expect(listedWithDisabled).toHaveLength(1);
    expect(listedWithDisabled[0]?.state).toBe("disabled");

    const archivedRecord = archiveSecretRecord({
      record: fetchedAfterConditionalRotate,
      archivedBy: "user:security-admin",
      archivedAt: "2026-04-06T01:30:00.000Z",
    });
    await adapter.saveSecret(archivedRecord, {
      operationKey: "op:secret:archive:1",
      actorId: "user:security-admin",
      occurredAt: "2026-04-06T01:30:00.000Z",
    });
    const listedWithoutArchived = await adapter.listSecrets({
      scope: SecretScopes.server,
      includeDisabled: true,
    });
    const listedWithArchived = await adapter.listSecrets({
      scope: SecretScopes.server,
      includeDisabled: true,
      includeArchived: true,
    });
    expect(listedWithoutArchived).toHaveLength(0);
    expect(listedWithArchived).toHaveLength(1);
    expect(listedWithArchived[0]?.state).toBe("archived");

    const softDeleted = await adapter.deleteSecret("secret:server:openai", {
      operationKey: "op:secret:delete:1",
      actorId: "user:security-admin",
      occurredAt: "2026-04-06T02:00:00.000Z",
    });
    expect(softDeleted).toEqual({
      changed: true,
      wasReplay: false,
    });

    const replayDelete = await adapter.deleteSecret("secret:server:openai", {
      operationKey: "op:secret:delete:1",
      actorId: "user:security-admin",
      occurredAt: "2026-04-06T02:00:00.000Z",
    });
    expect(replayDelete).toEqual({
      changed: false,
      wasReplay: true,
    });

    const fetchedAfterDelete = await adapter.findSecretById("secret:server:openai");
    expect(fetchedAfterDelete?.state).toBe("soft-deleted");
    expect(fetchedAfterDelete?.softDeletedBy).toBe("user:security-admin");

    const listedWithoutDeleted = await adapter.listSecrets({
      scope: SecretScopes.server,
      includeDisabled: true,
      includeSoftDeleted: false,
    });
    const listedWithDeleted = await adapter.listSecrets({
      scope: SecretScopes.server,
      includeDisabled: true,
      includeSoftDeleted: true,
    });
    expect(listedWithoutDeleted).toHaveLength(0);
    expect(listedWithDeleted).toHaveLength(1);

    const explicitlyDeletedRecord = softDeleteSecretRecord({
      record: disabledRecord,
      softDeletedBy: "user:security-admin",
      softDeletedAt: "2026-04-06T02:05:00.000Z",
    });
    await adapter.saveSecret(explicitlyDeletedRecord, {
      operationKey: "op:secret:save-deleted:1",
      actorId: "user:security-admin",
      occurredAt: "2026-04-06T02:05:00.000Z",
    });
    const afterExplicitDeletedSave = await adapter.findSecretById("secret:server:openai");
    expect(afterExplicitDeletedSave?.softDeletedAt).toBe("2026-04-06T02:05:00.000Z");

    adapter.dispose();
  });

  it("persists and updates secret re-encryption operation state with optimistic concurrency", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-src-secret-reencrypt-op-"));
    createdRoots.push(root);
    const adapter = new SqliteSecretRecordPersistenceAdapter(path.join(root, "secrets.sqlite"));

    const created = await adapter.createReEncryptionOperation({
      operationId: "secret-reencrypt:op-1",
      operationKey: "op:secret:reencrypt:1",
      state: "running",
      targets: Object.freeze([Object.freeze({
        secretId: "secret:server:openai",
        versionId: "secret:server:openai:v1",
      })]),
      currentIndex: 0,
      succeededCount: 0,
      failedCount: 0,
      failures: Object.freeze([]),
      startedBy: "user:admin",
      startedAt: "2026-04-06T03:00:00.000Z",
      updatedAt: "2026-04-06T03:00:00.000Z",
      completedAt: undefined,
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
    });
    expect(created.revision).toBe(1);

    const saved = await adapter.saveReEncryptionOperation({
      ...created,
      currentIndex: 1,
      succeededCount: 1,
      state: "succeeded",
      updatedAt: "2026-04-06T03:01:00.000Z",
      completedAt: "2026-04-06T03:01:00.000Z",
    }, 1);
    expect(saved.updated).toBeTrue();
    expect(saved.record.revision).toBe(2);
    expect(saved.record.state).toBe("succeeded");
    expect(saved.record.currentIndex).toBe(1);

    const stale = await adapter.saveReEncryptionOperation({
      ...saved.record,
      state: "failed",
      updatedAt: "2026-04-06T03:02:00.000Z",
    }, 1);
    expect(stale.updated).toBeFalse();
    expect(stale.record.state).toBe("succeeded");

    const found = await adapter.findReEncryptionOperationByOperationKey("op:secret:reencrypt:1");
    expect(found?.operationId).toBe("secret-reencrypt:op-1");
    expect(await adapter.findLatestRunningReEncryptionOperation()).toBeUndefined();
    adapter.dispose();
  });
});

