import { describe, expect, it } from "bun:test";
import {
  SecretAccessActions,
  SecretActorTypes,
  SecretKinds,
  SecretScopes,
  createSecretRecord,
  evaluateSecretAccessDecision,
  rotateSecretRecord,
  type SecretAccessActor,
  type SecretRecord,
} from "../../../domain/security/SecretDomain";
import type {
  ISecretAccessAuditPort,
  ISecretAccessPolicyPort,
  ISecretEncryptionPort,
  ISecretRecordPersistenceRepository,
  SecretAccessAuditEvent,
  SecretConditionalSaveResult,
  SecretCreatePersistenceInput,
  SecretListQuery,
  SecretMutationResult,
} from "../ports/SecretServicePorts";
import { RetrieveSecretPlaintextForRuntimeUseCase } from "../use-cases/RetrieveSecretPlaintextForRuntimeUseCase";
import { RotateSecretUseCase } from "../use-cases/RotateSecretUseCase";
import { SecretServiceErrorCodes } from "../use-cases/SecretManagementServiceContracts";

class InMemorySecretRecordRepository implements ISecretRecordPersistenceRepository {
  private readonly records = new Map<string, SecretRecord>();
  public beforeConditionalCheck?: () => void;
  public throwOnConditionalSave = false;

  public seed(record: SecretRecord): void {
    this.records.set(record.secretId, record);
  }

  public async findSecretById(secretId: string): Promise<SecretRecord | undefined> {
    return this.records.get(secretId.trim());
  }

  public async findSecretByNameAndScope(_input: {
    readonly name: string;
    readonly owner: SecretRecord["owner"];
  }): Promise<SecretRecord | undefined> {
    return undefined;
  }

  public async listSecrets(_query: SecretListQuery): Promise<readonly SecretRecord["reference"][]> {
    return [];
  }

  public async createSecret(
    input: SecretCreatePersistenceInput,
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    this.records.set(input.record.secretId, input.record);
    return {
      changed: true,
      wasReplay: false,
      record: input.record,
    };
  }

  public async saveSecret(
    record: SecretRecord,
    _mutation: SecretCreatePersistenceInput["mutation"],
  ): Promise<SecretMutationResult & { readonly record: SecretRecord }> {
    const prior = this.records.get(record.secretId);
    this.records.set(record.secretId, record);
    return {
      changed: JSON.stringify(prior) !== JSON.stringify(record),
      wasReplay: false,
      record,
    };
  }

  public async saveSecretWhenCurrentVersionMatches(
    record: SecretRecord,
    _mutation: SecretCreatePersistenceInput["mutation"],
    expectedCurrentVersionId: string | undefined,
  ): Promise<SecretConditionalSaveResult> {
    if (this.throwOnConditionalSave) {
      throw new Error("simulated persistence fault");
    }

    this.beforeConditionalCheck?.();
    this.beforeConditionalCheck = undefined;

    const existing = this.records.get(record.secretId);
    if (!existing) {
      throw new Error("secret not found");
    }

    if ((existing.currentVersionId ?? undefined) !== (expectedCurrentVersionId ?? undefined)) {
      return {
        changed: false,
        wasReplay: false,
        conditionMatched: false,
        record: existing,
      };
    }

    this.records.set(record.secretId, record);
    return {
      changed: JSON.stringify(existing) !== JSON.stringify(record),
      wasReplay: false,
      conditionMatched: true,
      record,
    };
  }

  public async deleteSecret(_secretId: string, _mutation: SecretCreatePersistenceInput["mutation"]): Promise<SecretMutationResult> {
    return {
      changed: false,
      wasReplay: false,
    };
  }
}

class InMemorySecretEncryptionPort implements ISecretEncryptionPort {
  private readonly plaintextByPayloadRef = new Map<string, string>();
  private sequence = 0;

  public seedPayload(payloadRef: string, plaintext: string): void {
    this.plaintextByPayloadRef.set(payloadRef, plaintext);
  }

  public async encryptSecretPlaintext(input: {
    readonly secretId: string;
    readonly owner: SecretRecord["owner"];
    readonly plaintext: string;
    readonly existingContext?: SecretRecord["versions"][number]["keyEncryptionContext"];
  }) {
    this.sequence += 1;
    const encryptedPayloadRef = `enc:${input.secretId}:${this.sequence}`;
    this.plaintextByPayloadRef.set(encryptedPayloadRef, input.plaintext);
    return {
      encryptedPayloadRef,
      payloadDigestSha256: `sha256:${input.secretId}:${this.sequence}:${input.plaintext.length}`,
      payloadByteLength: input.plaintext.length,
      keyEncryptionContext: input.existingContext ?? {
        keyId: `kek:${input.owner.scope}:default`,
        algorithm: "aes-256-gcm",
        scope: input.owner.scope,
        workspaceId: input.owner.workspaceId,
        userIdentityId: input.owner.userIdentityId,
      },
    };
  }

