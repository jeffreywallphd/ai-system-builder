import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { EncryptionPolicyEvaluationService } from "../../../../application/security/use-cases/EncryptionPolicyEvaluationService";
import { EncryptionKeyResolutionService } from "../../../../application/security/use-cases/EncryptionKeyResolutionService";
import type { IEncryptionAtRestPolicyContextResolverPort } from "../../../../application/security/ports/EncryptionAtRestPolicyEvaluationPorts";
import {
  SecretKinds,
  SecretScopes,
  createSecretRecord,
} from "../../../../domain/security/SecretDomain";
import {
  createEncryptionAtRestPolicyDefinition,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "../../../../domain/security/EncryptionAtRestPolicyDomain";
import { openSqliteCompatDatabase } from "../../sqlite/SqliteCompat";
import { SqliteSecretRecordPersistenceAdapter } from "../SqliteSecretRecordPersistenceAdapter";
import { ProtectedSecretRecordPersistenceRepository } from "../ProtectedSecretRecordPersistenceRepository";
import { StaticEncryptionKeyCatalogPort } from "../../../security/encryption/StaticEncryptionKeyCatalogPort";
import { StaticEncryptionKeyMaterialPort } from "../../../security/encryption/StaticEncryptionKeyMaterialPort";
import { VersionedAesGcmProtectedValueEncryptionPort } from "../../../security/encryption/VersionedAesGcmProtectedValueEncryptionPort";
import { EncryptionKeyLifecycleStates } from "../../../../application/security/ports/EncryptionKeyResolutionPorts";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("ProtectedSecretRecordPersistenceRepository", () => {
  it("encrypts persisted secret description metadata while preserving repository read behavior", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-protected-secret-metadata-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "secrets.sqlite");

    const sqliteAdapter = new SqliteSecretRecordPersistenceAdapter(databasePath);
    const protectedRepository = createProtectedRepository(sqliteAdapter);
    const record = createSecretRecord({
      secretId: "secret:server:provider:openai",
      name: "provider.openai.api-key",
      owner: Object.freeze({
        scope: SecretScopes.server,
      }),
      kind: SecretKinds.apiKey,
      metadata: Object.freeze({
        displayName: "OpenAI API Key",
        description: "Top secret provider credential metadata",
        tags: Object.freeze(["provider"]),
        labels: Object.freeze({
          service: "openai",
        }),
      }),
      createdBy: "user:admin",
      initialVersion: Object.freeze({
        versionId: "secret:server:provider:openai:v1",
        createdBy: "user:admin",
        encryptedPayloadRef: "secret-envelope:v1",
        payloadDigestSha256: "sha256:test",
        payloadByteLength: 4,
        keyEncryptionContext: Object.freeze({
          keyId: "kek:server:default",
          algorithm: "aes-256-gcm",
          scope: SecretScopes.server,
        }),
      }),
    });

    await protectedRepository.createSecret({
      record,
      mutation: Object.freeze({
        operationKey: "op:secret:create:protected-metadata",
        actorId: "user:admin",
      }),
    });

    const persisted = openSqliteCompatDatabase(databasePath);
    const row = persisted.prepare("SELECT metadata_description FROM secret_records WHERE secret_id = ?")
      .get(record.secretId) as { metadata_description?: string } | undefined;
    persisted.close();

    expect(row?.metadata_description).toBeTruthy();
    expect(row?.metadata_description).not.toContain("Top secret provider credential metadata");
    expect(row?.metadata_description?.startsWith("protected-value:v1:")).toBeTrue();

    const hydrated = await protectedRepository.findSecretById(record.secretId);
    expect(hydrated?.reference.metadata.description).toBe("Top secret provider credential metadata");

    const listed = await protectedRepository.listSecrets({
      scope: SecretScopes.server,
    });
    expect(listed[0]?.metadata.description).toBe("Top secret provider credential metadata");

    sqliteAdapter.dispose();
  });
});

function createProtectedRepository(
  sqliteAdapter: SqliteSecretRecordPersistenceAdapter,
): ProtectedSecretRecordPersistenceRepository {
  const keyReferenceId = "keyref:server:default";
  const keyId = "kek:server:default";
  const policyResolver: IEncryptionAtRestPolicyContextResolverPort = {
    resolvePolicyContext: async () => Object.freeze({
      platformPolicy: createEncryptionAtRestPolicyDefinition({
        policyId: "policy:platform:protected-secret-repository",
        scope: EncryptionPolicyScopes.platform,
        rules: Object.freeze([
          Object.freeze({
            dataClass: ProtectedDataClasses.secretMaterial,
            encryptionMode: EncryptionModes.scopedContent,
            keyScope: EncryptionKeyScopes.server,
          }),
          Object.freeze({
            dataClass: ProtectedDataClasses.secretMetadata,
            encryptionMode: EncryptionModes.metadataOnly,
            keyScope: EncryptionKeyScopes.server,
          }),
          Object.freeze({
            dataClass: ProtectedDataClasses.sensitiveMetadata,
            encryptionMode: EncryptionModes.metadataOnly,
            keyScope: EncryptionKeyScopes.server,
          }),
        ]),
      }),
      workspacePolicy: undefined,
      storageInstancePolicy: undefined,
    }),
  };

  const policyEvaluationService = new EncryptionPolicyEvaluationService({
    encryptionAtRestPolicyContextResolverPort: policyResolver,
  });
  const keyResolutionService = new EncryptionKeyResolutionService({
    encryptionPolicyEvaluationService: policyEvaluationService,
    encryptionKeyCatalogPort: new StaticEncryptionKeyCatalogPort({
      keys: [Object.freeze({
        keyReferenceId,
        keyId,
        algorithm: "aes-256-gcm",
        scopeOwner: Object.freeze({
          scope: EncryptionKeyScopes.server,
        }),
        lifecycleState: EncryptionKeyLifecycleStates.active,
        activatedAt: "2026-01-01T00:00:00.000Z",
      })],
    }),
  });
  const protectedValuePort = new VersionedAesGcmProtectedValueEncryptionPort({
    encryptionKeyMaterialPort: new StaticEncryptionKeyMaterialPort({
      keyMaterials: [Object.freeze({
        keyReferenceId,
        algorithm: "aes-256-gcm",
        encodedKey: Buffer.alloc(32, 9).toString("base64"),
      })],
    }),
  });

  return new ProtectedSecretRecordPersistenceRepository(
    sqliteAdapter,
    keyResolutionService,
    protectedValuePort,
  );
}