  public async decryptSecretPlaintext(input: {
    readonly version: SecretRecord["versions"][number];
  }): Promise<{ readonly plaintext: string }> {
    const plaintext = this.plaintextByPayloadRef.get(input.version.encryptedPayloadRef);
    if (plaintext === undefined) {
      throw new Error("missing plaintext payload");
    }
    return { plaintext };
  }
}

class DomainBackedSecretAccessPolicyPort implements ISecretAccessPolicyPort {
  public async evaluateSecretAccess(input: Parameters<ISecretAccessPolicyPort["evaluateSecretAccess"]>[0]) {
    return evaluateSecretAccessDecision(input);
  }
}

class InMemorySecretAccessAuditPort implements ISecretAccessAuditPort {
  public readonly events: SecretAccessAuditEvent[] = [];

  public async recordSecretAuditEvent(event: SecretAccessAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("RotateSecretUseCase", () => {
  it("creates the first version when rotating a record that has no active version yet", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const rotateUseCase = new RotateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const legacyRecord = createLegacySecretRecordWithoutVersions();
    repository.seed(legacyRecord);

    const result = await rotateUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.rotate]),
      operationKey: "op:rotate:legacy-first-version",
      secretId: legacyRecord.secretId,
      plaintext: "legacy-secret-material",
      rotatedAt: "2026-04-06T10:00:00.000Z",
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.value.currentVersionId).toBe(`${legacyRecord.secretId}:v1`);

    const persisted = await repository.findSecretById(legacyRecord.secretId);
    expect(persisted?.versions).toHaveLength(1);
    expect(persisted?.versions[0]?.version).toBe(1);
    expect(persisted?.versions[0]?.state).toBe("active");
    expect(persisted?.versions[0]?.previousVersionId).toBeUndefined();
  });

  it("keeps lineage metadata while runtime retrieval resolves only the active version after repeated rotation", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const rotateUseCase = new RotateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const seeded = createServerSecretRecord();
    repository.seed(seeded);
    encryption.seedPayload(seeded.versions[0]?.encryptedPayloadRef ?? "", "sk-initial");

    const firstRotate = await rotateUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.rotate]),
      operationKey: "op:rotate:lineage:1",
      secretId: seeded.secretId,
      plaintext: "sk-rotated-1",
      rotatedAt: "2026-04-06T11:00:00.000Z",
    });
    expect(firstRotate.ok).toBeTrue();

    const secondRotate = await rotateUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.rotate]),
      operationKey: "op:rotate:lineage:2",
      secretId: seeded.secretId,
      plaintext: "sk-rotated-2",
      rotatedAt: "2026-04-06T11:05:00.000Z",
    });
    expect(secondRotate.ok).toBeTrue();

    const persisted = await repository.findSecretById(seeded.secretId);
    expect(persisted?.versions).toHaveLength(3);
    expect(persisted?.versions.map((version) => version.state)).toEqual(["superseded", "superseded", "active"]);
    expect(persisted?.versions[0]?.supersededByVersionId).toBe(`${seeded.secretId}:v2`);
    expect(persisted?.versions[1]?.supersededByVersionId).toBe(`${seeded.secretId}:v3`);
    expect(persisted?.currentVersionId).toBe(`${seeded.secretId}:v3`);

    const runtime = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: seeded.secretId,
      operationKey: "op:retrieve:lineage:active-only",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "provider invocation",
      },
      occurredAt: "2026-04-06T11:06:00.000Z",
    });
    expect(runtime).toEqual({
      ok: true,
      value: {
        secretId: seeded.secretId,
        currentVersionId: `${seeded.secretId}:v3`,
        scope: {
          scope: SecretScopes.server,
        },
        plaintext: "sk-rotated-2",
      },
    });
  });

  it("returns a conflict without mutating the record when activation preconditions fail due to concurrent version updates", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const rotateUseCase = new RotateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: new DomainBackedSecretAccessPolicyPort(),
      secretAccessAuditPort: new InMemorySecretAccessAuditPort(),
    });

    const seeded = createServerSecretRecord();
    repository.seed(seeded);

    repository.beforeConditionalCheck = () => {
      const concurrentUpdate = rotateSecretRecord({
        record: seeded,
        rotatedBy: "user:other-admin",
        rotatedAt: "2026-04-06T12:00:00.000Z",
        nextVersion: {
          versionId: `${seeded.secretId}:v2`,
          createdBy: "user:other-admin",
          encryptedPayloadRef: `enc:${seeded.secretId}:concurrent-v2`,
          payloadDigestSha256: `sha256:${seeded.secretId}:concurrent-v2`,
          payloadByteLength: 18,
          keyEncryptionContext: {
            keyId: "kek:server:default",
            algorithm: "aes-256-gcm",
            scope: SecretScopes.server,
          },
        },
      });
      repository.seed(concurrentUpdate);
    };

    const result = await rotateUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.rotate]),
      operationKey: "op:rotate:concurrent-activation",
      secretId: seeded.secretId,
      plaintext: "sk-rotate-lost-race",
      rotatedAt: "2026-04-06T12:00:01.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.conflict,
        message: "Secret rotation conflicted with a concurrent version activation. Retry the operation.",
      },
    });

    const persisted = await repository.findSecretById(seeded.secretId);
    expect(persisted?.currentVersionId).toBe(`${seeded.secretId}:v2`);
    expect(persisted?.versions).toHaveLength(2);
  });

  it("returns an internal error and preserves the previously active version when persistence fails", async () => {
    const repository = new InMemorySecretRecordRepository();
    const encryption = new InMemorySecretEncryptionPort();
    const policy = new DomainBackedSecretAccessPolicyPort();
    const audit = new InMemorySecretAccessAuditPort();
    const rotateUseCase = new RotateSecretUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });
    const retrieveUseCase = new RetrieveSecretPlaintextForRuntimeUseCase({
      secretRecordRepository: repository,
      secretEncryptionPort: encryption,
      secretAccessPolicyPort: policy,
      secretAccessAuditPort: audit,
    });

    const seeded = createServerSecretRecord();
    repository.seed(seeded);
    encryption.seedPayload(seeded.versions[0]?.encryptedPayloadRef ?? "", "sk-original");
    repository.throwOnConditionalSave = true;

    const result = await rotateUseCase.execute({
      actor: createServerAdminActor([SecretAccessActions.rotate]),
      operationKey: "op:rotate:persist-failure",
      secretId: seeded.secretId,
      plaintext: "sk-new-but-not-activated",
      rotatedAt: "2026-04-06T13:00:00.000Z",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: SecretServiceErrorCodes.internal,
        message: "Secret rotation failed due to an internal security error.",
      },
    });

    const persisted = await repository.findSecretById(seeded.secretId);
    expect(persisted?.currentVersionId).toBe(`${seeded.secretId}:v1`);
    expect(persisted?.versions).toHaveLength(1);

    const runtime = await retrieveUseCase.execute({
      actor: {
        actorId: "system:runtime:server",
        actorType: SecretActorTypes.serverRuntime,
        grantedActions: [SecretAccessActions.retrievePlaintext],
      },
      secretId: seeded.secretId,
      operationKey: "op:retrieve:after-rollback",
      runtimeContext: {
        serviceIdentity: "runtime:server:provider-gateway",
        scope: {
          scope: SecretScopes.server,
        },
        justification: "provider invocation",
      },
      occurredAt: "2026-04-06T13:00:01.000Z",
    });
    expect(runtime).toEqual({
      ok: true,
      value: {
        secretId: seeded.secretId,
        currentVersionId: `${seeded.secretId}:v1`,
        scope: {
          scope: SecretScopes.server,
        },
        plaintext: "sk-original",
      },
    });
  });
});

function createServerSecretRecord(): SecretRecord {
  return createSecretRecord({
    secretId: "secret:server:rotation-test",
    name: "provider.openai.rotation-test",
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.apiKey,
    createdBy: "user:server-admin",
    createdAt: "2026-04-05T12:00:00.000Z",
    metadata: {
      tags: ["server", "rotation"],
      labels: {
        provider: "openai",
        usage: "model-inference",
      },
    },
    initialVersion: {
      versionId: "secret:server:rotation-test:v1",
      createdBy: "user:server-admin",
      encryptedPayloadRef: "enc:secret:server:rotation-test:v1",
      payloadDigestSha256: "sha256:secret:server:rotation-test:v1",
      payloadByteLength: 11,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });
}

function createLegacySecretRecordWithoutVersions(): SecretRecord {
  const seeded = createSecretRecord({
    secretId: "secret:server:legacy-no-versions",
    name: "provider.legacy.rotation-test",
    owner: {
      scope: SecretScopes.server,
    },
    kind: SecretKinds.generic,
    createdBy: "user:server-admin",
    createdAt: "2026-04-05T08:00:00.000Z",
    metadata: {
      tags: ["legacy"],
      labels: {
        migration: "v1",
      },
    },
    initialVersion: {
      versionId: "secret:server:legacy-no-versions:v1",
      createdBy: "user:server-admin",
      encryptedPayloadRef: "enc:secret:server:legacy-no-versions:v1",
      payloadDigestSha256: "sha256:secret:server:legacy-no-versions:v1",
      payloadByteLength: 10,
      keyEncryptionContext: {
        keyId: "kek:server:default",
        algorithm: "aes-256-gcm",
        scope: SecretScopes.server,
      },
    },
  });

  return {
    ...seeded,
    versions: Object.freeze([]),
    currentVersionId: undefined,
    reference: {
      ...seeded.reference,
      currentVersionId: undefined,
    },
  };
}

function createServerAdminActor(
  actions: ReadonlyArray<typeof SecretAccessActions[keyof typeof SecretAccessActions]>,
): SecretAccessActor {
  return {
    actorId: "user:server-admin",
    actorType: SecretActorTypes.serverAdmin,
    grantedActions: actions,
  };
}
